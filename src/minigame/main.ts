import { type BoardCamera, createDefaultCamera } from '@core/camera';
import { ROOM_CATALOG } from '@core/catalogs';
import { HOME_DIALOGUE_INTERVAL_SEC, PET_REACTION_DURATION_SEC, pickTapReactionLine } from '@core/catAnimation';
import { createFlyingItemAnim, type FlyingItemAnim } from '@core/flyAnimation';
import { GameSession } from '@core/gameSession';
import { ITEM_BY_ID } from '@core/catalogs';
import { REF_ITEM_BASE_SIZE } from '@core/levelGenerator';
import {
  beginTransition,
  createIdleTransition,
  isTransitionBlockingInput,
  type SceneTransitionState,
  stepTransition,
  type TransitionPayload,
} from '@core/transition';
import type { AdPlacement, BoosterType, GameEvent, SaveData, SessionSnapshot } from '@core/types';
import { consumeLife, recordLevelVictory, resetWinStreak, syncDailyReset, syncLives } from '@core/userProfile';
import { createPlatformAdapter } from '@platform/PlatformFactory';
import { createEmptyVictoryMeta, getRoomForLevel, type VictoryDisplayMeta } from '@shared/hudViewModel';
import { OrderFlowTracker } from '@shared/orderFlowTracker';
import { executeRewardUnlock, executeVerifiedShare } from '@shared/rewardFlow';
import { isShareUnlockMode } from '@core/rewardUnlock';
import { MiniGameAssetStore } from './assets';
import {
  BoardWorldCache,
  DockedCatCache,
  renderBoardWorld,
  renderDockedCat,
  renderZoomControls,
} from './boardRenderer';
import { drawFlyingItems, drawTapRipple, drawToast, drawTransitionCurtain } from './canvasPrimitives';
import { renderHomeScreen } from './homeRenderer';
import { renderInGameHud } from './hudRenderer';
import { computeSafeTopOffset, type Point } from './input';
import { bindMiniGameTouch } from './inputController';
import { renderOverlayModal } from './modalRenderer';
import {
  boardNormToStage,
  computeHudLayout,
  getOrderSlotCenter,
  getTraySlotCenter,
  type HitRect,
  type MiniGameModal,
  type MiniGameScreen,
  REF_H,
  REF_W,
  type StageMetrics,
  type TapRipple,
  type ToastState,
} from './types';

declare const wx: any;
declare const tt: any;
declare const GameGlobal: any;
declare const requestAnimationFrame: ((cb: (t: number) => void) => number) | undefined;

class NativeMiniGameRuntime {
  private readonly api: any;
  private readonly canvas: any;
  private readonly ctx: any;
  private readonly assets: MiniGameAssetStore;
  private readonly platform = createPlatformAdapter();
  private readonly orderFlow = new OrderFlowTracker();
  private readonly boardCache = new BoardWorldCache();
  private readonly catCache = new DockedCatCache();
  private isCameraNavigating = false;

  private metrics: StageMetrics = {
    screenW: 375,
    screenH: 667,
    stageW: REF_W,
    stageH: REF_H,
    dpr: 2,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    safeTopOffset: 0,
    safeBottomOffset: 0,
  };

  private saveData: SaveData;
  private session!: GameSession;
  private screen: MiniGameScreen = 'home';
  private activeModal: MiniGameModal = 'none';
  private confirmReset = false;
  private camera: BoardCamera = createDefaultCamera();

  private hudHitRegions: HitRect[] = [];
  private boardHitRegions: HitRect[] = [];
  private catHitRegion: HitRect | null = null;
  private boardClipTopY = 270;
  private boardClipBottomY = 1020;

  private transitionState: SceneTransitionState = createIdleTransition();
  private pendingTransitionSwap: (() => void) | null = null;

  private tapRipple: TapRipple | null = null;
  private toast: ToastState | null = null;
  private activeFlys: FlyingItemAnim[] = [];
  private slotLandAtMs = new Map<string, number>();
  private flashBlockerUids = new Set<string>();
  private flashBlockerUntilMs = 0;
  private blockedShakeUid: string | null = null;
  private blockedShakeUntilMs = 0;
  private flySeq = 0;
  private sharePending = false;
  private pointerX = REF_W * 0.5;
  private pointerY = REF_H * 0.56;
  private lastTickMs = Date.now();
  private lastLifeSyncAtMs = 0;

  private lastVictoryMeta: VictoryDisplayMeta = createEmptyVictoryMeta();
  private animTimeSec = 0;
  private homeDialogueIdx = 0;
  private homeDialogueElapsedSec = 0;
  private homeCustomLine: string | null = null;
  private homeTapCount = 0;
  private homePetReactSec = 0;
  private gameBubbleLastText: string | null = null;
  private gameBubbleElapsedSec = 0;
  private gamePetReactSec = 0;

  constructor() {
    this.api = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;
    if (!this.api) {
      throw new Error('Native MiniGame runtime requires wx or tt global');
    }
    this.canvas = this.api.createCanvas();
    this.ctx = this.canvas.getContext('2d');
    this.assets = new MiniGameAssetStore(this.api);
    this.syncViewport();

    if (typeof this.api.onWindowResize === 'function') {
      try {
        this.api.onWindowResize((res: any) => {
          this.syncViewport(res?.windowWidth, res?.windowHeight);
          if (this.session) {
            this.render(this.session.getSnapshot());
          }
        });
      } catch {
        // Ignore onWindowResize errors on older SDKs.
      }
    }

    const syncedDaily = syncDailyReset(this.platform.loadSave());
    this.saveData = syncLives(syncedDaily, Date.now()).save;
    this.platform.saveProgress(this.saveData);

    // Lazy-load core UI + active room first, then sync CloudBase save & remote asset manifest asynchronously.
    this.assets.preloadCore();
    this.assets.preloadTheme(getRoomForLevel(this.saveData.currentLevel).theme);
    void this.bootstrapCloudServices();
    bindMiniGameTouch({
      api: this.api,
      canvas: this.canvas,
      getMetrics: () => this.metrics,
      getScreen: () => this.screen,
      getActiveModal: () => this.activeModal,
      getSession: () => this.session,
      getTransitionState: () => this.transitionState,
      getCamera: () => this.camera,
      setCamera: (next) => {
        this.camera = next;
      },
      getHitRegions: () => ({
        hud: this.hudHitRegions,
        board: this.boardHitRegions,
        cat: this.catHitRegion,
        boardClipTopY: this.boardClipTopY,
        boardClipBottomY: this.boardClipBottomY,
      }),
      setPointer: (pt) => {
        this.pointerX = pt.x;
        this.pointerY = pt.y;
      },
      setTapRipple: (pt, atMs) => {
        this.tapRipple = { x: pt.x, y: pt.y, atMs };
      },
      onRender: (snap) => this.render(snap),
      onNavigationStateChange: (active) => {
        this.isCameraNavigating = active;
      },
    });

    this.startLevel(this.saveData.currentLevel);
    this.render(this.session.getSnapshot());
    this.scheduleNextFrame(this.loop);
  }

  private syncViewport(winW?: number, winH?: number): void {
    const sys =
      typeof this.api?.getWindowInfo === 'function'
        ? this.api.getWindowInfo()
        : typeof this.api?.getSystemInfoSync === 'function'
          ? this.api.getSystemInfoSync()
          : {};
    const screenW = Math.max(240, Number(winW) || Number(sys?.windowWidth) || 375);
    const screenH = Math.max(320, Number(winH) || Number(sys?.windowHeight) || 667);
    // Cap backing DPR at 2 (720p logical stage is already retina-crisp at 2x and cuts Android fill-rate by 55% vs 3x)
    const dpr = Math.max(1, Math.min(2, Number(sys?.pixelRatio) || 2));
    this.boardCache.clear();

    if (this.canvas) {
      this.canvas.width = Math.round(screenW * dpr);
      this.canvas.height = Math.round(screenH * dpr);
      try {
        if (this.canvas.style) {
          this.canvas.style.width = `${screenW}px`;
          this.canvas.style.height = `${screenH}px`;
        }
      } catch {
        // Native MiniGame canvas may expose read-only style properties.
      }
    }

    const scale = Math.min(screenW / REF_W, screenH / REF_H);
    const stageW = screenW / scale;
    const stageH = screenH / scale;

    let menuButtonBottom = 0;
    try {
      if (typeof this.api?.getMenuButtonBoundingClientRect === 'function') {
        const menuRect = this.api.getMenuButtonBoundingClientRect();
        if (menuRect && Number.isFinite(menuRect.bottom) && menuRect.bottom > 0) {
          menuButtonBottom = menuRect.bottom;
        }
      }
    } catch {
      // Ignore menu rect errors in non-WeChat hosts.
    }

    const safeTopOffset = computeSafeTopOffset({
      statusBarHeight: Number(sys?.statusBarHeight) || 0,
      safeAreaTop: Number(sys?.safeArea?.top) || 0,
      menuButtonBottom,
      scale,
      isMiniGame: typeof wx !== 'undefined' || typeof tt !== 'undefined',
    });

    const safeBottomScreen =
      sys?.safeArea && Number.isFinite(sys.safeArea.bottom) && sys.safeArea.bottom > 0
        ? Math.max(0, screenH - Number(sys.safeArea.bottom))
        : 0;
    const safeBottomOffset = Math.max(0, Math.min(72, Math.round(safeBottomScreen / scale)));

    this.metrics = {
      screenW,
      screenH,
      stageW,
      stageH,
      dpr,
      scale,
      offsetX: 0,
      offsetY: 0,
      safeTopOffset,
      safeBottomOffset,
    };
  }

  private playSfx(name: string): void {
    this.assets.playSfx(name, this.saveData.muted);
  }

  private triggerVibrate(style: 'light' | 'medium' | 'heavy' = 'light'): void {
    if (!this.saveData.vibrationEnabled) return;
    this.platform.vibrateShort(style);
  }

  private showToast(text: string, durationMs = 2200): void {
    this.toast = { text, untilMs: Date.now() + durationMs };
  }

  private runSceneTransition(payload: TransitionPayload, onSwap: () => void): void {
    if (this.transitionState.phase !== 'idle') return;
    this.pendingTransitionSwap = onSwap;
    this.transitionState = beginTransition(payload);
  }

  private showHomeWithTransition(beforeSwap?: () => void): void {
    const { room } = getRoomForLevel(this.saveData.currentLevel);
    this.runSceneTransition(
      {
        title: '我来收纳',
        subtitle: '回到温馨大厅',
        accentColor: room.accentColor,
        bgColor: '#FFF3DE',
      },
      () => {
        beforeSwap?.();
        this.activeModal = 'none';
        this.screen = 'home';
      }
    );
  }

  private tryEnterLevel(
    levelNumber: number,
    opts: { resetStreakOnRestart?: boolean } = {}
  ): boolean {
    if (this.transitionState.phase !== 'idle') return false;
    const maxUnlocked = Math.max(this.saveData.highestLevel, this.saveData.currentLevel);
    const clampedLevel = Math.min(maxUnlocked, Math.max(1, Math.floor(levelNumber)));

    const synced = syncLives(this.saveData, Date.now());
    this.saveData = synced.save;
    if (this.saveData.lives <= 0) {
      this.platform.saveProgress(this.saveData);
      this.activeModal = 'no_lives';
      return false;
    }

    const { room } = getRoomForLevel(clampedLevel);
    const preview = GameSession.fromLevelNumber(clampedLevel).getSnapshot();
    const tint = room.paletteTint[preview.timeOfDay];

    this.runSceneTransition(
      {
        title: `第 ${clampedLevel} 关`,
        subtitle: `${room.name} · ${tint.label}`,
        accentColor: room.accentColor,
        bgColor: room.badgeBg,
      },
      () => {
        const lifeCheck = consumeLife(this.saveData, Date.now());
        if (!lifeCheck.ok) {
          this.saveData = lifeCheck.save;
          this.platform.saveProgress(this.saveData);
          this.activeModal = 'no_lives';
          return;
        }
        this.saveData = opts.resetStreakOnRestart ? resetWinStreak(lifeCheck.save) : lifeCheck.save;
        this.platform.saveProgress(this.saveData);
        this.startLevel(clampedLevel);
        this.screen = 'game';
        this.showToast('体力 -1 · 整理开始!');
      }
    );
    return true;
  }

  private startLevel(levelNumber: number): void {
    this.activeModal = 'none';
    this.confirmReset = false;
    this.camera = createDefaultCamera();
    this.activeFlys = [];
    this.slotLandAtMs.clear();
    this.flashBlockerUids.clear();
    this.flashBlockerUntilMs = 0;
    this.blockedShakeUid = null;
    this.blockedShakeUntilMs = 0;
    this.orderFlow.reset();
    this.lastVictoryMeta = createEmptyVictoryMeta();
    this.session = GameSession.fromLevelNumber(levelNumber, undefined, {
      initialBoosters: this.saveData.boosters,
    });
    this.assets.preloadForLevel(this.session.level, {
      nextTheme: getRoomForLevel(levelNumber + 1).theme,
    });
    this.session.onEvent((ev) => this.onEvent(ev));
  }

  private async bootstrapCloudServices(): Promise<void> {
    if (typeof this.platform.initCloud === 'function') {
      this.platform.initCloud();
    }

    // Refresh remote asset manifest in the background (non-blocking) for future cloud-hosted level packs.
    void this.assets.syncCloudManifest();

    if (typeof this.platform.syncCloudSave !== 'function') {
      return;
    }
    const merged = await this.platform.syncCloudSave(this.saveData);
    if (!merged) return;

    const prevLevel = this.saveData.currentLevel;
    const syncedDaily = syncDailyReset(merged);
    this.saveData = syncLives(syncedDaily, Date.now()).save;
    this.assets.preloadTheme(getRoomForLevel(this.saveData.currentLevel).theme);

    // If still on home screen and cloud progress advanced our level, update standby level cleanly.
    if (this.screen === 'home' && this.saveData.currentLevel !== prevLevel) {
      this.startLevel(this.saveData.currentLevel);
    }
  }

  private onEvent(ev: GameEvent): void {
    const layout = computeHudLayout(this.metrics);
    switch (ev.type) {
      case 'item_blocked': {
        this.playSfx('blocked');
        this.triggerVibrate('light');
        const uid = String(ev.payload?.uid ?? '');
        const blockers = (ev.payload?.blockedBy as string[] | undefined) ?? [];
        const now = Date.now();
        this.blockedShakeUid = uid || null;
        this.blockedShakeUntilMs = now + 300;
        this.flashBlockerUids = new Set(blockers);
        this.flashBlockerUntilMs = now + 720;
        this.showToast('先移开上面的物品!', 950);
        break;
      }

      case 'item_to_tray': {
        this.playSfx('pick');
        const uid = String(ev.payload?.uid ?? '');
        const itemId = String(ev.payload?.itemId ?? '');
        const variantIndex = Number(ev.payload?.variantIndex ?? 0);
        const trayIdx = Number(ev.payload?.trayIndex ?? 0);
        const fx = Number(ev.payload?.fromX ?? 0.5);
        const fy = Number(ev.payload?.fromY ?? 0.6);
        const rotation = Number(ev.payload?.rotation ?? 0);
        const def = ITEM_BY_ID[itemId];
        if (!def) break;

        const from = boardNormToStage(this.metrics.stageW, this.metrics.stageH, this.camera, fx, fy);
        const to = getTraySlotCenter(layout, trayIdx);
        const startSize = Math.round(REF_ITEM_BASE_SIZE * (def.visualScale ?? 1) * this.camera.zoom * 0.88);
        this.activeFlys.push(
          createFlyingItemAnim({
            id: `fly_${++this.flySeq}`,
            uid,
            itemId,
            variantIndex,
            kind: 'to_tray',
            fromX: from.x,
            fromY: from.y,
            toX: to.x,
            toY: to.y,
            startSize,
            endSize: 68,
            startRotDeg: rotation,
            targetSlotIndex: trayIdx,
            startedAtMs: Date.now(),
          })
        );
        break;
      }

      case 'item_delivered': {
        this.playSfx('deliver');
        const uid = String(ev.payload?.uid ?? '');
        const itemId = String(ev.payload?.itemId ?? '');
        const variantIndex = Number(ev.payload?.variantIndex ?? 0);
        const slotIndex = Number(ev.payload?.slotIndex ?? 0);
        const orderId = String(ev.payload?.orderId ?? '');
        const fromTray = Boolean(ev.payload?.fromTray);
        const fromTrayIndex = Number(ev.payload?.fromTrayIndex ?? 0);
        const fx = Number(ev.payload?.fromX ?? 0.5);
        const fy = Number(ev.payload?.fromY ?? 0.6);
        const rotation = Number(ev.payload?.rotation ?? 0);
        const def = ITEM_BY_ID[itemId];
        if (!def) break;

        const now = Date.now();
        const to = getOrderSlotCenter(layout, slotIndex);
        let from: Point;
        let startSize = 68;
        if (fromTray) {
          from = getTraySlotCenter(layout, fromTrayIndex);
        } else {
          from = boardNormToStage(this.metrics.stageW, this.metrics.stageH, this.camera, fx, fy);
          startSize = Math.round(REF_ITEM_BASE_SIZE * (def.visualScale ?? 1) * this.camera.zoom * 0.88);
        }

        const scheduled = this.orderFlow.scheduleDelivery({
          slotIndex,
          orderId,
          fromTray,
          nowMs: now,
        });

        this.activeFlys.push(
          createFlyingItemAnim({
            id: `fly_${++this.flySeq}`,
            uid,
            itemId,
            variantIndex,
            kind: fromTray ? 'from_tray_to_order' : 'to_order',
            fromX: from.x,
            fromY: from.y,
            toX: to.x,
            toY: to.y,
            startSize,
            endSize: 60,
            startRotDeg: fromTray ? 0 : rotation,
            targetSlotIndex: slotIndex,
            orderId,
            visibleWhileWaiting: scheduled.visibleWhileWaiting,
            startedAtMs: now,
            delayMs: scheduled.delayMs,
          })
        );
        break;
      }

      case 'coin_earned': {
        const amount = Number(ev.payload?.amount ?? 0);
        if (amount > 0) {
          this.saveData.coins = (this.saveData.coins ?? 0) + amount;
          this.platform.saveProgress(this.saveData);
          this.showToast(`+${amount} 金币!`);
        }
        break;
      }

      case 'order_completed':
        this.orderFlow.onOrderCompleted({
          slotIndex: Number(ev.payload?.slotIndex ?? 0),
          orderId: String(ev.payload?.orderId ?? ''),
          itemId: String(ev.payload?.itemId ?? ''),
          requiredCount: Number(ev.payload?.requiredCount ?? 1),
          nowMs: Date.now(),
        });
        break;

      case 'order_refreshed':
        this.orderFlow.onOrderRefreshed({
          slotIndex: Number(ev.payload?.slotIndex ?? 0),
          orderId: String(ev.payload?.orderId ?? ''),
          itemId: String(ev.payload?.itemId ?? ''),
          requiredCount: Number(ev.payload?.requiredCount ?? 1),
        });
        break;

      case 'box_hit':
        this.playSfx('cardboard_hit');
        break;

      case 'box_opened':
        this.playSfx('cardboard_open');
        break;

      case 'fever_started':
        this.playSfx('fever');
        this.showToast('整理狂热 FEVER!');
        break;

      case 'cat_mischief':
        this.playSfx('meow_mischief');
        break;

      case 'cat_petted':
        this.gamePetReactSec = PET_REACTION_DURATION_SEC;
        break;

      case 'cat_gift_delivered': {
        this.playSfx('meow_happy');
        this.gamePetReactSec = PET_REACTION_DURATION_SEC;
        const itemName = String(ev.payload?.itemName ?? '目标');
        this.showToast(`橘猫替你找到「${itemName}」!`);
        break;
      }

      case 'booster_used': {
        this.playSfx('booster');
        if (ev.payload?.type === 'undo') {
          const uid = String(ev.payload?.uid ?? '');
          const itemId = String(ev.payload?.itemId ?? '');
          const variantIndex = Number(ev.payload?.variantIndex ?? 0);
          const fromTrayIndex = Number(ev.payload?.fromTrayIndex ?? 0);
          const toX = Number(ev.payload?.toX ?? 0.5);
          const toY = Number(ev.payload?.toY ?? 0.6);
          const toRot = Number(ev.payload?.toRotation ?? 0);
          const def = ITEM_BY_ID[itemId];
          if (def) {
            const from = getTraySlotCenter(layout, fromTrayIndex);
            const to = boardNormToStage(this.metrics.stageW, this.metrics.stageH, this.camera, toX, toY);
            const endSize = Math.round(REF_ITEM_BASE_SIZE * (def.visualScale ?? 1) * this.camera.zoom * 0.9);
            this.activeFlys.push(
              createFlyingItemAnim({
                id: `fly_${++this.flySeq}`,
                uid,
                itemId,
                variantIndex,
                kind: 'undo_to_board',
                fromX: from.x,
                fromY: from.y,
                toX: to.x,
                toY: to.y,
                startSize: 68,
                endSize,
                startRotDeg: toRot,
                targetSlotIndex: 0,
                startedAtMs: Date.now(),
              })
            );
          }
        }
        break;
      }

      case 'tray_full':
        this.playSfx('fail');
        break;

      case 'level_won': {
        this.playSfx('win');
        this.orderFlow.computeWinUnlockAt(Date.now());
        const snap = this.session.getSnapshot();
        const victory = recordLevelVictory(
          this.saveData,
          snap.levelNumber,
          snap.starsEarned,
          this.session.getBoosters(),
          { nowMs: Date.now() }
        );
        this.saveData = victory.save;
        this.lastVictoryMeta = {
          milestoneGranted: victory.milestonePetTreatsGranted,
          lifeGranted: victory.lifeGranted,
          clearCoinsAwarded: victory.clearCoinsAwarded,
          streakBonusCoins: victory.streakBonusCoins,
          unlockedRoomId: victory.unlockedRoomId,
        };
        this.platform.saveProgress(this.saveData);
        if (typeof this.platform.flushCloudSave === 'function') {
          void this.platform.flushCloudSave(this.saveData);
        }
        break;
      }

      default:
        break;
    }
  }

  private async runAd(placement: AdPlacement, onOk: () => void): Promise<void> {
    if (this.sharePending) return;
    this.sharePending = true;
    const session = this.session;
    try {
      const outcome = await executeRewardUnlock({
        placement,
        platform: this.platform,
        saveData: this.saveData,
        snapshot: session.getSnapshot(),
        onRewarded: () => {
          if (this.session === session) onOk();
        },
      });
      if (this.session !== session) return;
      if (outcome.unlocked && outcome.usedShareMode) {
        this.playSfx('meow_happy');
        if (outcome.toastText) this.showToast(outcome.toastText, 2600);
      } else if (!outcome.unlocked && outcome.toastText) {
        this.showToast(outcome.toastText, 2800);
      }
    } finally {
      this.sharePending = false;
    }
  }

  private async triggerVerifiedShare(): Promise<void> {
    if (this.sharePending) return;
    this.sharePending = true;
    try {
      const outcome = await executeVerifiedShare({
        platform: this.platform,
        getSaveData: () => this.saveData,
        snapshot: this.session.getSnapshot(),
      });
      this.saveData = outcome.saveData;
      if (outcome.rewarded) this.playSfx('meow_happy');
      if (outcome.toastText) this.showToast(outcome.toastText, 2800);
    } finally {
      this.sharePending = false;
    }
  }

  private scheduleNextFrame(cb: () => void): void {
    const candidates: Array<(() => unknown) | null> = [
      typeof GameGlobal !== 'undefined' && typeof GameGlobal.requestAnimationFrame === 'function'
        ? () => GameGlobal.requestAnimationFrame(cb)
        : null,
      this.canvas && typeof this.canvas.requestAnimationFrame === 'function'
        ? () => this.canvas.requestAnimationFrame(cb)
        : null,
      typeof globalThis !== 'undefined' && typeof (globalThis as any).requestAnimationFrame === 'function'
        ? () => (globalThis as any).requestAnimationFrame(cb)
        : null,
      typeof requestAnimationFrame === 'function' ? () => requestAnimationFrame(cb) : null,
      this.api && typeof this.api.requestAnimationFrame === 'function'
        ? () => this.api.requestAnimationFrame(cb)
        : null,
    ];
    for (const invoke of candidates) {
      if (!invoke) continue;
      try {
        invoke();
        return;
      } catch {
        // Fall through to next available scheduler.
      }
    }
    setTimeout(cb, 16);
  }

  private loop = (): void => {
    try {
      const now = Date.now();
      const dt = Math.min(0.1, (now - this.lastTickMs) / 1000);
      this.lastTickMs = now;
      this.animTimeSec += dt;
      this.homePetReactSec = Math.max(0, this.homePetReactSec - dt);
      this.gamePetReactSec = Math.max(0, this.gamePetReactSec - dt);

      if (now - this.lastLifeSyncAtMs >= 500) {
        this.lastLifeSyncAtMs = now;
        const synced = syncLives(this.saveData, now);
        if (synced.gained > 0) {
          this.saveData = synced.save;
          this.platform.saveProgress(this.saveData);
          this.showToast(`体力恢复 +${synced.gained}`);
        } else {
          this.saveData = synced.save;
        }
      }

      if (this.transitionState.phase !== 'idle') {
        const stepped = stepTransition(this.transitionState, dt * 1000);
        this.transitionState = stepped.state;
        if (stepped.shouldSwap && this.pendingTransitionSwap) {
          const swap = this.pendingTransitionSwap;
          this.pendingTransitionSwap = null;
          swap();
        }
      }

      if (this.screen === 'home' && this.activeModal === 'none') {
        this.homeDialogueElapsedSec += dt;
        if (this.homeDialogueElapsedSec >= HOME_DIALOGUE_INTERVAL_SEC) {
          this.homeDialogueElapsedSec = 0;
          this.homeCustomLine = null;
          this.homeDialogueIdx += 1;
        }
      }

      if (this.session) {
        if (
          this.screen === 'game' &&
          this.activeModal === 'none' &&
          this.session.isPlaying() &&
          !isTransitionBlockingInput(this.transitionState)
        ) {
          this.session.tick(dt);
        }
        const latest = this.session.getSnapshot();
        if (latest.pet.bubbleText !== this.gameBubbleLastText) {
          this.gameBubbleLastText = latest.pet.bubbleText;
          this.gameBubbleElapsedSec = 0;
        } else if (latest.pet.bubbleText) {
          this.gameBubbleElapsedSec += dt;
        }
        this.render(latest);
      }
    } catch (err) {
      console.error('[TidyHome] loop error:', err);
    } finally {
      this.scheduleNextFrame(this.loop);
    }
  };

  private render(snap: SessionSnapshot): void {
    const ctx = this.ctx;
    const prevHud = this.hudHitRegions;
    const prevBoard = this.boardHitRegions;
    const prevCatHit = this.catHitRegion;
    this.hudHitRegions = [];
    this.boardHitRegions = [];
    this.catHitRegion = null;

    const backingScaleX =
      this.metrics.screenW > 0 && this.canvas.width > 0 ? this.canvas.width / this.metrics.screenW : this.metrics.dpr;
    const backingScaleY =
      this.metrics.screenH > 0 && this.canvas.height > 0 ? this.canvas.height / this.metrics.screenH : this.metrics.dpr;

    const nowMs = Date.now();
    const layout = computeHudLayout(this.metrics);
    const shareUnlock = isShareUnlockMode(this.platform.platformName);
    this.boardClipTopY = layout.boardClipTopY;
    this.boardClipBottomY = layout.boardClipBottomY;

    ctx.save();
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#EFE2CE';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.translate(this.metrics.offsetX * backingScaleX, this.metrics.offsetY * backingScaleY);
      ctx.scale(this.metrics.scale * backingScaleX, this.metrics.scale * backingScaleY);

      if (this.screen === 'home') {
        renderHomeScreen({
          ctx,
          assets: this.assets,
          metrics: this.metrics,
          saveData: this.saveData,
          shareUnlock,
          activeModal: this.activeModal,
          animTimeSec: this.animTimeSec,
          homeDialogueIdx: this.homeDialogueIdx,
          homeDialogueElapsedSec: this.homeDialogueElapsedSec,
          homeCustomLine: this.homeCustomLine,
          homePetReactSec: this.homePetReactSec,
          hudHitRegions: this.hudHitRegions,
          onSyncSave: (next) => {
            this.saveData = next;
          },
          onTapHomeCat: () => {
            this.homeCustomLine = pickTapReactionLine(this.homeTapCount++);
            this.homeDialogueElapsedSec = 0;
            this.homePetReactSec = PET_REACTION_DURATION_SEC;
            this.playSfx('meow_happy');
            this.triggerVibrate('light');
          },
          onOpenLivesModal: () => {
            this.activeModal = 'no_lives';
          },
          onOpenSettingsModal: () => {
            this.confirmReset = false;
            this.activeModal = 'settings';
          },
          onPlayLevel: (lv) => {
            this.tryEnterLevel(lv);
          },
          onOpenModal: (modal) => {
            this.confirmReset = false;
            this.activeModal = modal;
          },
          onTriggerShare: () => {
            void this.triggerVerifiedShare();
          },
        });
        if (this.activeModal !== 'none') {
          this.renderModalOverlay(snap);
        }
        this.toast = drawToast(ctx, this.toast, this.metrics.stageW, this.boardClipTopY, nowMs);
        this.tapRipple = drawTapRipple(ctx, this.tapRipple, nowMs);
        drawTransitionCurtain(ctx, this.assets, this.transitionState, this.metrics.stageW, this.metrics.stageH);
        return;
      }

      const room = ROOM_CATALOG[snap.theme];
      const tint = room.paletteTint[snap.timeOfDay];

      if (nowMs > this.flashBlockerUntilMs && this.flashBlockerUids.size > 0) {
        this.flashBlockerUids.clear();
      }
      const shakeRemain = Math.max(0, this.blockedShakeUntilMs - nowMs);
      if (shakeRemain <= 0) {
        this.blockedShakeUid = null;
      }
      const blockedShakeOffsetPx =
        shakeRemain > 0 ? Math.sin((shakeRemain / 300) * Math.PI * 5) * 9 * (shakeRemain / 300) : 0;

      const onTapCat = () => {
        const res = this.session.petCat(this.saveData.petTreats);
        if (res.status === 'gifted') {
          this.saveData.petTreats = Math.max(0, this.saveData.petTreats - res.treatsSpent);
          this.platform.saveProgress(this.saveData);
        } else if (res.status === 'need_ad_level_cap' || res.status === 'need_ad_no_treats') {
          this.activeModal = 'cat_ad';
        }
      };

      renderBoardWorld({
        ctx,
        assets: this.assets,
        metrics: this.metrics,
        snap,
        saveData: this.saveData,
        camera: this.camera,
        activeModal: this.activeModal,
        activeFlys: this.activeFlys,
        animTimeSec: this.animTimeSec,
        gameBubbleElapsedSec: this.gameBubbleElapsedSec,
        gamePetReactSec: this.gamePetReactSec,
        pointerX: this.pointerX,
        pointerY: this.pointerY,
        flashBlockerUids: this.flashBlockerUids,
        blockedShakeUid: this.blockedShakeUid,
        blockedShakeOffsetPx,
        boardHitRegions: this.boardHitRegions,
        boardCache: this.boardCache,
        isNavigating: this.isCameraNavigating,
        onTapItem: (uid) => this.session.tapItem(uid),
        onTapBox: (uid) => this.session.tapBox(uid),
        onTapCat,
      });

      renderInGameHud({
        ctx,
        assets: this.assets,
        layout,
        snap,
        roomName: room.name,
        tintLabel: tint.label,
        accentColor: room.accentColor,
        shareUnlock,
        activeModal: this.activeModal,
        orderFlow: this.orderFlow,
        activeFlys: this.activeFlys,
        slotLandAtMs: this.slotLandAtMs,
        hudHitRegions: this.hudHitRegions,
        onGoHome: () => this.showHomeWithTransition(),
        onOpenSettings: () => {
          this.confirmReset = false;
          this.activeModal = 'settings';
        },
        onUnlockOrderBox: () =>
          void this.runAd('unlock_order_box', () => this.session.unlockAdOrderSlot()),
        onFillOrderBox: (slotIndex) =>
          void this.runAd('fill_order_box', () => this.session.fillOrderByReward(slotIndex)),
        onUnlockTraySlot: () =>
          void this.runAd('unlock_tray_slot', () => this.session.unlockAdTraySlot()),
        onTapBooster: (type: BoosterType) => {
          if (snap.boosters[type] > 0) {
            this.session.useBooster(type);
            this.saveData.boosters = this.session.getBoosters();
            this.platform.saveProgress(this.saveData);
          } else {
            void this.runAd(`booster_${type}` as AdPlacement, () => {
              this.session.addBoosterStock(type, 1);
              this.session.useBooster(type);
              this.saveData.boosters = this.session.getBoosters();
              this.platform.saveProgress(this.saveData);
            });
          }
        },
        onBoxSealedToast: () => {
          this.playSfx('box_seal');
          this.showToast('打包完成! +1箱', 1200);
        },
      });

      renderZoomControls({
        ctx,
        assets: this.assets,
        metrics: this.metrics,
        layout,
        snap,
        activeModal: this.activeModal,
        camera: this.camera,
        hudHitRegions: this.hudHitRegions,
        setCamera: (next) => {
          this.camera = next;
        },
      });

      this.catHitRegion = renderDockedCat({
        ctx,
        assets: this.assets,
        metrics: this.metrics,
        layout,
        snap,
        saveData: this.saveData,
        shareUnlock,
        activeModal: this.activeModal,
        animTimeSec: this.animTimeSec,
        gameBubbleElapsedSec: this.gameBubbleElapsedSec,
        gamePetReactSec: this.gamePetReactSec,
        isNavigating: this.isCameraNavigating,
        catCache: this.catCache,
        hudHitRegions: this.hudHitRegions,
        onTapCat,
      });

      this.activeFlys = drawFlyingItems(
        ctx,
        this.assets,
        this.activeFlys,
        this.orderFlow,
        this.slotLandAtMs,
        nowMs
      );

      const showEndOverlay =
        this.activeModal !== 'none' ||
        snap.status === 'failed_tray_full' ||
        (snap.status === 'won' && this.orderFlow.isWinReady(nowMs));
      if (showEndOverlay) {
        this.renderModalOverlay(snap);
      }

      this.toast = drawToast(ctx, this.toast, this.metrics.stageW, this.boardClipTopY, nowMs);
      this.tapRipple = drawTapRipple(ctx, this.tapRipple, nowMs);
      drawTransitionCurtain(ctx, this.assets, this.transitionState, this.metrics.stageW, this.metrics.stageH);
    } catch (err) {
      console.error('[TidyHome] render error:', err);
      this.hudHitRegions = prevHud;
      this.boardHitRegions = prevBoard;
      this.catHitRegion = prevCatHit;
    } finally {
      ctx.restore();
    }
  }

  private renderModalOverlay(snap: SessionSnapshot): void {
    renderOverlayModal({
      ctx: this.ctx,
      metrics: this.metrics,
      screen: this.screen,
      activeModal: this.activeModal,
      confirmReset: this.confirmReset,
      saveData: this.saveData,
      snap,
      lastVictoryMeta: this.lastVictoryMeta,
      platform: this.platform,
      hudHitRegions: this.hudHitRegions,
      setSaveData: (next) => {
        this.saveData = next;
      },
      setActiveModal: (modal) => {
        this.activeModal = modal;
      },
      setConfirmReset: (confirm) => {
        this.confirmReset = confirm;
      },
      onPlaySfx: (name) => this.playSfx(name),
      onVibrate: (style) => this.triggerVibrate(style),
      onShowToast: (text, ms) => this.showToast(text, ms),
      onRunAd: (placement, onOk) => void this.runAd(placement, onOk),
      onTriggerShare: () => void this.triggerVerifiedShare(),
      onTryEnterLevel: (lv, opts) => this.tryEnterLevel(lv, opts),
      onShowHomeWithTransition: (beforeSwap) => this.showHomeWithTransition(beforeSwap),
      onPrepareStandbyLevel: (lv) => this.startLevel(lv),
      onResetAllProgress: () => {
        this.platform.clearSave();
        this.saveData = syncLives(syncDailyReset(this.platform.loadSave()), Date.now()).save;
        this.startLevel(1);
        this.screen = 'home';
      },
      onGrantAdCatGift: () => {
        this.session.grantAdCatGift();
      },
      onReviveClearTray: () => {
        this.session.reviveClearTray(3);
      },
    });
  }
}

new NativeMiniGameRuntime();

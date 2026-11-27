import { ITEM_BY_ID, ROOM_CATALOG } from '@core/catalogs';
import { GameSession } from '@core/gameSession';
import { REF_ITEM_BASE_SIZE } from '@core/levelGenerator';
import {
  beginTransition,
  createIdleTransition,
  getTransitionVisuals,
  isTransitionBlockingInput,
  type SceneTransitionState,
  stepTransition,
  type TransitionPayload,
} from '@core/transition';
import type {
  AdPlacement,
  BoosterType,
  GameEvent,
  RoomThemeId,
  SaveData,
  SessionSnapshot,
} from '@core/types';
import {
  consumeLife,
  MAX_LIVES,
  recordLevelVictory,
  resetWinStreak,
  syncDailyReset,
  syncLives,
} from '@core/userProfile';
import { MockPlatformAdapter } from '@platform/MockPlatformAdapter';
import { createEmptyVictoryMeta, getRoomForLevel, type VictoryDisplayMeta } from '@shared/hudViewModel';
import { OrderFlowTracker } from '@shared/orderFlowTracker';
import { executeRewardUnlock, executeVerifiedShare } from '@shared/rewardFlow';
import { WebAudioPlayer } from './audioPlayer';
import { WebBoardView } from './boardView';
import { VisualLayoutEditor } from './editorMode';
import { bindGmDrawer } from './gmDrawer';
import { WebHomeView } from './homeView';
import { WebHudView } from './hudView';
import {
  type GameModalDeps,
  openCatAdPrompt,
  openNoLivesModal,
  openShopDailyModal,
  renderOutcomeModal,
} from './modals/gameModals';
import { type InfoModalDeps, openHelpModal, openRoomsModal, openSettingsModal } from './modals/infoModals';
import { bindWebAdOverlay, bindWebShareOverlay } from './modals/overlays';
import { mountShell, type ShellElements } from './shellTemplate';
import { captureBeforeAndAfterSnapshots, launchWebFlyAnimation, spawnFloatToast } from './webEffects';

class TidyHomeWebApp {
  private readonly platform = new MockPlatformAdapter();
  private readonly audio = new WebAudioPlayer();
  private readonly orderFlow = new OrderFlowTracker();
  private readonly el: ShellElements;
  private readonly boardView: WebBoardView;
  private readonly hudView: WebHudView;
  private readonly homeView: WebHomeView;
  private readonly layoutEditor: VisualLayoutEditor;

  private saveData: SaveData;
  private session!: GameSession;
  private unsubscribeSession: (() => void) | null = null;
  private screen: 'home' | 'game' = 'home';

  private transitionState: SceneTransitionState = createIdleTransition();
  private pendingTransitionSwap: (() => void) | null = null;

  private beforeShotUrl = '';
  private afterShotUrl = '';
  private winModalShown = false;
  private lastVictoryMeta: VictoryDisplayMeta = createEmptyVictoryMeta();
  private rewardUnlockPending = false;

  private lastTickMs = performance.now();
  private lastLifeSyncAtMs = 0;
  private animTimeSec = 0;
  private resizeRafId = 0;

  constructor(root: HTMLElement) {
    const loaded = syncDailyReset(this.platform.loadSave());
    this.saveData = syncLives(loaded, Date.now()).save;
    this.platform.saveProgress(this.saveData);
    this.audio.muted = this.saveData.muted;

    this.el = mountShell(root);
    bindWebAdOverlay(this.platform, this.el);
    bindWebShareOverlay(this.platform, this.el);

    this.boardView = new WebBoardView({
      el: this.el,
      getSession: () => this.session,
      getSaveData: () => this.saveData,
      getScreen: () => this.screen,
      isSimulationPaused: () => this.isSimulationPaused(),
      onUnlockAudio: () => this.audio.unlockAndPreload(),
      onPlaySfx: (name) => this.audio.play(name),
      onVibrate: (style) => this.triggerVibrate(style),
      onPetCatClick: () => this.handlePetCatClick(),
      onRender: () => this.render(),
    });

    this.hudView = new WebHudView({
      el: this.el,
      orderFlow: this.orderFlow,
      getSession: () => this.session,
      onUnlockOrderBox: () =>
        void this.handleAdAction('unlock_order_box', () => this.session.unlockAdOrderSlot()),
      onFillOrderBox: (slotIndex) =>
        void this.handleAdAction('fill_order_box', () => this.session.fillOrderByReward(slotIndex)),
      onUnlockTraySlot: () =>
        void this.handleAdAction('unlock_tray_slot', () => this.session.unlockAdTraySlot()),
      onBoosterClick: (type) => void this.handleBoosterClick(type),
      onBoxSealSound: () => this.audio.play('box_seal'),
      onRenderWinModal: (snap) => this.renderOutcome(snap),
    });
    this.layoutEditor = new VisualLayoutEditor({
      el: this.el,
      getSession: () => this.session,
      onRender: () => this.render(),
    });

    this.homeView = new WebHomeView({
      el: this.el,
      getSaveData: () => this.saveData,
      setSaveData: (next) => {
        this.saveData = next;
      },
      getScreen: () => this.screen,
      getAnimTimeSec: () => this.animTimeSec,
      onUnlockAudio: () => this.audio.unlockAndPreload(),
      onPlayMeowHappy: () => this.audio.play('meow_happy'),
      onVibrate: (style) => this.triggerVibrate(style),
      onPlayClick: () => this.tryEnterLevel(this.saveData.currentLevel),
      onOpenLivesOrShop: () => this.openLivesOrShop(),
      onOpenSettings: () => openSettingsModal(this.infoModalDeps(), false),
      onOpenShop: () => openShopDailyModal(this.gameModalDeps(), 'shop'),
      onTriggerShare: () => void this.triggerVerifiedShare(),
      onOpenHelp: () => openHelpModal(this.el),
      onApplyRoomThemeColors: (theme) => this.applyRoomThemeColors(theme),
    });

    this.bindShellControls();
    bindGmDrawer({
      el: this.el,
      platform: this.platform,
      audio: this.audio,
      boardView: this.boardView,
      getSession: () => this.session,
      getSaveData: () => this.saveData,
      setSaveData: (next) => {
        this.saveData = next;
      },
      onRender: () => this.render(),
      onOpenRoomsModal: () =>
        openRoomsModal(this.el, this.saveData, (lv) => this.tryEnterLevel(lv)),
      onOpenShopDailyModal: (focus) => openShopDailyModal(this.gameModalDeps(), focus),
      onResetToHome: () => {
        this.startLevel(1);
        this.showScreen('home');
      },
    });

    this.startLevel(this.saveData.currentLevel);
    this.showScreen('home');

    window.addEventListener('resize', () => {
      if (this.resizeRafId) cancelAnimationFrame(this.resizeRafId);
      this.resizeRafId = requestAnimationFrame(() => {
        this.resizeRafId = 0;
        if (this.screen === 'game' && this.session) {
          const snap = this.session.getSnapshot();
          this.boardView.renderItems(snap);
          this.boardView.renderBoxes(snap);
        }
      });
    });

    requestAnimationFrame(this.loop);
  }

  private gameModalDeps(): GameModalDeps {
    return {
      el: this.el,
      platform: this.platform,
      audio: this.audio,
      getSaveData: () => this.saveData,
      setSaveData: (next) => {
        this.saveData = next;
      },
      getSession: () => this.session,
      onRender: () => this.render(),
      onHandleAdAction: (placement, onRewarded) => this.handleAdAction(placement, onRewarded),
      onTriggerVerifiedShare: () => this.triggerVerifiedShare(),
      onTryEnterLevel: (lv, opts) => this.tryEnterLevel(lv, opts),
      onShowHomeWithTransition: () => this.showHomeWithTransition(),
      onShowHomeImmediate: () => this.showScreen('home'),
    };
  }

  private infoModalDeps(): InfoModalDeps {
    return {
      el: this.el,
      platform: this.platform,
      audio: this.audio,
      getSaveData: () => this.saveData,
      setSaveData: (next) => {
        this.saveData = next;
      },
      getCurrentLevelNumber: () => this.session.level.levelNumber,
      onTryEnterLevel: (lv, opts) => this.tryEnterLevel(lv, opts),
      onShowHomeWithTransition: () => this.showHomeWithTransition(),
      onResetToHome: () => {
        this.startLevel(1);
        this.showScreen('home');
      },
      onRenderHome: () => this.homeView.render(this.animTimeSec),
      onVibrate: (style) => this.triggerVibrate(style),
    };
  }

  private bindShellControls(): void {
    this.el.shellEl.addEventListener('pointerdown', (e) => {
      this.audio.unlockAndPreload();
      const target = e.target as HTMLElement;
      if (!target.closest('.gm-drawer') && !target.closest('.gm-btn')) {
        this.el.gmDrawerEl.classList.remove('open');
      }
    });
    this.el.homeBackBtnEl.addEventListener('click', () => this.showHomeWithTransition());
    this.el.gameSettingsBtnEl.addEventListener('click', () =>
      openSettingsModal(this.infoModalDeps(), true)
    );
  }

  private triggerVibrate(style: 'light' | 'medium' | 'heavy' = 'light'): void {
    if (!this.saveData.vibrationEnabled) return;
    this.platform.vibrateShort(style);
  }

  private isSimulationPaused(): boolean {
    if (this.screen !== 'game') return true;
    if (isTransitionBlockingInput(this.transitionState)) return true;
    return (
      this.el.modalBackdropEl.classList.contains('open') ||
      this.el.profileBackdropEl.classList.contains('open') ||
      this.el.subBackdropEl.classList.contains('open') ||
      this.el.shareModalBackdropEl.classList.contains('open') ||
      this.el.adModalBackdropEl.classList.contains('open')
    );
  }

  private applyTransitionDom(): void {
    const vis = getTransitionVisuals(this.transitionState);
    if (!vis.visible || !this.transitionState.payload) {
      this.el.transitionEl.classList.remove('active');
      this.el.transitionEl.style.opacity = '0';
      return;
    }
    const { payload } = this.transitionState;
    this.el.transitionEl.classList.add('active');
    this.el.transitionEl.style.opacity = String(vis.alpha);
    this.el.transitionEl.style.background = `radial-gradient(circle at 50% 42%, ${payload.bgColor} 0%, ${payload.accentColor}44 100%)`;
    this.el.transitionTitleEl.textContent = payload.title;
    this.el.transitionSubEl.textContent = payload.subtitle;
    this.el.transitionCardEl.style.transform = `translateY(${vis.cardOffsetY}px) scale(${vis.cardScale})`;
  }

  private runSceneTransition(payload: TransitionPayload, onSwap: () => void): boolean {
    if (isTransitionBlockingInput(this.transitionState)) return false;
    this.pendingTransitionSwap = onSwap;
    this.transitionState = beginTransition(payload);
    this.applyTransitionDom();
    return true;
  }

  private showHomeWithTransition(): void {
    const { room } = getRoomForLevel(this.saveData.currentLevel);
    this.runSceneTransition(
      {
        title: '返回暖居大厅',
        subtitle: `下一站 · 第 ${this.saveData.currentLevel} 关 ${room.name}`,
        accentColor: room.accentColor,
        bgColor: room.softBg,
      },
      () => {
        this.el.modalBackdropEl.classList.remove('open');
        this.el.subBackdropEl.classList.remove('open');
        this.el.profileBackdropEl.classList.remove('open');
        this.showScreen('home');
      }
    );
  }

  private showScreen(next: 'home' | 'game'): void {
    this.screen = next;
    this.el.homeScreenEl.classList.toggle('hidden', next !== 'home');
    this.el.gmDrawerEl.classList.remove('open');
    this.homeView.render(this.animTimeSec);
  }

  private applyRoomThemeColors(themeId: RoomThemeId): void {
    const room = ROOM_CATALOG[themeId];
    this.el.shellEl.style.setProperty('--room-accent', room.accentColor);
    this.el.shellEl.style.setProperty('--room-accent-deep', room.accentDeep);
    this.el.shellEl.style.setProperty('--room-soft', room.softBg);
    this.el.shellEl.style.setProperty('--room-badge', room.badgeBg);
  }

  private openLivesOrShop(): void {
    if (this.saveData.lives < MAX_LIVES) {
      openNoLivesModal(this.gameModalDeps(), this.saveData.lives > 0);
    } else {
      openShopDailyModal(this.gameModalDeps(), 'shop');
    }
  }

  private tryEnterLevel(
    levelNumber: number,
    opts: { resetStreakOnRestart?: boolean } = {}
  ): boolean {
    if (isTransitionBlockingInput(this.transitionState)) return false;
    const maxUnlocked = Math.max(this.saveData.highestLevel, this.saveData.currentLevel);
    const clampedLevel = Math.min(maxUnlocked, Math.max(1, Math.floor(levelNumber)));

    const lifeCheck = consumeLife(this.saveData, Date.now());
    if (!lifeCheck.ok) {
      this.saveData = lifeCheck.save;
      this.platform.saveProgress(this.saveData);
      this.homeView.render(this.animTimeSec);
      openNoLivesModal(this.gameModalDeps(), false);
      return false;
    }

    this.saveData = opts.resetStreakOnRestart ? resetWinStreak(lifeCheck.save) : lifeCheck.save;
    this.platform.saveProgress(this.saveData);
    this.audio.play('pick');

    const { room: targetRoom } = getRoomForLevel(clampedLevel);
    this.runSceneTransition(
      {
        title: `第 ${clampedLevel} 关 · ${targetRoom.name}`,
        subtitle: targetRoom.tagline,
        accentColor: targetRoom.accentColor,
        bgColor: targetRoom.softBg,
      },
      () => {
        this.el.subBackdropEl.classList.remove('open');
        this.el.profileBackdropEl.classList.remove('open');
        this.el.modalBackdropEl.classList.remove('open');
        this.startLevel(clampedLevel);
        this.showScreen('game');
        spawnFloatToast(this.el.shellEl.getBoundingClientRect(), '体力 -1 · 加油整理!', '#FF9AA8');
      }
    );
    return true;
  }

  private startLevel(levelNumber: number): void {
    if (this.unsubscribeSession) this.unsubscribeSession();
    this.boardView.resetForLevel();
    this.hudView.resetForLevel();
    this.orderFlow.reset();

    this.winModalShown = false;
    this.lastVictoryMeta = createEmptyVictoryMeta();
    this.beforeShotUrl = '';
    this.afterShotUrl = '';
    this.el.modalBackdropEl.classList.remove('open');

    const activeSession = GameSession.fromLevelNumber(levelNumber, undefined, {
      initialBoosters: this.saveData.boosters,
    });
    this.session = activeSession;
    this.unsubscribeSession = this.session.onEvent((ev) => this.onGameEvent(ev));

    this.render();
    void captureBeforeAndAfterSnapshots(this.session.getSnapshot()).then((shots) => {
      if (!shots || this.session !== activeSession) return;
      this.beforeShotUrl = shots.beforeShotUrl;
      this.afterShotUrl = shots.afterShotUrl;
    });
  }

  private handlePetCatClick(): void {
    this.saveData = syncDailyReset(this.saveData);
    const res = this.session.petCat(this.saveData.petTreats);
    if (res.status === 'petted') {
      spawnFloatToast(this.el.petEl.getBoundingClientRect(), '呼噜~ 再摸一下替你寻物', '#FF8BA0');
      this.render();
      return;
    }

    if (res.status === 'gifted') {
      this.saveData.petTreats = Math.max(0, this.saveData.petTreats - res.treatsSpent);
      this.platform.saveProgress(this.saveData);
      spawnFloatToast(this.el.petEl.getBoundingClientRect(), '猫条 -1 · 橘猫替你找到目标!', '#FFD147');
      this.render();
      return;
    }

    if (res.status === 'need_ad_level_cap' || res.status === 'need_ad_no_treats') {
      this.render();
      openCatAdPrompt(this.gameModalDeps(), res.status === 'need_ad_no_treats' ? 'no_treats' : 'level_cap');
      return;
    }

    if (res.status === 'level_limit_reached') {
      spawnFloatToast(this.el.petEl.getBoundingClientRect(), '本局摸猫次数已达上限', '#FFF7EB');
      this.render();
    }
  }

  private async handleBoosterClick(type: BoosterType): Promise<void> {
    const stock = this.session.getBoosters()[type];
    if (stock > 0) {
      const res = this.session.useBooster(type);
      if (!res.ok) {
        spawnFloatToast(this.el.boostersRowEl.getBoundingClientRect(), '当前无需使用该道具', '#FFF7EB');
      } else {
        this.saveData.boosters = this.session.getBoosters();
        this.platform.saveProgress(this.saveData);
      }
      this.render();
      return;
    }

    const placement = (`booster_${type}`) as AdPlacement;
    await this.handleAdAction(placement, () => {
      this.session.addBoosterStock(type, 1);
      this.session.useBooster(type);
      this.saveData.boosters = this.session.getBoosters();
      this.platform.saveProgress(this.saveData);
    });
  }

  private async handleAdAction(placement: AdPlacement, onRewarded: () => void): Promise<void> {
    if (this.rewardUnlockPending) return;
    this.rewardUnlockPending = true;
    try {
      const outcome = await executeRewardUnlock({
        placement,
        platform: this.platform,
        saveData: this.saveData,
        snapshot: this.session.getSnapshot(),
        onRewarded,
      });
      if (outcome.unlocked) {
        if (outcome.usedShareMode) {
          this.audio.play('meow_happy');
          if (outcome.toastText) {
            spawnFloatToast(this.el.shellEl.getBoundingClientRect(), outcome.toastText, outcome.toastColor);
          }
        }
        this.render();
      } else if (outcome.toastText) {
        spawnFloatToast(this.el.shellEl.getBoundingClientRect(), outcome.toastText, outcome.toastColor);
      }
    } finally {
      this.rewardUnlockPending = false;
    }
  }

  private async triggerVerifiedShare(): Promise<void> {
    if (this.rewardUnlockPending) return;
    this.rewardUnlockPending = true;
    try {
      const snap = this.session.getSnapshot();
      const room = ROOM_CATALOG[snap.theme];
      const outcome = await executeVerifiedShare({
        platform: this.platform,
        getSaveData: () => this.saveData,
        snapshot: snap,
        shareTitle: `我在《我来收纳》整理了第 ${this.saveData.currentLevel} 关「${room.name}」，已收齐 ${this.saveData.totalStars} 颗星！快来比比谁更快～`,
      });
      if (outcome.toastText) {
        spawnFloatToast(this.el.shellEl.getBoundingClientRect(), outcome.toastText, outcome.toastColor);
      }
    } finally {
      this.rewardUnlockPending = false;
    }
  }

  private onGameEvent(ev: GameEvent): void {
    const snap = this.session.getSnapshot();
    switch (ev.type) {
      case 'item_blocked': {
        this.audio.play('blocked');
        this.triggerVibrate('light');
        const uid = String(ev.payload?.uid ?? '');
        const blockers = (ev.payload?.blockedBy as string[] | undefined) ?? [];
        const itemEl = this.el.itemsLayerEl.querySelector<HTMLElement>(`[data-uid="${uid}"]`);
        if (itemEl) {
          itemEl.classList.remove('shake');
          void itemEl.offsetWidth;
          itemEl.classList.add('shake');
          spawnFloatToast(itemEl.getBoundingClientRect(), '先移开上面的物品!', '#FFE082');
        }
        this.boardView.flashBlockers(blockers);
        break;
      }

      case 'item_delivered': {
        const comboRate = 1 + Math.min(7, snap.comboCount) * 0.055;
        this.audio.play('deliver', comboRate);
        const uid = String(ev.payload?.uid ?? '');
        const itemId = String(ev.payload?.itemId ?? '');
        const variantIndex = Number(ev.payload?.variantIndex ?? 0);
        const slotIndex = Number(ev.payload?.slotIndex ?? 0);
        const orderId = String(ev.payload?.orderId ?? '');
        const fromTray = Boolean(ev.payload?.fromTray);
        const fromTrayIndex = Number(ev.payload?.fromTrayIndex ?? 0);
        const rotation = Number(ev.payload?.rotation ?? 0);
        const fx = Number(ev.payload?.fromX ?? 0.5);
        const fy = Number(ev.payload?.fromY ?? 0.6);
        const def = ITEM_BY_ID[itemId];
        if (!def) break;

        const now = performance.now();
        let startRect: DOMRect;
        if (fromTray) {
          const byUid = uid
            ? this.el.trayRackEl.querySelector<HTMLElement>(`[data-tray-uid="${uid}"]`)
            : null;
          const byIdx = this.el.trayRackEl.children[fromTrayIndex] as HTMLElement | undefined;
          startRect = (byUid ?? byIdx ?? this.el.trayRackEl).getBoundingClientRect();
        } else {
          const startSizePx = Math.round(
            REF_ITEM_BASE_SIZE *
              this.boardView.getBoardRefScale() *
              (def.visualScale ?? 1) *
              this.boardView.getZoom()
          );
          startRect = this.boardView.getScreenRectForBoardNorm(fx, fy, startSizePx);
        }

        const scheduled = this.orderFlow.scheduleDelivery({
          slotIndex,
          orderId,
          fromTray,
          nowMs: now,
        });
        const targetCard = this.el.ordersRowEl.querySelector<HTMLElement>(`[data-slot="${slotIndex}"]`);
        const targetRect = this.hudView.getOrderSlotTargetRect(slotIndex, targetCard);
        if (targetRect) {
          launchWebFlyAnimation({
            uid,
            itemId,
            variantIndex,
            kind: fromTray ? 'from_tray_to_order' : 'to_order',
            fromRect: startRect,
            toRect: targetRect,
            startRotDeg: fromTray ? 0 : rotation,
            delayMs: scheduled.delayMs,
            visibleWhileWaiting: scheduled.visibleWhileWaiting,
            startedAtMs: now,
            onLand: () => {
              this.orderFlow.markOrderLanded(orderId);
              this.hudView.flashOrderCardLanded(slotIndex);
            },
          });
        }
        break;
      }

      case 'item_to_tray': {
        this.audio.play('pick');
        const uid = String(ev.payload?.uid ?? '');
        const itemId = String(ev.payload?.itemId ?? '');
        const variantIndex = Number(ev.payload?.variantIndex ?? 0);
        const trayIdx = Number(ev.payload?.trayIndex ?? 0);
        const rotation = Number(ev.payload?.rotation ?? 0);
        const fx = Number(ev.payload?.fromX ?? 0.5);
        const fy = Number(ev.payload?.fromY ?? 0.6);
        const def = ITEM_BY_ID[itemId];
        if (!def) break;

        const startSizePx = Math.round(
          REF_ITEM_BASE_SIZE *
            this.boardView.getBoardRefScale() *
            (def.visualScale ?? 1) *
            this.boardView.getZoom()
        );
        const startRect = this.boardView.getScreenRectForBoardNorm(fx, fy, startSizePx);
        const slotEl = this.el.trayRackEl.children[trayIdx] as HTMLElement | undefined;
        if (slotEl) {
          this.hudView.setTrayItemInFlight(uid, true);
          launchWebFlyAnimation({
            uid,
            itemId,
            variantIndex,
            kind: 'to_tray',
            fromRect: startRect,
            toRect: slotEl.getBoundingClientRect(),
            startRotDeg: rotation,
            onLand: () => {
              this.hudView.setTrayItemInFlight(uid, false);
              this.hudView.flashTraySlotLanded(uid, trayIdx);
            },
          });
        }
        break;
      }

      case 'coin_earned': {
        const amount = Number(ev.payload?.amount ?? 0);
        const reason = String(ev.payload?.reason ?? '');
        if (amount > 0) {
          this.saveData.coins = (this.saveData.coins ?? 0) + amount;
          this.platform.saveProgress(this.saveData);
          if (reason === 'golden_item') {
            const x = Number(ev.payload?.x ?? 0.5);
            const y = Number(ev.payload?.y ?? 0.55);
            spawnFloatToast(
              this.boardView.getScreenRectForBoardNorm(x, y, 48),
              `闪光福利 +${amount} 金币`,
              '#FFD147'
            );
          } else {
            spawnFloatToast(this.el.progressTextEl.getBoundingClientRect(), `+${amount} 金币`, '#FFD147');
          }
        }
        break;
      }

      case 'order_completed': {
        this.orderFlow.onOrderCompleted({
          slotIndex: Number(ev.payload?.slotIndex ?? 0),
          orderId: String(ev.payload?.orderId ?? ''),
          itemId: String(ev.payload?.itemId ?? ''),
          requiredCount: Number(ev.payload?.requiredCount ?? 1),
          nowMs: performance.now(),
        });
        this.hudView.ensureOrderTransitionLoop();
        break;
      }

      case 'order_refreshed': {
        const queued = this.orderFlow.onOrderRefreshed({
          slotIndex: Number(ev.payload?.slotIndex ?? 0),
          orderId: String(ev.payload?.orderId ?? ''),
          itemId: String(ev.payload?.itemId ?? ''),
          requiredCount: Number(ev.payload?.requiredCount ?? 1),
        });
        if (queued) this.hudView.ensureOrderTransitionLoop();
        break;
      }

      case 'box_hit':
        this.audio.play('cardboard_hit');
        break;

      case 'box_opened': {
        this.audio.play('cardboard_open');
        const boxUid = String(ev.payload?.uid ?? '');
        const boxEl = this.el.boxesLayerEl.querySelector<HTMLElement>(`[data-box-uid="${boxUid}"]`);
        if (boxEl) {
          spawnFloatToast(boxEl.getBoundingClientRect(), '拆开快递箱!', '#FFE082');
        }
        break;
      }

      case 'fever_started':
        this.audio.play('fever');
        spawnFloatToast(this.el.comboEl.getBoundingClientRect(), '整理狂热 FEVER!', '#FFD147');
        break;

      case 'cat_mischief':
        this.audio.play('meow_mischief');
        break;

      case 'cat_petted':
        this.boardView.triggerPetReaction();
        break;

      case 'cat_gift_delivered': {
        this.audio.play('meow_happy');
        this.boardView.triggerPetReaction();
        const itemName = String(ev.payload?.itemName ?? '目标');
        spawnFloatToast(this.el.petEl.getBoundingClientRect(), `橘猫替你找到「${itemName}」!`, '#FFD147');
        break;
      }

      case 'booster_used': {
        this.audio.play('booster');
        if (ev.payload?.type === 'undo') {
          const uid = String(ev.payload?.uid ?? '');
          const itemId = String(ev.payload?.itemId ?? '');
          const variantIndex = Number(ev.payload?.variantIndex ?? 0);
          const fromTrayIndex = Number(ev.payload?.fromTrayIndex ?? 0);
          const toX = Number(ev.payload?.toX ?? 0.5);
          const toY = Number(ev.payload?.toY ?? 0.6);
          if (itemId) {
            const byUid = uid
              ? this.el.trayRackEl.querySelector<HTMLElement>(`[data-tray-uid="${uid}"]`)
              : null;
            const byIdx = this.el.trayRackEl.children[fromTrayIndex] as HTMLElement | undefined;
            const startRect = (byUid ?? byIdx ?? this.el.trayRackEl).getBoundingClientRect();
            const endSizePx = Math.round(
              REF_ITEM_BASE_SIZE *
                this.boardView.getBoardRefScale() *
                (ITEM_BY_ID[itemId]?.visualScale ?? 1) *
                this.boardView.getZoom()
            );
            const endRect = this.boardView.getScreenRectForBoardNorm(toX, toY, endSizePx);
            this.boardView.setBoardItemInFlight(uid, true);
            launchWebFlyAnimation({
              uid,
              itemId,
              variantIndex,
              kind: 'undo_to_board',
              fromRect: startRect,
              toRect: endRect,
              onLand: () => this.boardView.setBoardItemInFlight(uid, false),
            });
          }
        }
        break;
      }

      case 'tray_full':
        this.audio.play('fail');
        break;

      case 'level_won': {
        this.audio.play('win');
        const now = performance.now();
        const unlockAt = this.orderFlow.computeWinUnlockAt(now);
        if (unlockAt > now) {
          this.hudView.ensureOrderTransitionLoop();
        }
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
        break;
      }

      default:
        break;
    }
  }

  private renderOutcome(snap: SessionSnapshot): void {
    renderOutcomeModal(this.gameModalDeps(), snap, {
      winModalShown: this.winModalShown,
      markWinModalShown: () => {
        this.winModalShown = true;
      },
      isWinReady: () => this.orderFlow.isWinReady(performance.now()),
      getLastVictoryMeta: () => this.lastVictoryMeta,
      getShots: () => ({
        beforeShotUrl: this.beforeShotUrl,
        afterShotUrl: this.afterShotUrl,
      }),
    });
  }

  private render(): void {
    const snap = this.session.getSnapshot();
    if (this.screen === 'game') {
      this.applyRoomThemeColors(snap.theme);
    }

    this.hudView.renderHeader(snap);
    this.homeView.updateLivesWidgets();
    this.boardView.applyCameraTransform();
    this.hudView.renderOrders(snap);
    this.boardView.renderItems(snap);
    this.boardView.renderBoxes(snap);
    this.boardView.renderPet(snap, this.animTimeSec);
    this.hudView.renderTray(snap);
    this.hudView.renderBoosters(snap);
    this.hudView.renderComboBanner(snap);
    this.boardView.drawFlashlight(snap);
    this.renderOutcome(snap);
    this.homeView.render(this.animTimeSec);
    this.layoutEditor.refreshPanel();
  }

  private loop = (now: number): void => {
    const dt = Math.min(0.1, (now - this.lastTickMs) / 1000);
    this.lastTickMs = now;
    this.animTimeSec += dt;
    this.homeView.decayReaction(dt);
    this.boardView.tick(dt);

    if (this.transitionState.phase !== 'idle') {
      const stepped = stepTransition(this.transitionState, dt * 1000);
      this.transitionState = stepped.state;
      if (stepped.shouldSwap && this.pendingTransitionSwap) {
        const fn = this.pendingTransitionSwap;
        this.pendingTransitionSwap = null;
        fn();
      }
      this.applyTransitionDom();
    }

    const wallNow = Date.now();
    if (wallNow - this.lastLifeSyncAtMs >= 500) {
      this.lastLifeSyncAtMs = wallNow;
      const beforeLives = this.saveData.lives;
      this.homeView.updateLivesWidgets();
      if (this.saveData.lives !== beforeLives) {
        this.platform.saveProgress(this.saveData);
      }
    }

    if (this.screen === 'home') {
      this.homeView.tick(dt, this.animTimeSec);
      requestAnimationFrame(this.loop);
      return;
    }

    if (this.session && !this.isSimulationPaused()) {
      const before = this.session.getLoopDigest();
      this.session.tick(dt);
      const after = this.session.getLoopDigest();
      this.boardView.advanceBubbleTyping(after.petBubbleText, dt);
      if (
        after.petMood !== before.petMood ||
        after.petBubbleText !== before.petBubbleText ||
        after.feverActive !== before.feverActive ||
        after.comboCount !== before.comboCount
      ) {
        this.render();
      } else if (after.feverActive) {
        const snap = this.session.getSnapshot();
        this.hudView.renderComboBanner(snap);
        this.boardView.updateCatCanvasAndBubble(snap.pet, this.animTimeSec);
      } else {
        this.boardView.updateCatCanvasAndBubble(
          {
            enabled: this.session.level.petEnabled,
            mood: after.petMood,
            bubbleText: after.petBubbleText,
          },
          this.animTimeSec
        );
      }
    }
    requestAnimationFrame(this.loop);
  };
}

const mountEl = document.getElementById('app');
if (mountEl) {
  new TidyHomeWebApp(mountEl);
}

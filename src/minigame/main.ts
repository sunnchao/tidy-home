import { ITEM_BY_ID, ITEM_CATALOG, ROOM_CATALOG, ROOM_ORDER } from '../core/catalogs';
import { GameSession } from '../core/gameSession';
import type { AdPlacement, BoosterType, GameEvent, SaveData, SessionSnapshot } from '../core/types';
import {
  canClaimDailyFree,
  claimDailyAdBonus,
  claimDailyFree,
  CLEARS_PER_PET_REWARD,
  DAILY_FREE_LIMIT,
  getClearsUntilNextPetReward,
  recordLevelVictory,
  syncDailyReset,
} from '../core/userProfile';
import { createPlatformAdapter } from '../platform/PlatformFactory';

declare const wx: any;
declare const tt: any;
declare const GameGlobal: any;
declare const requestAnimationFrame: ((cb: (t: number) => void) => number) | undefined;

const LOGIC_W = 720;
const LOGIC_H = 1280;

interface HitRect {
  x: number;
  y: number;
  w: number;
  h: number;
  onTap: () => void;
}

class NativeMiniGameRuntime {
  private api: any;
  private canvas: any;
  private ctx: any;
  private screenW = 375;
  private screenH = 667;
  private dpr = 2;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  private platform = createPlatformAdapter();
  private saveData: SaveData;
  private session!: GameSession;

  private screen: 'home' | 'game' = 'home';
  private images = new Map<string, any>();
  private audioCache = new Map<string, any>();
  private hitRegions: HitRect[] = [];
  private activeModal: 'none' | 'daily' | 'cat_ad' | 'settings' | 'rooms' | 'help' | 'privacy' = 'none';
  private confirmReset = false;
  private safeTopOffset = 0;
  private lastTapAtMs = 0;
  private lastTapRawX = -9999;
  private lastTapRawY = -9999;
  private lastTouchStartMs = 0;
  private tapRipple: { x: number; y: number; atMs: number } | null = null;
  private pointerX = LOGIC_W * 0.5;
  private pointerY = LOGIC_H * 0.56;
  private lastTickMs = Date.now();
  private lastMilestoneGranted = 0;

  constructor() {
    this.api = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;
    if (!this.api) {
      throw new Error('Native MiniGame runtime requires wx or tt global');
    }
    this.canvas = this.api.createCanvas();
    this.ctx = this.canvas.getContext('2d');
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

    this.saveData = syncDailyReset(this.platform.loadSave());
    this.platform.saveProgress(this.saveData);

    this.preloadAssets();
    this.bindTouch();
    this.startLevel(this.saveData.currentLevel);
    this.render(this.session.getSnapshot());
    this.scheduleNextFrame(this.loop);
  }

  /** Synchronizes canvas buffer resolution, CSS display size, scale, and safe top inset. */
  private syncViewport(winW?: number, winH?: number): void {
    const sys =
      typeof this.api?.getWindowInfo === 'function'
        ? this.api.getWindowInfo()
        : typeof this.api?.getSystemInfoSync === 'function'
          ? this.api.getSystemInfoSync()
          : {};
    const rawW = Number(winW) || Number(sys?.windowWidth) || 375;
    const rawH = Number(winH) || Number(sys?.windowHeight) || 667;
    this.screenW = Math.max(240, rawW);
    this.screenH = Math.max(320, rawH);
    this.dpr = Math.max(1, Math.min(3, Number(sys?.pixelRatio) || 2));

    if (this.canvas) {
      this.canvas.width = Math.round(this.screenW * this.dpr);
      this.canvas.height = Math.round(this.screenH * this.dpr);
      try {
        if (this.canvas.style) {
          this.canvas.style.width = `${this.screenW}px`;
          this.canvas.style.height = `${this.screenH}px`;
        }
      } catch {
        // Native MiniGame canvas may expose read-only style properties.
      }
    }

    this.scale = Math.min(this.screenW / LOGIC_W, this.screenH / LOGIC_H);
    this.offsetX = (this.screenW - LOGIC_W * this.scale) * 0.5;
    this.offsetY = (this.screenH - LOGIC_H * this.scale) * 0.5;

    let safeScreenY = Math.max(Number(sys?.safeArea?.top) || 0, Number(sys?.statusBarHeight) || 0);
    try {
      if (typeof this.api?.getMenuButtonBoundingClientRect === 'function') {
        const menuRect = this.api.getMenuButtonBoundingClientRect();
        if (menuRect && Number.isFinite(menuRect.bottom) && menuRect.bottom > 0) {
          safeScreenY = Math.max(safeScreenY, menuRect.bottom + 6);
        }
      }
    } catch {
      // Ignore menu rect errors in non-WeChat hosts.
    }
    const logicalNeededPad = safeScreenY > 0 ? (safeScreenY - this.offsetY) / this.scale - 18 : 0;
    this.safeTopOffset = Math.max(0, Math.min(88, Math.round(logicalNeededPad)));
  }

  private preloadAssets(): void {
    const paths: string[] = [
      'resources/rooms/living_room.png',
      'resources/rooms/bedroom.png',
      'resources/rooms/kitchen.png',
      'resources/sprites/cardboard_closed.png',
      'resources/sprites/cardboard_cracked.png',
      'resources/sprites/cat_idle.png',
      'resources/sprites/cat_mischief.png',
      'resources/sprites/cat_happy.png',
      'resources/ui/icon_magnet.png',
      'resources/ui/icon_undo.png',
      'resources/ui/icon_hint.png',
      'resources/ui/icon_shuffle.png',
      'resources/ui/icon_ad.png',
      'resources/ui/icon_star.png',
      'resources/ui/icon_sound_on.png',
      'resources/ui/icon_sound_off.png',
      'resources/ui/icon_daily_gift.png',
      'resources/ui/icon_cat_treat.png',
      'resources/ui/icon_flashlight.png',
      'resources/ui/icon_paw.png',
      'resources/ui/icon_check.png',
      'resources/ui/icon_home.png',
      'resources/ui/icon_settings.png',
      'resources/ui/icon_rooms.png',
      'resources/ui/icon_help.png',
      'resources/ui/icon_vibrate.png',
      'resources/ui/icon_replay.png',
      'resources/ui/icon_shield.png',
    ];
    for (const item of ITEM_CATALOG) {
      paths.push(`resources/${item.spriteResource}.png`);
    }
    for (const p of paths) {
      const img = this.api.createImage();
      img.src = p;
      this.images.set(p, img);
    }
  }

  private playSfx(name: string): void {
    if (this.saveData.muted) return;
    try {
      let audio = this.audioCache.get(name);
      if (!audio) {
        audio = this.api.createInnerAudioContext();
        audio.src = `resources/audio/${name}.wav`;
        this.audioCache.set(name, audio);
      }
      audio.stop();
      audio.play();
    } catch {
      // Ignore audio errors
    }
  }

  private triggerVibrate(style: 'light' | 'medium' | 'heavy' = 'light'): void {
    if (!this.saveData.vibrationEnabled) return;
    this.platform.vibrateShort(style);
  }

  /** Extracts raw pointer coordinates across touches, changedTouches, detail, or DOM events. */
  private extractTouchPoint(ev: any): { x: number; y: number } | null {
    if (!ev || typeof ev !== 'object') return null;
    const src =
      (Array.isArray(ev.touches) && ev.touches[0]) ||
      (Array.isArray(ev.changedTouches) && ev.changedTouches[0]) ||
      (ev.detail && typeof ev.detail === 'object' ? ev.detail : null) ||
      ev;
    const x = src?.clientX ?? src?.pageX ?? src?.x ?? ev?.clientX ?? ev?.pageX ?? ev?.x;
    const y = src?.clientY ?? src?.pageY ?? src?.y ?? ev?.clientY ?? ev?.pageY ?? ev?.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: Number(x), y: Number(y) };
  }

  private toLogic(rawX: number, rawY: number): { x: number; y: number } {
    let localX = rawX;
    let localY = rawY;
    try {
      if (this.canvas && typeof this.canvas.getBoundingClientRect === 'function') {
        const rect = this.canvas.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          localX = ((rawX - rect.left) / rect.width) * this.screenW;
          localY = ((rawY - rect.top) / rect.height) * this.screenH;
        }
      }
    } catch {
      // Ignore getBoundingClientRect failures on headless canvases.
    }
    if (
      this.dpr > 1 &&
      (localX > this.screenW * 1.15 || localY > this.screenH * 1.15) &&
      localX <= this.screenW * this.dpr * 1.05 &&
      localY <= this.screenH * this.dpr * 1.05
    ) {
      localX /= this.dpr;
      localY /= this.dpr;
    }
    return {
      x: (localX - this.offsetX) / this.scale,
      y: (localY - this.offsetY) / this.scale,
    };
  }

  private handleTap(rawX: number, rawY: number): void {
    const now = Date.now();
    if (
      now - this.lastTapAtMs < 80 &&
      Math.abs(rawX - this.lastTapRawX) < 12 &&
      Math.abs(rawY - this.lastTapRawY) < 12
    ) {
      return;
    }
    this.lastTapAtMs = now;
    this.lastTapRawX = rawX;
    this.lastTapRawY = rawY;

    const pt = this.toLogic(rawX, rawY);
    this.pointerX = pt.x;
    this.pointerY = pt.y;
    this.tapRipple = { x: pt.x, y: pt.y, atMs: now };

    for (let i = this.hitRegions.length - 1; i >= 0; i--) {
      const r = this.hitRegions[i];
      if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) {
        try {
          r.onTap();
        } catch (err) {
          console.error('[TidyHome] tap handler error:', err);
        }
        break;
      }
    }
    if (this.session) {
      this.render(this.session.getSnapshot());
    }
  }

  private bindTouch(): void {
    const onStart = (res: any) => {
      this.lastTouchStartMs = Date.now();
      const raw = this.extractTouchPoint(res);
      if (!raw) return;
      this.handleTap(raw.x, raw.y);
    };

    const onMove = (res: any) => {
      const raw = this.extractTouchPoint(res);
      if (!raw) return;
      const pt = this.toLogic(raw.x, raw.y);
      this.pointerX = pt.x;
      this.pointerY = pt.y;
    };

    const onEnd = (res: any) => {
      if (Date.now() - this.lastTouchStartMs <= 450) return;
      const raw = this.extractTouchPoint(res);
      if (!raw) return;
      this.handleTap(raw.x, raw.y);
    };

    if (typeof this.api?.onTouchStart === 'function') {
      this.api.onTouchStart(onStart);
    }
    if (typeof this.api?.onTouchMove === 'function') {
      this.api.onTouchMove(onMove);
    }
    if (typeof this.api?.onTouchEnd === 'function') {
      this.api.onTouchEnd(onEnd);
    }
    if (typeof this.canvas?.addEventListener === 'function') {
      this.canvas.addEventListener('touchstart', onStart);
      this.canvas.addEventListener('mousedown', onStart);
      this.canvas.addEventListener('touchmove', onMove);
      this.canvas.addEventListener('mousemove', onMove);
    }
  }

  private startLevel(levelNumber: number): void {
    this.activeModal = 'none';
    this.confirmReset = false;
    this.lastMilestoneGranted = 0;
    this.session = GameSession.fromLevelNumber(levelNumber, undefined, {
      initialBoosters: this.saveData.boosters,
    });
    this.session.onEvent((ev) => this.onEvent(ev));
  }

  private onEvent(ev: GameEvent): void {
    switch (ev.type) {
      case 'item_blocked':
        this.playSfx('blocked');
        this.triggerVibrate('light');
        break;
      case 'item_to_tray':
        this.playSfx('pick');
        break;
      case 'item_delivered':
        this.playSfx('deliver');
        break;
      case 'order_completed':
        this.playSfx('box_seal');
        break;
      case 'box_hit':
        this.playSfx('cardboard_hit');
        break;
      case 'box_opened':
        this.playSfx('cardboard_open');
        break;
      case 'fever_started':
        this.playSfx('fever');
        break;
      case 'cat_mischief':
        this.playSfx('meow_mischief');
        break;
      case 'cat_gift_delivered':
        this.playSfx('meow_happy');
        break;
      case 'booster_used':
        this.playSfx('booster');
        break;
      case 'tray_full':
        this.playSfx('fail');
        break;
      case 'level_won': {
        this.playSfx('win');
        const snap = this.session.getSnapshot();
        const victory = recordLevelVictory(
          this.saveData,
          snap.levelNumber,
          snap.starsEarned,
          this.session.getBoosters()
        );
        this.saveData = victory.save;
        this.lastMilestoneGranted = victory.milestonePetTreatsGranted;
        this.platform.saveProgress(this.saveData);
        break;
      }
      default:
        break;
    }
  }

  private async runAd(placement: AdPlacement, onOk: () => void): Promise<void> {
    const res = await this.platform.showRewardedAd(placement);
    if (res.rewarded) onOk();
  }

  /** Schedules the next animation frame across WeChat/Douyin sandboxes and JS timers. */
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
      if (this.session) {
        const snap = this.session.getSnapshot();
        if (this.screen === 'game' && this.activeModal === 'none' && snap.status === 'playing') {
          this.session.tick(dt);
        }
        this.render(this.session.getSnapshot());
      }
    } catch (err) {
      console.error('[TidyHome] loop error:', err);
    } finally {
      this.scheduleNextFrame(this.loop);
    }
  };

  private drawRoundRect(x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string, lw = 4): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  private drawImg(key: string, x: number, y: number, w: number, h: number): void {
    const img = this.images.get(key);
    if (img && img.width > 0 && img.height > 0) {
      try {
        this.ctx.drawImage(img, x, y, w, h);
      } catch {
        // Ignore transient image decode errors.
      }
    }
  }

  private drawTapRipple(): void {
    if (!this.tapRipple) return;
    const age = Date.now() - this.tapRipple.atMs;
    if (age >= 260) {
      this.tapRipple = null;
      return;
    }
    const p = age / 260;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.65 * (1 - p);
    ctx.strokeStyle = '#FC9651';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(this.tapRipple.x, this.tapRipple.y, 14 + p * 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private render(snap: SessionSnapshot): void {
    const ctx = this.ctx;
    const prevHitRegions = this.hitRegions;
    const nextHitRegions: HitRect[] = [];
    this.hitRegions = nextHitRegions;

    const backingScaleX =
      this.screenW > 0 && this.canvas.width > 0 ? this.canvas.width / this.screenW : this.dpr;
    const backingScaleY =
      this.screenH > 0 && this.canvas.height > 0 ? this.canvas.height / this.screenH : this.dpr;

    ctx.save();
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#EFE2CE';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.translate(this.offsetX * backingScaleX, this.offsetY * backingScaleY);
      ctx.scale(this.scale * backingScaleX, this.scale * backingScaleY);

      if (this.screen === 'home') {
        this.renderHome();
        if (this.activeModal !== 'none') {
          this.renderOverlay(snap);
        }
        this.drawTapRipple();
        return;
      }

      const room = ROOM_CATALOG[snap.theme];
      this.drawImg(`resources/${room.bgResource}.png`, 0, 0, LOGIC_W, LOGIC_H);

      const tint = room.paletteTint[snap.timeOfDay];
      if (tint.overlayOpacity > 0) {
        ctx.save();
        ctx.globalAlpha = tint.overlayOpacity;
        ctx.fillStyle = tint.overlayColor;
        ctx.fillRect(0, 0, LOGIC_W, LOGIC_H);
        ctx.restore();
      }

      const onBoard = snap.items
        .filter((it) => it.state === 'on_board')
        .sort((a, b) => a.layer * 1000 + a.y - (b.layer * 1000 + b.y));

      for (const item of onBoard) {
        const def = ITEM_BY_ID[item.itemId];
        const cx = item.x * LOGIC_W;
        const cy = item.y * LOGIC_H;
        const size = 132 * item.scale;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((item.rotation * Math.PI) / 180);
        if (item.blockedBy.length > 0) ctx.globalAlpha = 0.72;
        this.drawImg(`resources/${def.spriteResource}.png`, -size / 2, -size / 2, size, size);
        ctx.restore();

        if (snap.status === 'playing' && this.activeModal === 'none') {
          this.hitRegions.push({
            x: cx - size * 0.5,
            y: cy - size * 0.5,
            w: size,
            h: size,
            onTap: () => this.session.tapItem(item.uid),
          });
        }
      }

      for (const box of snap.boxes) {
        if (box.opened) continue;
        const cx = box.x * LOGIC_W;
        const cy = box.y * LOGIC_H;
        const size = 152 * box.scale;
        const key = box.hitsLeft < box.maxHits ? 'resources/sprites/cardboard_cracked.png' : 'resources/sprites/cardboard_closed.png';
        this.drawImg(key, cx - size / 2, cy - size / 2, size, size);
        const isHeavy = box.maxHits >= 3;
        this.drawRoundRect(cx - 66, cy + size * 0.36, 132, 30, 15, isHeavy ? '#D9533B' : '#FC9651', '#3D2B24', 3);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 17px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isHeavy ? `加固·点${box.hitsLeft}次` : `点${box.hitsLeft}次拆箱`, cx, cy + size * 0.36 + 21);

        if (snap.status === 'playing' && this.activeModal === 'none') {
          this.hitRegions.push({
            x: cx - size * 0.5,
            y: cy - size * 0.5,
            w: size,
            h: size,
            onTap: () => this.session.tapBox(box.uid),
          });
        }
      }

      if (snap.pet.enabled) {
        const cx = snap.pet.x * LOGIC_W;
        const cy = snap.pet.y * LOGIC_H;
        const size = 136;
        const catKey =
          snap.pet.mood === 'mischief'
            ? 'resources/sprites/cat_mischief.png'
            : snap.pet.mood === 'pleased'
              ? 'resources/sprites/cat_happy.png'
              : 'resources/sprites/cat_idle.png';
        this.drawImg(catKey, cx - size / 2, cy - size / 2, size, size);

        if (snap.status === 'playing' && this.activeModal === 'none') {
          this.hitRegions.push({
            x: cx - size * 0.5,
            y: cy - size * 0.5,
            w: size,
            h: size,
            onTap: () => {
              const res = this.session.petCat(this.saveData.petTreats);
              if (res.status === 'gifted') {
                this.saveData.petTreats = Math.max(0, this.saveData.petTreats - res.treatsSpent);
                this.platform.saveProgress(this.saveData);
              } else if (res.status === 'need_ad_level_cap' || res.status === 'need_ad_no_treats') {
                this.activeModal = 'cat_ad';
              }
            },
          });
        }
      }

      if (snap.modifiers.includes('blackout_flashlight') && snap.status === 'playing') {
        ctx.save();
        ctx.fillStyle = 'rgba(14, 13, 28, 0.88)';
        ctx.beginPath();
        ctx.rect(0, 0, LOGIC_W, LOGIC_H);
        ctx.arc(this.pointerX, this.pointerY, 185, 0, Math.PI * 2, true);
        ctx.fill('evenodd');
        ctx.restore();
      }

      this.renderHud(snap, room.name, tint.label);
      if (snap.status !== 'playing' || this.activeModal !== 'none') {
        this.renderOverlay(snap);
      }
      this.drawTapRipple();
    } catch (err) {
      console.error('[TidyHome] render error:', err);
      this.hitRegions = prevHitRegions;
    } finally {
      ctx.restore();
    }
  }

  private renderHome(): void {
    const ctx = this.ctx;
    const themeIdx = (this.saveData.currentLevel - 1) % ROOM_ORDER.length;
    const room = ROOM_CATALOG[ROOM_ORDER[themeIdx]];
    const clearsLeft = getClearsUntilNextPetReward(this.saveData);
    const homeTopPad = Math.max(0, Math.min(72, this.safeTopOffset));
    const barY = 24 + homeTopPad;
    const titleY = Math.min(188, 146 + Math.round(homeTopPad * 0.65));

    this.drawImg(`resources/${room.bgResource}.png`, 0, 0, LOGIC_W, LOGIC_H);
    ctx.fillStyle = 'rgba(255, 245, 230, 0.72)';
    ctx.fillRect(0, 0, LOGIC_W, LOGIC_H);

    // Top bar
    this.drawRoundRect(24, barY, 230, 52, 26, '#FFFDF9', '#3D2B24', 4);
    this.drawImg('resources/ui/icon_paw.png', 36, barY + 9, 34, 34);
    ctx.fillStyle = '#3D2B24';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(this.saveData.nickname, 78, barY + 33);

    this.drawRoundRect(410, barY, 108, 52, 26, '#FFF3DE', '#3D2B24', 4);
    this.drawImg('resources/ui/icon_cat_treat.png', 422, barY + 9, 34, 34);
    ctx.fillStyle = '#3D2B24';
    ctx.fillText(String(this.saveData.petTreats), 466, barY + 33);

    this.drawRoundRect(530, barY, 100, 52, 26, '#FFFDF9', '#3D2B24', 4);
    this.drawImg('resources/ui/icon_star.png', 542, barY + 9, 34, 34);
    ctx.fillText(String(this.saveData.totalStars), 584, barY + 33);

    this.drawRoundRect(640, barY, 58, 52, 26, '#FFFDF9', '#3D2B24', 4);
    this.drawImg('resources/ui/icon_settings.png', 651, barY + 8, 36, 36);

    // Title card
    this.drawRoundRect(110, titleY, 500, 140, 32, '#FFFDF9', '#3D2B24', 5);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#3D2B24';
    ctx.font = 'bold 50px sans-serif';
    ctx.fillText('收纳小当家', 360, titleY + 68);
    ctx.fillStyle = '#E87630';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('暖系无限找物整理 · 把混乱房间变整洁', 360, titleY + 112);

    // Cat mascot
    this.drawRoundRect(140, 340, 440, 52, 22, '#FFFDF9', '#3D2B24', 3.5);
    ctx.fillStyle = '#3D2B24';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('喵~ 今天也一起把房间收拾得干干净净吧!', 360, 373);
    this.drawImg('resources/sprites/cat_idle.png', 260, 412, 200, 200);

    // Progress card
    this.drawRoundRect(40, 660, 640, 110, 26, '#FFFDF9', '#3D2B24', 4);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#3D2B24';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`第 ${this.saveData.currentLevel} 关 · ${room.name}`, 70, 706);
    ctx.fillStyle = '#755C50';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`已通关 ${this.saveData.totalLevelsCleared} 关 · 再过 ${clearsLeft} 关送 +1 摸猫机会`, 70, 744);

    // Primary Play Button
    this.drawRoundRect(40, 820, 640, 108, 28, '#FC9651', '#3D2B24', 5);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 34px sans-serif';
    const label =
      this.saveData.totalLevelsCleared === 0 && this.saveData.currentLevel === 1
        ? '开始整理 · 第 1 关'
        : `继续整理 · 第 ${this.saveData.currentLevel} 关`;
    ctx.fillText(label, 360, 886);

    // Bottom 4 Menu Buttons
    const menus: Array<{ key: 'daily' | 'rooms' | 'help' | 'settings'; icon: string; name: string }> = [
      { key: 'daily', icon: 'resources/ui/icon_daily_gift.png', name: '每日补给' },
      { key: 'rooms', icon: 'resources/ui/icon_rooms.png', name: '房间选关' },
      { key: 'help', icon: 'resources/ui/icon_help.png', name: '玩法说明' },
      { key: 'settings', icon: 'resources/ui/icon_settings.png', name: '设置' },
    ];
    menus.forEach((m, i) => {
      const bx = 36 + i * 168;
      const by = 964;
      const bw = 148;
      const bh = 128;
      this.drawRoundRect(bx, by, bw, bh, 24, '#FFFDF9', '#3D2B24', 4);
      this.drawImg(m.icon, bx + 42, by + 16, 64, 64);
      ctx.fillStyle = '#3D2B24';
      ctx.font = 'bold 21px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.name, bx + bw / 2, by + 108);
      if (m.key === 'daily' && canClaimDailyFree(this.saveData)) {
        this.drawRoundRect(bx + bw - 28, by - 6, 22, 22, 11, '#EB4D4B', '#3D2B24', 3);
      }
      if (this.activeModal === 'none') {
        this.hitRegions.push({
          x: bx,
          y: by,
          w: bw,
          h: bh,
          onTap: () => {
            this.confirmReset = false;
            this.activeModal = m.key;
          },
        });
      }
    });

    if (this.activeModal === 'none') {
      this.hitRegions.push(
        { x: 24, y: barY, w: 494, h: 52, onTap: () => (this.activeModal = 'daily') },
        { x: 530, y: barY, w: 100, h: 52, onTap: () => (this.activeModal = 'rooms') },
        {
          x: 640,
          y: barY,
          w: 58,
          h: 52,
          onTap: () => {
            this.confirmReset = false;
            this.activeModal = 'settings';
          },
        },
        { x: 40, y: 660, w: 640, h: 110, onTap: () => (this.activeModal = 'rooms') },
        {
          x: 40,
          y: 820,
          w: 640,
          h: 108,
          onTap: () => {
            this.startLevel(this.saveData.currentLevel);
            this.screen = 'game';
          },
        }
      );
    }
  }

  private renderHud(snap: SessionSnapshot, roomName: string, tintLabel: string): void {
    const ctx = this.ctx;
    const hudTopPad = Math.max(0, Math.min(78, this.safeTopOffset));
    const topY = 18 + hudTopPad;
    const barY = 84 + hudTopPad;

    // Home button
    this.drawRoundRect(18, topY, 56, 52, 26, '#FFFDF9', '#3D2B24', 4);
    this.drawImg('resources/ui/icon_home.png', 28, topY + 8, 36, 36);

    // Level pill
    this.drawRoundRect(82, topY, 264, 52, 26, '#FFFDF9', '#3D2B24', 4);
    this.drawRoundRect(90, topY + 7, 76, 38, 19, '#FC9651');
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 19px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Lv.${snap.levelNumber}`, 128, topY + 33);
    ctx.fillStyle = '#3D2B24';
    ctx.textAlign = 'left';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`${roomName}·${tintLabel}`, 174, topY + 33);

    // Cat treat & daily gift pills
    this.drawRoundRect(356, topY, 102, 52, 26, '#FFF3DE', '#3D2B24', 4);
    this.drawImg('resources/ui/icon_cat_treat.png', 368, topY + 9, 34, 34);
    ctx.fillStyle = '#3D2B24';
    ctx.font = 'bold 21px sans-serif';
    ctx.fillText(String(this.saveData.petTreats), 410, topY + 34);

    this.drawRoundRect(468, topY, 66, 52, 26, '#FFE8CC', '#3D2B24', 4);
    this.drawImg('resources/ui/icon_daily_gift.png', 483, topY + 8, 36, 36);
    if (canClaimDailyFree(this.saveData)) {
      this.drawRoundRect(516, topY - 4, 18, 18, 9, '#EB4D4B', '#3D2B24', 3);
    }

    // Settings / Pause button
    this.drawRoundRect(638, topY, 64, 52, 26, '#FFFDF9', '#3D2B24', 4);
    this.drawImg('resources/ui/icon_settings.png', 652, topY + 8, 36, 36);

    if (this.activeModal === 'none' && snap.status === 'playing') {
      this.hitRegions.push(
        { x: 18, y: topY, w: 56, h: 52, onTap: () => (this.screen = 'home') },
        { x: 356, y: topY, w: 178, h: 52, onTap: () => (this.activeModal = 'daily') },
        {
          x: 638,
          y: topY,
          w: 64,
          h: 52,
          onTap: () => {
            this.confirmReset = false;
            this.activeModal = 'settings';
          },
        }
      );
    }

    // Progress bar
    const ratio = snap.progressTotal > 0 ? snap.progressDone / snap.progressTotal : 0;
    this.drawRoundRect(20, barY, 540, 20, 10, 'rgba(61,43,36,0.16)', '#3D2B24', 3);
    if (ratio > 0) {
      this.drawRoundRect(22, barY + 2, Math.max(20, 536 * ratio), 16, 8, '#FC9651');
    }
    ctx.fillStyle = '#3D2B24';
    ctx.font = 'bold 19px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${snap.distinctItemTypes}类 ${snap.progressDone}/${snap.progressTotal}`, 700, barY + 17);

    // Order boxes
    snap.orderSlots.forEach((slot, idx) => {
      const bx = 20 + idx * 230;
      const by = 126 + hudTopPad;
      const bw = 220;
      const bh = 128;
      if (!slot.unlocked && slot.isAdSlot) {
        this.drawRoundRect(bx, by, bw, bh, 20, '#2C272B', '#FC9651', 4);
        this.drawImg('resources/ui/icon_ad.png', bx + 84, by + 20, 52, 52);
        ctx.fillStyle = '#FFF7EB';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('解锁第3箱', bx + bw / 2, by + 104);
        if (this.activeModal === 'none' && snap.status === 'playing') {
          this.hitRegions.push({
            x: bx,
            y: by,
            w: bw,
            h: bh,
            onTap: () => void this.runAd('unlock_order_box', () => this.session.unlockAdOrderSlot()),
          });
        }
      } else if (slot.order) {
        this.drawRoundRect(bx, by, bw, bh, 20, '#FFFDF9', '#3D2B24', 4);
        const def = ITEM_BY_ID[slot.order.itemId];
        this.drawImg(`resources/${def.spriteResource}.png`, bx + 18, by + 16, 62, 62);
        ctx.fillStyle = '#3D2B24';
        ctx.font = 'bold 21px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(def.name, bx + 90, by + 56);
        ctx.textAlign = 'center';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillStyle = '#4E8A5A';
        ctx.fillText(`${slot.collectedCount}/${slot.order.requiredCount}`, bx + bw / 2, by + 110);
      } else {
        this.drawRoundRect(bx, by, bw, bh, 20, '#EDF6EC', '#3D2B24', 4);
        this.drawImg('resources/ui/icon_check.png', bx + 86, by + 28, 48, 48);
        ctx.fillStyle = '#4E8A5A';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('已清完', bx + bw / 2, by + 106);
      }
    });

    // Bottom tray
    this.drawRoundRect(18, 1028, 684, 104, 24, '#F2DFC6', '#3D2B24', 4);
    for (let i = 0; i < snap.trayMaxSlots; i++) {
      const tx = 30 + i * 95;
      const ty = 1038;
      const unlocked = i < snap.trayUnlockedSlots;
      const item = snap.tray[i];
      if (!unlocked) {
        this.drawRoundRect(tx, ty, 84, 84, 16, 'rgba(252,150,81,0.18)', '#E87630', 3);
        this.drawImg('resources/ui/icon_ad.png', tx + 22, ty + 14, 40, 40);
        ctx.fillStyle = '#E87630';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('+1格', tx + 42, ty + 74);
        if (this.activeModal === 'none' && snap.status === 'playing') {
          this.hitRegions.push({
            x: tx,
            y: ty,
            w: 84,
            h: 84,
            onTap: () => void this.runAd('unlock_tray_slot', () => this.session.unlockAdTraySlot()),
          });
        }
      } else {
        this.drawRoundRect(tx, ty, 84, 84, 16, '#FFFDF9', '#3D2B24', 3);
        if (item) {
          const def = ITEM_BY_ID[item.itemId];
          this.drawImg(`resources/${def.spriteResource}.png`, tx + 8, ty + 8, 68, 68);
        }
      }
    }

    // Bottom 4 custom icon boosters
    const boosters: Array<{ type: BoosterType; icon: string; name: string }> = [
      { type: 'magnet', icon: 'resources/ui/icon_magnet.png', name: '磁铁' },
      { type: 'undo', icon: 'resources/ui/icon_undo.png', name: '撤销' },
      { type: 'hint', icon: 'resources/ui/icon_hint.png', name: '提示' },
      { type: 'shuffle', icon: 'resources/ui/icon_shuffle.png', name: '洗牌' },
    ];
    boosters.forEach((b, i) => {
      const bx = 22 + i * 172;
      const by = 1148;
      const bw = 158;
      const bh = 112;
      this.drawRoundRect(bx, by, bw, bh, 22, '#FFFDF9', '#3D2B24', 4);
      this.drawImg(b.icon, bx + 47, by + 12, 64, 64);
      ctx.fillStyle = '#3D2B24';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, bx + bw / 2, by + 99);

      const cnt = snap.boosters[b.type];
      this.drawRoundRect(bx + bw - 38, by - 8, 38, 32, 16, cnt > 0 ? '#FC9651' : '#4FA1DA', '#3D2B24', 3);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(cnt > 0 ? String(cnt) : 'AD', bx + bw - 19, by + 15);

      if (this.activeModal === 'none' && snap.status === 'playing') {
        this.hitRegions.push({
          x: bx,
          y: by,
          w: bw,
          h: bh,
          onTap: () => {
            if (snap.boosters[b.type] > 0) {
              this.session.useBooster(b.type);
              this.saveData.boosters = this.session.getBoosters();
              this.platform.saveProgress(this.saveData);
            } else {
              void this.runAd(`booster_${b.type}` as AdPlacement, () => {
                this.session.addBoosterStock(b.type, 1);
                this.session.useBooster(b.type);
                this.saveData.boosters = this.session.getBoosters();
                this.platform.saveProgress(this.saveData);
              });
            }
          },
        });
      }
    });
  }

  private renderOverlay(snap: SessionSnapshot): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(34, 24, 20, 0.58)';
    ctx.fillRect(0, 0, LOGIC_W, LOGIC_H);

    this.drawRoundRect(56, 260, 608, 720, 32, '#FFFDF9', '#3D2B24', 5);
    ctx.textAlign = 'center';

    if (this.activeModal === 'settings') {
      ctx.fillStyle = '#3D2B24';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(this.screen === 'game' ? '暂停与设置' : '系统设置', 360, 324);
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#755C50';
      ctx.fillText(`管家 ID: ${this.saveData.userId}`, 360, 362);

      // Sound toggle
      this.drawRoundRect(96, 392, 528, 70, 18, '#FFF6E8', '#3D2B24', 3);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#3D2B24';
      ctx.font = 'bold 23px sans-serif';
      ctx.fillText('游戏音效', 120, 436);
      this.drawRoundRect(496, 406, 110, 42, 21, this.saveData.muted ? '#9B8F86' : '#4E8A5A', '#3D2B24', 3);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(this.saveData.muted ? '关闭' : '开启', 551, 434);

      // Vibration toggle
      this.drawRoundRect(96, 478, 528, 70, 18, '#FFF6E8', '#3D2B24', 3);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#3D2B24';
      ctx.fillText('触感震动反馈', 120, 522);
      this.drawRoundRect(496, 492, 110, 42, 21, this.saveData.vibrationEnabled ? '#4E8A5A' : '#9B8F86', '#3D2B24', 3);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(this.saveData.vibrationEnabled ? '开启' : '关闭', 551, 520);

      // Privacy
      this.drawRoundRect(96, 566, 528, 66, 18, '#F4EDE2', '#3D2B24', 3);
      ctx.fillStyle = '#3D2B24';
      ctx.fillText('隐私保护指引', 360, 608);

      // Reset
      this.drawRoundRect(96, 646, 528, 66, 18, this.confirmReset ? '#D9533B' : '#FBE6E2', '#3D2B24', 3);
      ctx.fillStyle = this.confirmReset ? '#FFFFFF' : '#D9533B';
      ctx.fillText(this.confirmReset ? '再次点击确认清空进度!' : '重置全部游戏进度', 360, 688);

      this.hitRegions.push(
        {
          x: 496,
          y: 406,
          w: 110,
          h: 42,
          onTap: () => {
            this.saveData.muted = !this.saveData.muted;
            this.platform.saveProgress(this.saveData);
          },
        },
        {
          x: 496,
          y: 492,
          w: 110,
          h: 42,
          onTap: () => {
            this.saveData.vibrationEnabled = !this.saveData.vibrationEnabled;
            this.platform.saveProgress(this.saveData);
            this.triggerVibrate('light');
          },
        },
        { x: 96, y: 566, w: 528, h: 66, onTap: () => (this.activeModal = 'privacy') },
        {
          x: 96,
          y: 646,
          w: 528,
          h: 66,
          onTap: () => {
            if (!this.confirmReset) {
              this.confirmReset = true;
              return;
            }
            this.platform.clearSave();
            this.saveData = syncDailyReset(this.platform.loadSave());
            this.startLevel(1);
            this.screen = 'home';
          },
        }
      );

      if (this.screen === 'game') {
        this.drawRoundRect(96, 736, 254, 72, 20, '#FC9651', '#3D2B24', 4);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('继续整理', 223, 780);
        this.drawRoundRect(370, 736, 254, 72, 20, '#EDF6EC', '#3D2B24', 4);
        ctx.fillStyle = '#3D2B24';
        ctx.fillText('重玩本关', 497, 780);
        this.drawRoundRect(160, 826, 400, 68, 20, '#F4EDE2', '#3D2B24', 4);
        ctx.fillText('返回首页大厅', 360, 868);

        this.hitRegions.push(
          { x: 96, y: 736, w: 254, h: 72, onTap: () => (this.activeModal = 'none') },
          { x: 370, y: 736, w: 254, h: 72, onTap: () => this.startLevel(snap.levelNumber) },
          {
            x: 160,
            y: 826,
            w: 400,
            h: 68,
            onTap: () => {
              this.activeModal = 'none';
              this.screen = 'home';
            },
          }
        );
      } else {
        this.drawRoundRect(180, 826, 360, 72, 22, '#FC9651', '#3D2B24', 4);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('关闭', 360, 870);
        this.hitRegions.push({ x: 180, y: 826, w: 360, h: 72, onTap: () => (this.activeModal = 'none') });
      }
      return;
    }

    if (this.activeModal === 'rooms') {
      const maxUnlocked = Math.max(this.saveData.highestLevel, this.saveData.currentLevel);
      ctx.fillStyle = '#3D2B24';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('房间与关卡选择', 360, 324);
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#755C50';
      ctx.fillText(`已解锁至第 ${maxUnlocked} 关 (点击即可进入)`, 360, 362);

      const startLv = Math.max(1, maxUnlocked - 8);
      for (let i = 0; i < 9 && startLv + i <= maxUnlocked; i++) {
        const lv = startLv + i;
        const col = i % 3;
        const row = Math.floor(i / 3);
        const bx = 94 + col * 182;
        const by = 400 + row * 136;
        const bw = 164;
        const bh = 116;
        const room = ROOM_CATALOG[ROOM_ORDER[(lv - 1) % ROOM_ORDER.length]];
        const stars = this.saveData.levelStars[lv] ?? 0;
        this.drawRoundRect(bx, by, bw, bh, 18, lv === this.saveData.currentLevel ? '#FFF0DB' : '#FFF6E8', '#3D2B24', 3.5);
        ctx.fillStyle = '#3D2B24';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(`第 ${lv} 关`, bx + bw / 2, by + 40);
        ctx.fillStyle = '#755C50';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(room.name, bx + bw / 2, by + 68);
        ctx.fillStyle = '#FC9651';
        ctx.fillText(`${stars > 0 ? `${stars} 星` : '未通关'}`, bx + bw / 2, by + 98);
        this.hitRegions.push({
          x: bx,
          y: by,
          w: bw,
          h: bh,
          onTap: () => {
            this.startLevel(lv);
            this.screen = 'game';
          },
        });
      }

      this.drawRoundRect(180, 844, 360, 72, 22, '#F4EDE2', '#3D2B24', 4);
      ctx.fillStyle = '#3D2B24';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('返回', 360, 888);
      this.hitRegions.push({ x: 180, y: 844, w: 360, h: 72, onTap: () => (this.activeModal = 'none') });
      return;
    }

    if (this.activeModal === 'help') {
      ctx.fillStyle = '#3D2B24';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('玩法说明', 360, 326);
      const lines = [
        '1. 点中订单目标直接打包，非目标暂存底部槽位',
        '2. 封口快递箱连点 2 次拆开会弹出新物品',
        '3. 橘猫每局免费帮 1 次，可通过每日/闯关领猫条',
        '4. 停电关滑动屏幕移动暖光手电筒照亮房间',
      ];
      ctx.textAlign = 'left';
      lines.forEach((line, i) => {
        this.drawRoundRect(88, 376 + i * 102, 544, 84, 18, '#FFF6E8', '#3D2B24', 3);
        ctx.fillStyle = '#3D2B24';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(line, 110, 426 + i * 102);
      });
      ctx.textAlign = 'center';
      this.drawRoundRect(160, 826, 400, 76, 22, '#FC9651', '#3D2B24', 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('我知道了', 360, 872);
      this.hitRegions.push({ x: 160, y: 826, w: 400, h: 76, onTap: () => (this.activeModal = 'none') });
      return;
    }

    if (this.activeModal === 'privacy') {
      ctx.fillStyle = '#3D2B24';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText('隐私保护指引', 360, 328);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#755C50';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('1. 仅在本地缓存关卡进度、星级与设置偏好。', 96, 410);
      ctx.fillText('2. 震动反馈仅在开启设置时触发，不采集敏感权限。', 96, 466);
      ctx.fillText('3. 所有激励视频广告仅在用户主动点击时弹出。', 96, 522);
      ctx.textAlign = 'center';
      this.drawRoundRect(180, 820, 360, 74, 22, '#FC9651', '#3D2B24', 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 25px sans-serif';
      ctx.fillText('返回设置', 360, 865);
      this.hitRegions.push({ x: 180, y: 820, w: 360, h: 74, onTap: () => (this.activeModal = 'settings') });
      return;
    }

    if (this.activeModal === 'daily') {
      const freeLeft = Math.max(0, DAILY_FREE_LIMIT - this.saveData.dailyFreeClaimed);
      const clearsLeft = getClearsUntilNextPetReward(this.saveData);
      ctx.fillStyle = '#3D2B24';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText('每日补给与管家档案', 360, 340);
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#755C50';
      ctx.fillText(`猫条库存: ${this.saveData.petTreats} · 累计通关: ${this.saveData.totalLevelsCleared}`, 360, 404);
      ctx.fillText(`再闯 ${clearsLeft}/${CLEARS_PER_PET_REWARD} 关送 +1 摸猫机会`, 360, 448);

      this.drawRoundRect(110, 520, 500, 82, 22, freeLeft > 0 ? '#FC9651' : '#CFC7BE', '#3D2B24', 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(freeLeft > 0 ? `免费领取 +1 (余 ${freeLeft}/${DAILY_FREE_LIMIT})` : '今日免费已领完', 360, 570);

      this.drawRoundRect(110, 628, 500, 78, 22, '#4FA1DA', '#3D2B24', 4);
      ctx.fillText('看广告额外领 +1', 360, 676);

      this.drawRoundRect(180, 754, 360, 68, 20, '#F4EDE2', '#3D2B24', 4);
      ctx.fillStyle = '#3D2B24';
      ctx.fillText('返回', 360, 796);

      this.hitRegions.push(
        {
          x: 110,
          y: 520,
          w: 500,
          h: 82,
          onTap: () => {
            const res = claimDailyFree(this.saveData);
            if (res.ok) {
              this.saveData = res.save;
              this.platform.saveProgress(this.saveData);
            }
          },
        },
        {
          x: 110,
          y: 628,
          w: 500,
          h: 78,
          onTap: () => {
            void this.runAd('daily_cat_bonus', () => {
              const res = claimDailyAdBonus(this.saveData);
              if (res.ok) {
                this.saveData = res.save;
                this.platform.saveProgress(this.saveData);
              }
            });
          },
        },
        { x: 180, y: 754, w: 360, h: 68, onTap: () => (this.activeModal = 'none') }
      );
      return;
    }

    if (this.activeModal === 'cat_ad') {
      ctx.fillStyle = '#3D2B24';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText('让橘猫看广告继续帮忙?', 360, 380);
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#755C50';
      ctx.fillText('本局免费次数或猫条不足', 360, 444);

      this.drawRoundRect(110, 540, 500, 84, 22, '#FC9651', '#3D2B24', 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 25px sans-serif';
      ctx.fillText('看激励视频叼回 1 个目标', 360, 592);

      this.drawRoundRect(180, 670, 360, 68, 20, '#F4EDE2', '#3D2B24', 4);
      ctx.fillStyle = '#3D2B24';
      ctx.fillText('自己找找', 360, 712);

      this.hitRegions.push(
        {
          x: 110,
          y: 540,
          w: 500,
          h: 84,
          onTap: () => {
            this.activeModal = 'none';
            void this.runAd('cat_pet_extra', () => this.session.grantAdCatGift());
          },
        },
        { x: 180, y: 670, w: 360, h: 68, onTap: () => (this.activeModal = 'none') }
      );
      return;
    }

    if (snap.status === 'won') {
      ctx.fillStyle = '#3D2B24';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(`第 ${snap.levelNumber} 关 收纳大成功!`, 360, 380);
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#E87630';
      ctx.fillText(
        this.lastMilestoneGranted > 0 ? '闯关里程碑达成！摸猫机会 +1' : `累计通关 ${this.saveData.totalLevelsCleared} 关`,
        360,
        444
      );

      this.drawRoundRect(110, 560, 500, 88, 24, '#FC9651', '#3D2B24', 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(`进入第 ${snap.levelNumber + 1} 关`, 360, 614);

      this.drawRoundRect(180, 684, 360, 68, 20, '#F4EDE2', '#3D2B24', 4);
      ctx.fillStyle = '#3D2B24';
      ctx.fillText('返回首页', 360, 726);

      this.hitRegions.push(
        { x: 110, y: 560, w: 500, h: 88, onTap: () => this.startLevel(snap.levelNumber + 1) },
        {
          x: 180,
          y: 684,
          w: 360,
          h: 68,
          onTap: () => {
            this.screen = 'home';
            this.startLevel(this.saveData.currentLevel);
          },
        }
      );
    } else if (snap.status === 'failed_tray_full') {
      ctx.fillStyle = '#3D2B24';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('暂存槽满啦!', 360, 380);

      this.drawRoundRect(110, 540, 500, 86, 24, '#FC9651', '#3D2B24', 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('看广告复活（移出 3 件）', 360, 594);

      this.drawRoundRect(180, 668, 360, 68, 20, '#F4EDE2', '#3D2B24', 4);
      ctx.fillStyle = '#3D2B24';
      ctx.fillText('重新开始', 360, 710);

      this.hitRegions.push(
        {
          x: 110,
          y: 540,
          w: 500,
          h: 86,
          onTap: () => void this.runAd('revive_clear_tray', () => this.session.reviveClearTray(3)),
        },
        { x: 180, y: 668, w: 360, h: 68, onTap: () => this.startLevel(snap.levelNumber) }
      );
    }
  }
}

new NativeMiniGameRuntime();

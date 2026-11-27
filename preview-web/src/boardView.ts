import {
  type BoardCamera,
  boardToViewport,
  createDefaultCamera,
  MAX_ZOOM,
  MIN_ZOOM,
  panCameraBy,
  pinchDistance,
  pinchMidpoint,
  viewportToBoard,
  ZOOM_STEP,
  zoomCameraBy,
  zoomCameraTo,
} from '@core/camera';
import { drawAnimatedCat, PET_REACTION_DURATION_SEC, sliceTypedText } from '@core/catAnimation';
import { getItemSprite, ITEM_BY_ID } from '@core/catalogs';
import { compareBoardItemOrder, REF_BOX_BASE_SIZE, REF_ITEM_BASE_SIZE } from '@core/levelGenerator';
import type { GameSession } from '@core/gameSession';
import type { PetCatState, SaveData, SessionSnapshot } from '@core/types';
import { computeAspectDimensions, computeItemVisualDepth, computePileGroundShadows } from '@core/visualDepth';
import { AlphaMaskStore, hitTestRotatedSprite, type RotatedSpriteBox } from '@shared/alphaHitTest';
import { WEB_UI_ICONS } from '@shared/constants';
import { computeCatBadgeState, getActiveOrderItemIds, isBoardItemHinted } from '@shared/hudViewModel';
import type { ShellElements } from './shellTemplate';

export interface WebBoardViewDeps {
  el: ShellElements;
  getSession: () => GameSession | undefined;
  getSaveData: () => SaveData;
  getScreen: () => 'home' | 'game';
  isSimulationPaused: () => boolean;
  onUnlockAudio: () => void;
  onPlaySfx: (name: 'pick') => void;
  onVibrate: (style?: 'light' | 'medium' | 'heavy') => void;
  onPetCatClick: () => void;
  onRender: () => void;
}

export class WebBoardView {
  private camera: BoardCamera = createDefaultCamera();
  private activePointers = new Map<number, { x: number; y: number }>();
  private panStart: { x: number; y: number; cam: BoardCamera; moved: boolean } | null = null;
  private pinchStartDist = 0;
  private pinchStartZoom = 1;
  private pinchMoved = false;
  private suppressTapUntilMs = 0;
  private isCameraNavigating = false;
  private cameraTransformRafId: number | null = null;
  private cachedBoardRect: DOMRect | null = null;
  private lastZoomText = '';
  private lastZoomInDisabled: boolean | null = null;
  private lastZoomOutDisabled: boolean | null = null;

  private blackoutOverride: boolean | null = null;
  private blackoutActive = false;
  private flashNormX = 0.5;
  private flashNormY = 0.56;
  private flashBurstUids = new Set<string>();
  private inFlightBoardUids = new Set<string>();

  private gameBubbleLastText: string | null = null;
  private gameBubbleElapsedSec = 0;
  private gamePetReactSec = 0;
  private lastRenderedBubbleKey = '';
  private lastCatDrawTimeSec = -999;
  private lastCatDrawMood: PetCatState['mood'] | '' = '';
  private lastCatDrawTalking = false;
  private lastCatDrawReacting = false;
  private readonly alphaMaskStore = new AlphaMaskStore((w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  });
  private renderedHitItems: Array<{
    uid: string;
    spriteUrl: string;
    box: RotatedSpriteBox;
    imgEl: HTMLImageElement;
  }> = [];

  constructor(private readonly deps: WebBoardViewDeps) {
    this.bindControls();
  }

  private resolveHitUidForClick(e: MouseEvent, fallbackUid: string): string | null {
    if (!e.isTrusted || (e.clientX === 0 && e.clientY === 0) || this.renderedHitItems.length === 0) {
      return fallbackUid;
    }
    const boardRect = this.deps.el.boardEl.getBoundingClientRect();
    if (boardRect.width <= 0 || boardRect.height <= 0) {
      return fallbackUid;
    }
    const vpX = (e.clientX - boardRect.left) / boardRect.width;
    const vpY = (e.clientY - boardRect.top) / boardRect.height;
    const boardPt = viewportToBoard({ x: vpX, y: vpY }, this.camera);
    const px = boardPt.x * boardRect.width;
    const py = boardPt.y * boardRect.height;
    for (let i = this.renderedHitItems.length - 1; i >= 0; i--) {
      const candidate = this.renderedHitItems[i];
      const mask = this.alphaMaskStore.getMask(candidate.spriteUrl, candidate.imgEl);
      if (hitTestRotatedSprite(px, py, candidate.box, mask)) {
        return candidate.uid;
      }
    }
    return null;
  }

  getZoom(): number {
    return this.camera.zoom;
  }

  getBoardRefScale(): number {
    const w = this.deps.el.boardEl.clientWidth || this.deps.el.shellEl.clientWidth || 390;
    return w / 720;
  }

  resetForLevel(): void {
    this.activePointers.clear();
    this.panStart = null;
    this.pinchMoved = false;
    this.pinchStartDist = 0;
    this.cachedBoardRect = null;
    this.setCameraNavigating(false);
    if (this.cameraTransformRafId !== null) {
      cancelAnimationFrame(this.cameraTransformRafId);
      this.cameraTransformRafId = null;
    }
    this.camera = createDefaultCamera();
    this.applyCameraTransform();
    this.blackoutOverride = null;
    this.blackoutActive = false;
    this.flashBurstUids.clear();
    this.inFlightBoardUids.clear();
    this.gameBubbleLastText = null;
    this.gameBubbleElapsedSec = 0;
    this.gamePetReactSec = 0;
    this.lastRenderedBubbleKey = '';
    this.lastCatDrawTimeSec = -999;
    this.lastCatDrawMood = '';
  }

  private setCameraNavigating(active: boolean): void {
    if (this.isCameraNavigating === active) return;
    this.isCameraNavigating = active;
    this.deps.el.boardEl.classList.toggle('is-navigating', active);
  }

  triggerPetReaction(): void {
    this.gamePetReactSec = PET_REACTION_DURATION_SEC;
    this.lastCatDrawTimeSec = -999;
  }

  tick(dtSec: number): void {
    this.gamePetReactSec = Math.max(0, this.gamePetReactSec - dtSec);
  }

  advanceBubbleTyping(bubbleText: string | null, dtSec: number): void {
    if (bubbleText && bubbleText === this.gameBubbleLastText) {
      this.gameBubbleElapsedSec += dtSec;
    }
  }

  toggleBlackout(): void {
    const snap = this.deps.getSession()?.getSnapshot();
    if (!snap) return;
    this.blackoutOverride = !this.isBlackoutActive(snap);
    this.drawFlashlight(snap);
  }

  isBlackoutActive(snap: SessionSnapshot): boolean {
    if (this.blackoutOverride !== null) return this.blackoutOverride;
    return snap.modifiers.includes('blackout_flashlight');
  }

  flashBlockers(blockerUids: string[]): void {
    blockerUids.forEach((uid) => this.flashBurstUids.add(uid));
    setTimeout(() => {
      blockerUids.forEach((uid) => this.flashBurstUids.delete(uid));
      const snap = this.deps.getSession()?.getSnapshot();
      if (snap) this.renderItems(snap);
    }, 420);
  }

  setBoardItemInFlight(uid: string, inFlight: boolean): void {
    if (!uid) return;
    if (inFlight) {
      this.inFlightBoardUids.add(uid);
    } else {
      this.inFlightBoardUids.delete(uid);
      const boardItemEl = this.deps.el.itemsLayerEl.querySelector<HTMLElement>(`[data-uid="${uid}"]`);
      if (boardItemEl) boardItemEl.style.opacity = '1';
    }
  }

  getScreenRectForBoardNorm(
    nx: number,
    ny: number,
    sizePx = Math.round(REF_ITEM_BASE_SIZE * this.getBoardRefScale())
  ): DOMRect {
    const boardRect = this.deps.el.boardEl.getBoundingClientRect();
    const vp = boardToViewport({ x: nx, y: ny }, this.camera);
    const half = sizePx * 0.5;
    return new DOMRect(
      boardRect.left + vp.x * boardRect.width - half,
      boardRect.top + vp.y * boardRect.height - half,
      sizePx,
      sizePx
    );
  }

  private scheduleCameraTransform(): void {
    if (this.cameraTransformRafId !== null) return;
    this.cameraTransformRafId = requestAnimationFrame(() => {
      this.cameraTransformRafId = null;
      this.applyCameraTransform();
    });
  }

  applyCameraTransform(): void {
    const { el } = this.deps;
    el.boardViewportEl.style.transform = `translate3d(${(this.camera.panX * 100).toFixed(3)}%, ${(
      this.camera.panY * 100
    ).toFixed(3)}%, 0) scale(${this.camera.zoom.toFixed(4)})`;
    const zoomText = `${this.camera.zoom.toFixed(1)}×`;
    if (zoomText !== this.lastZoomText) {
      this.lastZoomText = zoomText;
      el.zoomLabelEl.textContent = zoomText;
    }
    const zoomInDisabled = this.camera.zoom >= MAX_ZOOM - 0.01;
    if (zoomInDisabled !== this.lastZoomInDisabled) {
      this.lastZoomInDisabled = zoomInDisabled;
      el.zoomInBtnEl.disabled = zoomInDisabled;
    }
    const zoomOutDisabled = this.camera.zoom <= MIN_ZOOM + 0.01;
    if (zoomOutDisabled !== this.lastZoomOutDisabled) {
      this.lastZoomOutDisabled = zoomOutDisabled;
      el.zoomOutBtnEl.disabled = zoomOutDisabled;
    }
  }

  renderItems(snap: SessionSnapshot): void {
    const { el } = this.deps;
    const onBoard = snap.items.filter((it) => it.state === 'on_board').sort(compareBoardItemOrder);
    const unopenedBoxes = snap.boxes.filter((b) => !b.opened);

    el.pileShadowsLayerEl.innerHTML = '';
    for (const groundShadow of computePileGroundShadows(onBoard, unopenedBoxes)) {
      const shEl = document.createElement('div');
      shEl.className = 'pile-shadow';
      shEl.style.left = `${groundShadow.x * 100}%`;
      shEl.style.top = `${groundShadow.y * 100}%`;
      shEl.style.width = `${groundShadow.rxNorm * 200}%`;
      shEl.style.height = `${groundShadow.ryNorm * 200}%`;
      shEl.style.opacity = groundShadow.alpha.toFixed(3);
      el.pileShadowsLayerEl.appendChild(shEl);
    }

    const activeIds = getActiveOrderItemIds(snap);
    const refScale = this.getBoardRefScale();
    const stageW = el.boardEl.clientWidth || el.shellEl.clientWidth || 390;
    const stageH = el.boardEl.clientHeight || el.shellEl.clientHeight || 690;
    this.renderedHitItems = [];
    el.itemsLayerEl.innerHTML = '';

    for (let idx = 0; idx < onBoard.length; idx++) {
      const item = onBoard[idx];
      const def = ITEM_BY_ID[item.itemId];
      const spriteMeta = getItemSprite(item.itemId, item.variantIndex ?? 0);
      const depth = computeItemVisualDepth(item);
      const isBlocked = depth.occlusionTier > 0;
      const isHinted = isBoardItemHinted(item, depth.occlusionTier, snap, activeIds);
      const isBlockerFlash =
        this.flashBurstUids.has(item.uid) || snap.highlightedBlockerUids.includes(item.uid);

      const itemEl = document.createElement('div');
      itemEl.className = `board-item ${isBlocked ? 'blocked' : 'unblocked'} ${item.isGolden ? 'golden' : ''} ${
        isHinted ? 'hint-target' : ''
      } ${isBlockerFlash ? 'blocker-flash' : ''}`;
      itemEl.dataset.uid = item.uid;
      itemEl.dataset.tier = String(depth.occlusionTier);
      const baseSizePx =
        REF_ITEM_BASE_SIZE * refScale * item.scale * (def.visualScale ?? 1) * depth.scaleFactor;
      const aspect = item.aspectRatio ?? spriteMeta.aspectRatio ?? def.aspectRatio ?? 1;
      const { width: rawWidthPx, height: rawHeightPx } = computeAspectDimensions(baseSizePx, aspect);
      const widthPx = Math.round(rawWidthPx);
      const heightPx = Math.round(rawHeightPx);
      itemEl.style.width = `${widthPx}px`;
      itemEl.style.height = `${heightPx}px`;
      itemEl.style.left = `${item.x * 100}%`;
      itemEl.style.top = `${item.y * 100}%`;
      itemEl.style.setProperty('--lift', `${depth.liftPxWeb.toFixed(2)}px`);
      itemEl.style.setProperty('--item-opacity', depth.opacity.toFixed(3));
      itemEl.style.setProperty('--item-grayscale', depth.grayscale.toFixed(3));
      itemEl.style.setProperty('--item-brightness', depth.brightness.toFixed(3));
      itemEl.style.setProperty('--item-saturate', depth.saturate.toFixed(3));
      itemEl.style.setProperty('--item-contrast', depth.contrast.toFixed(3));
      itemEl.style.setProperty('--shadow-x', `${depth.shadowXWeb.toFixed(2)}px`);
      itemEl.style.setProperty('--shadow-y', `${depth.shadowYWeb.toFixed(2)}px`);
      itemEl.style.setProperty('--shadow-blur', `${depth.shadowBlurWeb.toFixed(2)}px`);
      itemEl.style.setProperty('--cast-alpha', depth.castAlpha.toFixed(3));
      itemEl.style.setProperty('--contact-alpha', depth.contactAlpha.toFixed(3));
      itemEl.style.transform = `translate(-50%, calc(-50% - var(--lift))) rotate(${item.rotation}deg)`;
      itemEl.style.zIndex = String(10 + idx);
      if (this.inFlightBoardUids.has(item.uid)) {
        itemEl.style.opacity = '0';
      }
      const itemSpriteUrl = spriteMeta.spriteWebUrl;
      itemEl.innerHTML = item.isGolden
        ? `<img src="${itemSpriteUrl}" alt="${def.name}" /><span class="golden-coin-tag"><img src="${WEB_UI_ICONS.coin}" alt="" /></span>`
        : `<img src="${itemSpriteUrl}" alt="${def.name}" />`;

      const imgEl = itemEl.querySelector('img') as HTMLImageElement;
      if (!this.inFlightBoardUids.has(item.uid)) {
        this.renderedHitItems.push({
          uid: item.uid,
          spriteUrl: itemSpriteUrl,
          imgEl,
          box: {
            cx: item.x * stageW,
            cy: item.y * stageH - depth.liftPxWeb,
            w: widthPx,
            h: heightPx,
            rotationDeg: item.rotation,
          },
        });
      }

      itemEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (performance.now() < this.suppressTapUntilMs) return;
        const targetUid = this.resolveHitUidForClick(e, item.uid);
        if (!targetUid) return;
        this.deps.getSession()?.tapItem(targetUid);
        this.deps.onRender();
      });

      el.itemsLayerEl.appendChild(itemEl);
    }
  }

  renderBoxes(snap: SessionSnapshot): void {
    const { el } = this.deps;
    const refScale = this.getBoardRefScale();
    el.boxesLayerEl.innerHTML = '';
    for (const box of snap.boxes) {
      if (box.opened) continue;
      const boxEl = document.createElement('div');
      boxEl.className = 'cardboard-box';
      boxEl.dataset.boxUid = box.uid;
      const sizePx = Math.round(REF_BOX_BASE_SIZE * refScale * box.scale);
      boxEl.style.width = `${sizePx}px`;
      boxEl.style.height = `${sizePx}px`;
      boxEl.style.left = `${box.x * 100}%`;
      boxEl.style.top = `${box.y * 100}%`;
      const imgUrl =
        box.hitsLeft < box.maxHits
          ? '/resources/sprites/cardboard_cracked.png'
          : '/resources/sprites/cardboard_closed.png';
      const label = box.maxHits >= 3 ? `加固 ×${box.hitsLeft}` : `拆箱 ×${box.hitsLeft}`;
      boxEl.innerHTML = `
        <img src="${imgUrl}" alt="快递箱" />
        <div class="cardboard-badge ${box.maxHits >= 3 ? 'heavy' : ''}">${label}</div>
      `;
      boxEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (performance.now() < this.suppressTapUntilMs) return;
        this.deps.getSession()?.tapBox(box.uid);
        this.deps.onRender();
      });
      el.boxesLayerEl.appendChild(boxEl);
    }
  }

  renderPet(snap: SessionSnapshot, animTimeSec: number): void {
    const { el } = this.deps;
    const pet = snap.pet;
    el.petEl.style.display = pet.enabled ? 'block' : 'none';
    if (!pet.enabled) return;

    el.petEl.classList.toggle('mischief', pet.mood === 'mischief');

    if (pet.bubbleText !== this.gameBubbleLastText) {
      this.gameBubbleLastText = pet.bubbleText;
      this.gameBubbleElapsedSec = 0;
      this.lastRenderedBubbleKey = '';
      if (pet.bubbleText) {
        el.petBubbleEl.classList.remove('pop-in');
        void el.petBubbleEl.offsetWidth;
        el.petBubbleEl.classList.add('pop-in');
      }
    }

    this.updateCatCanvasAndBubble(pet, animTimeSec, true);

    const badge = computeCatBadgeState(pet, this.deps.getSaveData().petTreats);
    el.petBadgeEl.style.display = 'flex';
    el.petBadgeEl.classList.remove('ad-mode', 'done-mode');

    if (badge.mode === 'treat') {
      el.petBadgeEl.innerHTML = `<img class="ui-ico" style="width:13px;height:13px" src="${WEB_UI_ICONS.paw}" alt="" /> ${badge.text}`;
    } else if (badge.mode === 'missing_treat') {
      el.petBadgeEl.classList.add('ad-mode');
      el.petBadgeEl.innerHTML = `<img class="ui-ico" style="width:13px;height:13px" src="${WEB_UI_ICONS.catTreat}" alt="" /> ${badge.text}`;
    } else if (badge.mode === 'ad') {
      el.petBadgeEl.classList.add('ad-mode');
      el.petBadgeEl.innerHTML = `<img class="ui-ico" style="width:13px;height:13px" src="${
        badge.shareUnlock ? WEB_UI_ICONS.share : WEB_UI_ICONS.ad
      }" alt="" /> ${badge.text}`;
    } else {
      el.petBadgeEl.classList.add('done-mode');
      el.petBadgeEl.textContent = badge.text;
    }
  }

  updateCatCanvasAndBubble(
    pet: Pick<PetCatState, 'enabled' | 'mood' | 'bubbleText'>,
    animTimeSec: number,
    forceCanvasRedraw = false
  ): void {
    const { el } = this.deps;
    if (!pet.enabled) return;

    let isTyping = false;
    if (pet.bubbleText) {
      const typed = sliceTypedText(pet.bubbleText, this.gameBubbleElapsedSec);
      isTyping = typed.typing;
      const bubbleKey = `${pet.bubbleText}::${typed.visibleText}::${typed.typing ? 1 : 0}`;
      if (bubbleKey !== this.lastRenderedBubbleKey) {
        this.lastRenderedBubbleKey = bubbleKey;
        el.petBubbleEl.style.display = 'grid';
        el.petBubbleEl.innerHTML = '';
        const measure = document.createElement('span');
        measure.className = 'bubble-measure';
        measure.textContent = pet.bubbleText;
        const live = document.createElement('span');
        live.className = 'bubble-live';
        const txt = document.createElement('span');
        txt.textContent = typed.visibleText;
        live.appendChild(txt);
        if (typed.typing) {
          const caret = document.createElement('span');
          caret.className = 'bubble-caret';
          live.appendChild(caret);
        }
        el.petBubbleEl.appendChild(measure);
        el.petBubbleEl.appendChild(live);
      }
    } else if (this.lastRenderedBubbleKey !== '__none__') {
      this.lastRenderedBubbleKey = '__none__';
      el.petBubbleEl.style.display = 'none';
    }

    // Pause cat canvas repaints during active pinch/pan and throttle idle redraws to ~24fps
    if (this.isCameraNavigating && !forceCanvasRedraw) return;
    const reacting = this.gamePetReactSec > 0;
    const stateChanged =
      this.lastCatDrawMood !== pet.mood ||
      this.lastCatDrawTalking !== isTyping ||
      this.lastCatDrawReacting !== reacting;
    const minInterval = reacting ? 0.03 : 0.042;
    if (!forceCanvasRedraw && !stateChanged && Math.abs(animTimeSec - this.lastCatDrawTimeSec) < minInterval) {
      return;
    }

    const pctx = el.petCanvasEl.getContext('2d');
    if (pctx) {
      pctx.clearRect(0, 0, el.petCanvasEl.width, el.petCanvasEl.height);
      const reactProgress =
        this.gamePetReactSec > 0 ? 1 - this.gamePetReactSec / PET_REACTION_DURATION_SEC : 0;
      drawAnimatedCat(pctx, 110, 114, 204, {
        timeSec: animTimeSec,
        mood: pet.mood,
        talking: isTyping,
        petReactionProgress: reactProgress,
      });
      this.lastCatDrawTimeSec = animTimeSec;
      this.lastCatDrawMood = pet.mood;
      this.lastCatDrawTalking = isTyping;
      this.lastCatDrawReacting = reacting;
    }
  }

  drawFlashlight(snap: SessionSnapshot): void {
    const { el } = this.deps;
    const active = this.isBlackoutActive(snap) && snap.status === 'playing';
    this.blackoutActive = active;
    el.flashCanvas.style.display = active ? 'block' : 'none';
    if (!active) return;

    const w = el.boardEl.clientWidth || 390;
    const h = el.boardEl.clientHeight || 693;
    if (el.flashCanvas.width !== w || el.flashCanvas.height !== h) {
      el.flashCanvas.width = w;
      el.flashCanvas.height = h;
    }
    const ctx = el.flashCanvas.getContext('2d');
    if (!ctx) return;

    const cx = this.flashNormX * w;
    const cy = this.flashNormY * h;
    const radius = Math.min(w, h) * 0.31;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(14, 13, 28, 0.90)';
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'destination-out';
    const hole = ctx.createRadialGradient(cx, cy, radius * 0.28, cx, cy, radius);
    hole.addColorStop(0, 'rgba(0,0,0,1)');
    hole.addColorStop(0.7, 'rgba(0,0,0,0.88)');
    hole.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
    const warmRing = ctx.createRadialGradient(cx, cy, radius * 0.35, cx, cy, radius);
    warmRing.addColorStop(0, 'rgba(255, 224, 130, 0.14)');
    warmRing.addColorStop(1, 'rgba(255, 190, 90, 0)');
    ctx.fillStyle = warmRing;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  private updateFlashlightPointer(e: PointerEvent): void {
    if (!this.blackoutActive) return;
    const rect = this.cachedBoardRect ?? this.deps.el.boardEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.flashNormX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    this.flashNormY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const snap = this.deps.getSession()?.getSnapshot();
    if (snap && this.isBlackoutActive(snap)) {
      this.drawFlashlight(snap);
    }
  }

  private bindControls(): void {
    const { el } = this.deps;

    el.zoomInBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.camera = zoomCameraBy(this.camera, ZOOM_STEP);
      this.applyCameraTransform();
    });
    el.zoomOutBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.camera = zoomCameraBy(this.camera, -ZOOM_STEP);
      this.applyCameraTransform();
    });
    el.zoomLabelEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.camera.zoom > MIN_ZOOM) {
        this.camera = createDefaultCamera();
        this.applyCameraTransform();
      }
    });

    el.petEl.addEventListener('pointerdown', (e) => {
      if (this.deps.getScreen() !== 'game' || this.deps.isSimulationPaused()) return;
      e.stopPropagation();
      this.deps.onUnlockAudio();
    });

    el.petEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (performance.now() < this.suppressTapUntilMs) return;
      this.deps.onUnlockAudio();
      this.deps.onPetCatClick();
    });

    el.boardEl.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('.zoom-controls')) return;
      if ((e.target as HTMLElement).closest('.pet-cat')) return;
      this.cachedBoardRect = el.boardEl.getBoundingClientRect();
      this.updateFlashlightPointer(e);
      if (e.pointerType === 'mouse') {
        this.activePointers.clear();
      }
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.activePointers.size === 2) {
        const pts = [...this.activePointers.values()];
        this.pinchStartDist = Math.max(12, pinchDistance(pts[0], pts[1]));
        this.pinchStartZoom = this.camera.zoom;
        this.pinchMoved = true;
        this.panStart = null;
        this.setCameraNavigating(true);
      } else if (this.activePointers.size === 1) {
        this.pinchMoved = false;
        this.panStart = {
          x: e.clientX,
          y: e.clientY,
          cam: { ...this.camera },
          moved: false,
        };
      }
    });

    window.addEventListener('pointermove', (e) => {
      this.updateFlashlightPointer(e);
      if (!this.activePointers.has(e.pointerId)) return;
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const rect = this.cachedBoardRect ?? el.boardEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      if (this.activePointers.size >= 2 && this.pinchStartDist > 0) {
        const pts = [...this.activePointers.values()];
        const curDist = pinchDistance(pts[0], pts[1]);
        const mid = pinchMidpoint(pts[0], pts[1]);
        const focalVx = Math.max(0, Math.min(1, (mid.x - rect.left) / rect.width));
        const focalVy = Math.max(0, Math.min(1, (mid.y - rect.top) / rect.height));
        this.camera = zoomCameraTo(
          this.camera,
          this.pinchStartZoom * (curDist / this.pinchStartDist),
          focalVx,
          focalVy
        );
        this.setCameraNavigating(true);
        this.scheduleCameraTransform();
        return;
      }

      if (this.activePointers.size === 1 && this.panStart && this.camera.zoom > MIN_ZOOM) {
        const dx = e.clientX - this.panStart.x;
        const dy = e.clientY - this.panStart.y;
        if (!this.panStart.moved && Math.hypot(dx, dy) >= 14) {
          this.panStart.moved = true;
          this.setCameraNavigating(true);
        }
        if (this.panStart.moved) {
          this.camera = panCameraBy(this.panStart.cam, dx / rect.width, dy / rect.height);
          this.scheduleCameraTransform();
        }
      }
    });

    const onPointerEnd = (e: PointerEvent) => {
      if (this.panStart?.moved || this.pinchMoved) {
        this.suppressTapUntilMs = performance.now() + 120;
      }
      this.activePointers.delete(e.pointerId);
      if (this.activePointers.size < 2) {
        this.pinchStartDist = 0;
      }
      if (this.activePointers.size === 0) {
        this.panStart = null;
        this.pinchMoved = false;
        this.cachedBoardRect = null;
        this.setCameraNavigating(false);
      }
    };

    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    window.addEventListener('blur', () => {
      this.activePointers.clear();
      this.panStart = null;
      this.pinchMoved = false;
      this.pinchStartDist = 0;
      this.cachedBoardRect = null;
      this.setCameraNavigating(false);
    });

    el.boardEl.addEventListener(
      'wheel',
      (e) => {
        if (this.deps.getScreen() !== 'game' || this.deps.isSimulationPaused()) return;
        e.preventDefault();
        const rect = el.boardEl.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const vx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const vy = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        const delta = e.deltaY < 0 ? 0.2 : -0.2;
        this.camera = zoomCameraBy(this.camera, delta, vx, vy);
        this.scheduleCameraTransform();
      },
      { passive: false }
    );
  }
}

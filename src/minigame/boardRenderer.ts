import {
  type BoardCamera,
  CAMERA_PIVOT_X,
  CAMERA_PIVOT_Y,
  createDefaultCamera,
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
  zoomCameraBy,
} from '@core/camera';
import {
  drawAnimatedCat,
  drawAnimatedSpeechBubble,
  PET_REACTION_DURATION_SEC,
  sliceTypedText,
} from '@core/catAnimation';
import { getItemSprite, ITEM_BY_ID, ROOM_CATALOG } from '@core/catalogs';
import type { FlyingItemAnim } from '@core/flyAnimation';
import { compareBoardItemOrder, REF_BOX_BASE_SIZE, REF_ITEM_BASE_SIZE } from '@core/levelGenerator';
import type { BoardItemInstance, SaveData, SessionSnapshot } from '@core/types';
import { computeAspectDimensions, computeItemVisualDepth, computePileGroundShadows } from '@core/visualDepth';
import { getRotatedBounds, hitTestRotatedSprite } from '@shared/alphaHitTest';
import {
  computeCatBadgeState,
  getActiveOrderItemIds,
  isBoardItemHinted,
} from '@shared/hudViewModel';
import type { MiniGameAssetStore } from './assets';
import { drawFullScreenBg, drawImg, drawRoundRect, drawSoftCard } from './canvasPrimitives';
import {
  boardItemPos,
  type HitRect,
  type HudLayout,
  type MiniGameModal,
  REF_W,
  type StageMetrics,
} from './types';

interface DynamicBoardOverlay {
  uid: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotation: number;
  lift: number;
  opacity: number;
  drawable: any;
  isGolden: boolean;
  occlusionTier: number;
  isHinted: boolean;
  isBlockerFlash: boolean;
  isShaking: boolean;
}

const MAX_BOARD_CACHE_DIM = 1920;

export class BoardWorldCache {
  private canvas: any = null;
  private ctx: any = null;
  private signature = '';
  private cachedW = 0;
  private cachedH = 0;
  private hitRegions: HitRect[] = [];
  private dynamicOverlays: DynamicBoardOverlay[] = [];
  private onTapItemRef: (uid: string) => void = () => {};
  private onTapBoxRef: (uid: string) => void = () => {};

  clear(): void {
    this.signature = '';
    this.hitRegions = [];
    this.dynamicOverlays = [];
  }

  getHitRegions(): readonly HitRect[] {
    return this.hitRegions;
  }

  getDynamicOverlays(): readonly DynamicBoardOverlay[] {
    return this.dynamicOverlays;
  }

  setTapCallbacks(onTapItem: (uid: string) => void, onTapBox: (uid: string) => void): void {
    this.onTapItemRef = onTapItem;
    this.onTapBoxRef = onTapBox;
  }

  ensureUpToDate(deps: BoardRenderDeps): any | null {
    const { assets, metrics, snap } = deps;
    if (typeof assets.createOffscreenCanvas !== 'function') {
      return null;
    }

    const activeIds = getActiveOrderItemIds(snap);
    const loadVersion = typeof assets.getLoadVersion === 'function' ? assets.getLoadVersion() : 0;
    const sig = buildBoardCacheSignature(deps, activeIds, loadVersion);

    if (this.canvas && this.signature === sig) {
      return this.canvas;
    }

    const desiredScale = Math.min(1.6, Math.max(1.15, metrics.scale * metrics.dpr * 1.25));
    const maxAxis = Math.max(metrics.stageW, metrics.stageH, 1);
    const clampedScale = Math.min(desiredScale, MAX_BOARD_CACHE_DIM / maxAxis);
    const cw = Math.max(1, Math.round(metrics.stageW * clampedScale));
    const ch = Math.max(1, Math.round(metrics.stageH * clampedScale));

    if (!this.canvas || this.cachedW !== cw || this.cachedH !== ch) {
      this.canvas = assets.createOffscreenCanvas(cw, ch);
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.cachedW = cw;
      this.cachedH = ch;
    }
    if (!this.canvas || !this.ctx) {
      return null;
    }

    const cctx = this.ctx;
    cctx.save();
    cctx.setTransform(1, 0, 0, 1, 0, 0);
    cctx.clearRect(0, 0, cw, ch);
    cctx.scale(cw / metrics.stageW, ch / metrics.stageH);

    const built = drawStaticBoardContents(cctx, deps, activeIds, (uid) => this.onTapItemRef(uid), (uid) =>
      this.onTapBoxRef(uid)
    );
    cctx.restore();

    this.hitRegions = built.hitRegions;
    this.dynamicOverlays = built.dynamicOverlays;
    this.signature = sig;
    return this.canvas;
  }
}

export class DockedCatCache {
  private canvas: any = null;
  private ctx: any = null;
  private lastDrawTimeSec = -999;
  private lastMood = '';
  private lastTalking = false;
  private lastReacting = false;

  clear(): void {
    this.lastDrawTimeSec = -999;
    this.lastMood = '';
  }

  getCatBitmap(
    assets: MiniGameAssetStore,
    opts: {
      timeSec: number;
      mood: SessionSnapshot['pet']['mood'];
      talking: boolean;
      petReactionProgress: number;
      isNavigating: boolean;
    }
  ): any | null {
    if (typeof assets.createOffscreenCanvas !== 'function') return null;

    const bitmapSize = 192;
    if (!this.canvas) {
      this.canvas = assets.createOffscreenCanvas(bitmapSize, bitmapSize);
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    }
    if (!this.canvas || !this.ctx) return null;

    const reacting = opts.petReactionProgress > 0.001;
    const stateChanged =
      this.lastMood !== opts.mood || this.lastTalking !== opts.talking || this.lastReacting !== reacting;
    const hasDrawnOnce = this.lastDrawTimeSec > -900;
    const minIntervalSec = reacting ? 0.032 : 0.045; // ~22fps idle, ~30fps pet reaction

    // While user is actively pinching/panning, reuse last crisp cat frame (0 radial gradients/frame!)
    if (hasDrawnOnce && opts.isNavigating && !stateChanged) {
      return this.canvas;
    }
    if (hasDrawnOnce && !stateChanged && Math.abs(opts.timeSec - this.lastDrawTimeSec) < minIntervalSec) {
      return this.canvas;
    }

    const cctx = this.ctx;
    cctx.clearRect(0, 0, bitmapSize, bitmapSize);
    drawAnimatedCat(cctx, bitmapSize * 0.5, bitmapSize * 0.52, bitmapSize * 0.88, {
      timeSec: opts.timeSec,
      mood: opts.mood,
      talking: opts.talking,
      petReactionProgress: opts.petReactionProgress,
    });

    this.lastDrawTimeSec = opts.timeSec;
    this.lastMood = opts.mood;
    this.lastTalking = opts.talking;
    this.lastReacting = reacting;
    return this.canvas;
  }
}

const autoBoardCacheByAssets = new WeakMap<object, BoardWorldCache>();
const autoCatCacheByAssets = new WeakMap<object, DockedCatCache>();

function getBoardCacheFor(deps: BoardRenderDeps): BoardWorldCache {
  if (deps.boardCache) return deps.boardCache;
  let cache = autoBoardCacheByAssets.get(deps.assets as unknown as object);
  if (!cache) {
    cache = new BoardWorldCache();
    autoBoardCacheByAssets.set(deps.assets as unknown as object, cache);
  }
  return cache;
}

function getCatCacheFor(assets: MiniGameAssetStore, explicit?: DockedCatCache): DockedCatCache {
  if (explicit) return explicit;
  let cache = autoCatCacheByAssets.get(assets as unknown as object);
  if (!cache) {
    cache = new DockedCatCache();
    autoCatCacheByAssets.set(assets as unknown as object, cache);
  }
  return cache;
}

export interface BoardRenderDeps {
  ctx: any;
  assets: MiniGameAssetStore;
  metrics: StageMetrics;
  snap: SessionSnapshot;
  saveData: SaveData;
  camera: BoardCamera;
  activeModal: MiniGameModal;
  activeFlys: readonly FlyingItemAnim[];
  animTimeSec: number;
  gameBubbleElapsedSec: number;
  gamePetReactSec: number;
  pointerX: number;
  pointerY: number;
  flashBlockerUids: ReadonlySet<string>;
  blockedShakeUid: string | null;
  blockedShakeOffsetPx: number;
  boardHitRegions: HitRect[];
  boardCache?: BoardWorldCache;
  isNavigating?: boolean;
  onTapItem: (uid: string) => void;
  onTapBox: (uid: string) => void;
  onTapCat: () => void;
}

function buildBoardCacheSignature(
  deps: BoardRenderDeps,
  activeIds: ReadonlySet<string>,
  loadVersion: number
): string {
  const { metrics, snap, activeFlys, flashBlockerUids, blockedShakeUid } = deps;
  const parts: string[] = [
    `${Math.round(metrics.stageW)}x${Math.round(metrics.stageH)}`,
    `v${loadVersion}`,
    `L${snap.levelNumber}:${snap.theme}:${snap.timeOfDay}:${snap.status}`,
    `h:${snap.highlightedItemUid ?? ''}:${snap.progressDone === 0 ? 'p0' : 'p1'}`,
    `sh:${blockedShakeUid ?? ''}`,
  ];

  if (snap.levelNumber === 1 && snap.progressDone === 0 && activeIds.size > 0) {
    parts.push(`a:${Array.from(activeIds).join(',')}`);
  }
  if (flashBlockerUids.size > 0) {
    parts.push(`fb:${Array.from(flashBlockerUids).join(',')}`);
  }
  if (snap.highlightedBlockerUids.length > 0) {
    parts.push(`hb:${snap.highlightedBlockerUids.join(',')}`);
  }
  for (const f of activeFlys) {
    if (f.kind === 'undo_to_board') {
      parts.push(`u:${f.uid}`);
    }
  }
  for (const it of snap.items) {
    if (it.state !== 'on_board') continue;
    parts.push(
      `i:${it.uid}:${Math.round(it.x * 1000)}:${Math.round(it.y * 1000)}:${it.blockedBy.length}:${it.isGolden ? 1 : 0}`
    );
  }
  for (const b of snap.boxes) {
    if (b.opened) continue;
    parts.push(`b:${b.uid}:${b.hitsLeft}`);
  }
  return parts.join('|');
}

function drawStaticBoardContents(
  ctx: any,
  deps: BoardRenderDeps,
  activeIds: ReadonlySet<string>,
  onTapItem: (uid: string) => void,
  onTapBox: (uid: string) => void
): { hitRegions: HitRect[]; dynamicOverlays: DynamicBoardOverlay[] } {
  const { assets, metrics, snap } = deps;
  const room = ROOM_CATALOG[snap.theme];
  const tint = room.paletteTint[snap.timeOfDay];
  const hitRegions: HitRect[] = [];
  const dynamicOverlays: DynamicBoardOverlay[] = [];

  drawFullScreenBg(ctx, assets, `resources/${room.bgResource}`, metrics.stageW, metrics.stageH);
  if (tint.overlayOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = tint.overlayOpacity;
    ctx.fillStyle = tint.overlayColor;
    ctx.fillRect(0, 0, metrics.stageW, metrics.stageH);
    ctx.restore();
  }

  if (snap.status === 'playing') {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 248, 238, 0.08)';
    ctx.fillRect(0, 0, metrics.stageW, metrics.stageH);

    const sunGlow = ctx.createRadialGradient(
      metrics.stageW * 0.22,
      metrics.stageH * 0.18,
      0,
      metrics.stageW * 0.22,
      metrics.stageH * 0.18,
      metrics.stageH * 0.48
    );
    sunGlow.addColorStop(0, 'rgba(255, 248, 232, 0.09)');
    sunGlow.addColorStop(1, 'rgba(255, 248, 232, 0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, metrics.stageW, metrics.stageH);

    const vignette = ctx.createRadialGradient(
      metrics.stageW * 0.5,
      metrics.stageH * 0.56,
      Math.min(metrics.stageW, metrics.stageH) * 0.28,
      metrics.stageW * 0.5,
      metrics.stageH * 0.56,
      Math.max(metrics.stageW, metrics.stageH) * 0.64
    );
    vignette.addColorStop(0, 'rgba(44,27,20,0)');
    vignette.addColorStop(0.72, 'rgba(44,27,20,0.06)');
    vignette.addColorStop(1, 'rgba(44,27,20,0.16)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, metrics.stageW, metrics.stageH);
    ctx.restore();
  }

  const onBoard: BoardItemInstance[] = snap.items
    .filter((it) => it.state === 'on_board')
    .sort(compareBoardItemOrder);
  const unopenedBoxes = snap.boxes.filter((b) => !b.opened);
  const undoFlightUids = new Set(
    deps.activeFlys.filter((f) => f.kind === 'undo_to_board').map((f) => f.uid)
  );
  const highlightedBlockers = new Set(snap.highlightedBlockerUids);

  for (const groundShadow of computePileGroundShadows(onBoard, unopenedBoxes)) {
    const { x: sx, y: sy } = boardItemPos(metrics.stageW, metrics.stageH, groundShadow.x, groundShadow.y);
    const rx = groundShadow.rxNorm * REF_W;
    const ry = groundShadow.ryNorm * metrics.stageH;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, ry / Math.max(1, rx));
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    grad.addColorStop(0, `rgba(38, 22, 14, ${(groundShadow.alpha * 0.95).toFixed(3)})`);
    grad.addColorStop(0.55, `rgba(38, 22, 14, ${(groundShadow.alpha * 0.42).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(38, 22, 14, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const item of onBoard) {
    if (undoFlightUids.has(item.uid)) continue;

    const def = ITEM_BY_ID[item.itemId];
    const spriteMeta = getItemSprite(item.itemId, item.variantIndex ?? 0);
    const { x: cx, y: cy } = boardItemPos(metrics.stageW, metrics.stageH, item.x, item.y);
    const depth = computeItemVisualDepth(item);
    const baseSize = REF_ITEM_BASE_SIZE * item.scale * (def.visualScale ?? 1) * depth.scaleFactor;
    const aspect = item.aspectRatio ?? spriteMeta.aspectRatio ?? def.aspectRatio ?? 1;
    const { width: w, height: h } = computeAspectDimensions(baseSize, aspect);
    const lift = depth.liftPxRef;
    const spriteKey = `resources/${spriteMeta.spriteResource}.png`;
    const drawable = assets.getItemDrawable(
      spriteKey,
      depth.occlusionTier,
      depth.canvasShadeColor,
      depth.grayscale,
      depth.brightness
    );

    const isShaking = deps.blockedShakeUid === item.uid;
    const isBlockerFlash = deps.flashBlockerUids.has(item.uid) || highlightedBlockers.has(item.uid);
    const isHinted = isBoardItemHinted(item, depth.occlusionTier, snap, activeIds);

    if (isShaking || isBlockerFlash || isHinted) {
      dynamicOverlays.push({
        uid: item.uid,
        cx,
        cy,
        w,
        h,
        rotation: item.rotation,
        lift,
        opacity: depth.opacity,
        drawable,
        isGolden: Boolean(item.isGolden),
        occlusionTier: depth.occlusionTier,
        isHinted,
        isBlockerFlash,
        isShaking,
      });
    }

    if (!isShaking) {
      ctx.save();
      ctx.translate(cx, cy - lift);
      ctx.rotate((item.rotation * Math.PI) / 180);
      ctx.globalAlpha = depth.opacity;

      if (drawable) {
        if (depth.occlusionTier === 0) {
          // Baked once into static offscreen cache (never re-evaluated during zoom/pan!)
          ctx.save();
          ctx.shadowColor = `rgba(30,17,12,${(depth.castAlpha * 0.85).toFixed(3)})`;
          ctx.shadowBlur = Math.min(6, depth.shadowBlurRef);
          ctx.shadowOffsetX = depth.shadowOffsetXRef * 0.65;
          ctx.shadowOffsetY = depth.shadowOffsetYRef * 0.72;
          ctx.drawImage(drawable, -w / 2, -h / 2, w, h);
          ctx.restore();
          if (item.isGolden) {
            ctx.save();
            ctx.shadowColor = 'rgba(255,201,64,0.92)';
            ctx.shadowBlur = 9;
            ctx.shadowOffsetY = 0;
            ctx.drawImage(drawable, -w / 2, -h / 2, w, h);
            ctx.restore();
          }
        } else {
          ctx.save();
          ctx.fillStyle = `rgba(32, 20, 14, ${(depth.contactAlpha * 0.55).toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(2, 4, w * 0.38, h * 0.28, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          ctx.drawImage(drawable, -w / 2, -h / 2, w, h);
        }
      }
      if (item.isGolden) {
        ctx.save();
        ctx.globalAlpha = depth.occlusionTier === 0 ? 1 : depth.opacity * 0.85;
        drawImg(ctx, assets, 'resources/ui/icon_coin.png', w * 0.2, -h * 0.48, 26, 26);
        ctx.restore();
      }
      ctx.restore();
    }

    const spriteBox = { cx, cy: cy - lift, w, h, rotationDeg: item.rotation };
    const bounds = getRotatedBounds(spriteBox);
    const itemUid = item.uid;
    hitRegions.push({
      x: bounds.x,
      y: bounds.y,
      w: bounds.w,
      h: bounds.h,
      containsPoint: (pt) => hitTestRotatedSprite(pt.x, pt.y, spriteBox, assets.getAlphaMask(spriteKey)),
      onTap: () => onTapItem(itemUid),
    });
  }

  for (const box of unopenedBoxes) {
    const { x: cx, y: cy } = boardItemPos(metrics.stageW, metrics.stageH, box.x, box.y);
    const size = REF_BOX_BASE_SIZE * box.scale;
    const key =
      box.hitsLeft < box.maxHits
        ? 'resources/sprites/cardboard_cracked.png'
        : 'resources/sprites/cardboard_closed.png';
    ctx.save();
    ctx.fillStyle = 'rgba(34,20,14,0.28)';
    ctx.beginPath();
    ctx.ellipse(cx + 4, cy + size * 0.34, size * 0.44, size * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    drawImg(ctx, assets, key, cx - size / 2, cy - size / 2, size, size);
    ctx.restore();
    const isHeavy = box.maxHits >= 3;
    drawSoftCard(
      ctx,
      cx - 52,
      cy + size * 0.35,
      104,
      28,
      14,
      isHeavy ? '#D94B38' : room.accentDeep,
      'rgba(255, 255, 255, 0.88)',
      2,
      0.22,
      3
    );
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isHeavy ? `加固 ×${box.hitsLeft}` : `拆箱 ×${box.hitsLeft}`, cx, cy + size * 0.35 + 20);

    const boxUid = box.uid;
    hitRegions.push({
      x: cx - size * 0.5,
      y: cy - size * 0.5,
      w: size,
      h: size,
      onTap: () => onTapBox(boxUid),
    });
  }

  return { hitRegions, dynamicOverlays };
}

function drawDynamicOverlays(
  ctx: any,
  assets: MiniGameAssetStore,
  overlays: readonly DynamicBoardOverlay[],
  deps: BoardRenderDeps
): void {
  for (const ov of overlays) {
    const shakeX = ov.isShaking ? deps.blockedShakeOffsetPx : 0;
    ctx.save();
    ctx.translate(ov.cx + shakeX, ov.cy - ov.lift);
    ctx.rotate((ov.rotation * Math.PI) / 180);

    if (ov.isShaking && ov.drawable) {
      ctx.globalAlpha = ov.opacity;
      ctx.drawImage(ov.drawable, -ov.w / 2, -ov.h / 2, ov.w, ov.h);
      if (ov.isGolden) {
        ctx.globalAlpha = ov.occlusionTier === 0 ? 1 : ov.opacity * 0.85;
        drawImg(ctx, assets, 'resources/ui/icon_coin.png', ov.w * 0.2, -ov.h * 0.48, 26, 26);
      }
    }

    if (ov.isBlockerFlash) {
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#FF6B4A';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, ov.w * 0.52, ov.h * 0.52, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (ov.isHinted) {
      const pulse = 0.65 + 0.35 * Math.sin(deps.animTimeSec * 6);
      ctx.globalAlpha = 0.45 + 0.45 * pulse;
      ctx.strokeStyle = '#FFD147';
      ctx.lineWidth = 3 + pulse * 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, ov.w * (0.48 + pulse * 0.06), ov.h * (0.48 + pulse * 0.06), 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

export function renderBoardWorld(deps: BoardRenderDeps): HitRect | null {
  const { ctx, assets, metrics, snap, camera } = deps;
  const cache = getBoardCacheFor(deps);
  cache.setTapCallbacks(deps.onTapItem, deps.onTapBox);
  const cachedCanvas = cache.ensureUpToDate(deps);

  ctx.save();
  ctx.translate(
    CAMERA_PIVOT_X * metrics.stageW + camera.panX * metrics.stageW,
    CAMERA_PIVOT_Y * metrics.stageH + camera.panY * metrics.stageH
  );
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-CAMERA_PIVOT_X * metrics.stageW, -CAMERA_PIVOT_Y * metrics.stageH);

  if (cachedCanvas) {
    // Single GPU-friendly blit for the entire static room + 170+ items during zoom & pan!
    ctx.drawImage(cachedCanvas, 0, 0, metrics.stageW, metrics.stageH);
    const overlays = cache.getDynamicOverlays();
    if (overlays.length > 0) {
      drawDynamicOverlays(ctx, assets, overlays, deps);
    }
    if (snap.status === 'playing' && deps.activeModal === 'none') {
      const cachedHits = cache.getHitRegions();
      for (let i = 0; i < cachedHits.length; i++) {
        deps.boardHitRegions.push(cachedHits[i]);
      }
    }
  } else {
    // Fallback for environments without offscreen canvas support
    const activeIds = getActiveOrderItemIds(snap);
    const built = drawStaticBoardContents(ctx, deps, activeIds, deps.onTapItem, deps.onTapBox);
    if (built.dynamicOverlays.length > 0) {
      drawDynamicOverlays(ctx, assets, built.dynamicOverlays, deps);
    }
    if (snap.status === 'playing' && deps.activeModal === 'none') {
      for (let i = 0; i < built.hitRegions.length; i++) {
        deps.boardHitRegions.push(built.hitRegions[i]);
      }
    }
  }

  ctx.restore();

  if (snap.modifiers.includes('blackout_flashlight') && snap.status === 'playing') {
    ctx.save();
    ctx.fillStyle = 'rgba(14, 13, 28, 0.88)';
    ctx.beginPath();
    ctx.rect(0, 0, metrics.stageW, metrics.stageH);
    ctx.arc(deps.pointerX, deps.pointerY, 185, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    ctx.restore();
  }

  return null;
}

export function computeDockedCatPosition(
  metrics: StageMetrics,
  layout: HudLayout
): { cx: number; cy: number; size: number } {
  const size = 120;
  const cx = Math.min(metrics.stageW - 72, layout.ox + 648);
  // Generous bottom padding keeps cat & its badge cleanly above the boosters row and its top count pill
  const cy = layout.boostersY - 114;
  return { cx, cy, size };
}

export interface DockedCatRenderDeps {
  ctx: any;
  assets: MiniGameAssetStore;
  metrics: StageMetrics;
  layout: HudLayout;
  snap: SessionSnapshot;
  saveData: SaveData;
  shareUnlock?: boolean;
  activeModal: MiniGameModal;
  animTimeSec: number;
  gameBubbleElapsedSec: number;
  gamePetReactSec: number;
  isNavigating?: boolean;
  catCache?: DockedCatCache;
  hudHitRegions: HitRect[];
  onTapCat: () => void;
}

/**
 * Renders the in-level cat docked in the screen-space bottom-right corner
 * (immune to board camera zoom/pan) with offscreen bitmap throttling.
 */
export function renderDockedCat(deps: DockedCatRenderDeps): HitRect | null {
  const { ctx, assets, metrics, layout, snap } = deps;
  if (!snap.pet.enabled) return null;

  const { cx, cy, size } = computeDockedCatPosition(metrics, layout);
  const bubbleState = snap.pet.bubbleText
    ? sliceTypedText(snap.pet.bubbleText, deps.gameBubbleElapsedSec)
    : null;
  const petReactProgress =
    deps.gamePetReactSec > 0 ? 1 - deps.gamePetReactSec / PET_REACTION_DURATION_SEC : 0;

  const catCache = getCatCacheFor(assets, deps.catCache);
  const catBitmap = catCache.getCatBitmap(assets, {
    timeSec: deps.animTimeSec,
    mood: snap.pet.mood,
    talking: Boolean(bubbleState?.typing),
    petReactionProgress: petReactProgress,
    isNavigating: Boolean(deps.isNavigating),
  });

  if (catBitmap) {
    const drawW = size * 1.14;
    const drawH = size * 1.14;
    ctx.drawImage(catBitmap, cx - drawW * 0.5, cy - drawH * 0.52, drawW, drawH);
  } else {
    drawAnimatedCat(ctx, cx, cy, size, {
      timeSec: deps.animTimeSec,
      mood: snap.pet.mood,
      talking: Boolean(bubbleState?.typing),
      petReactionProgress: petReactProgress,
    });
  }

  const badge = computeCatBadgeState(snap.pet, deps.saveData.petTreats, deps.shareUnlock);
  const badgeFill =
    badge.mode === 'treat'
      ? '#FF6E7F'
      : badge.mode === 'missing_treat' || badge.mode === 'ad'
        ? '#4FA1DA'
        : '#8D8178';
  ctx.save();
  ctx.font = 'bold 15px sans-serif';
  const bw = Math.max(92, Math.ceil(ctx.measureText(badge.text).width) + 22);
  const badgeX = Math.min(metrics.stageW - bw - 10, cx - bw * 0.5);
  const badgeY = cy + size * 0.34;
  drawSoftCard(ctx, badgeX, badgeY, bw, 26, 13, badgeFill, 'rgba(255, 255, 255, 0.90)', 1.8, 0.16, 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText(badge.text, badgeX + bw * 0.5, badgeY + 18.5);
  ctx.restore();

  if (snap.pet.bubbleText && bubbleState) {
    drawAnimatedSpeechBubble(ctx, {
      text: snap.pet.bubbleText,
      typedChars: bubbleState.typedChars,
      anchorX: cx - 36,
      bottomY: cy - size * 0.46,
      pointerTargetX: cx,
      timeSec: deps.animTimeSec,
      stageWidth: metrics.stageW,
      popProgress: Math.min(1, deps.gameBubbleElapsedSec / 0.22),
      fontSize: 17,
      maxWidth: 320,
    });
  }

  if (snap.status === 'playing' && deps.activeModal === 'none') {
    const hit: HitRect = {
      x: cx - size * 0.54,
      y: cy - size * 0.54,
      w: size * 1.08,
      h: size * 1.14,
      onTap: deps.onTapCat,
    };
    deps.hudHitRegions.push(hit);
    return hit;
  }
  return null;
}

export function renderZoomControls(params: {
  ctx: any;
  assets: MiniGameAssetStore;
  metrics: StageMetrics;
  layout: HudLayout;
  snap: SessionSnapshot;
  activeModal: MiniGameModal;
  camera: BoardCamera;
  hudHitRegions: HitRect[];
  setCamera: (next: BoardCamera) => void;
}): void {
  const { ctx, assets, metrics, layout, snap, camera } = params;
  if (snap.status !== 'playing' || params.activeModal !== 'none') return;

  const zx = Math.min(metrics.stageW - 76, layout.ox + 640);
  const midY = (layout.boardClipTopY + layout.boardClipBottomY) * 0.5;
  const zy = Math.round(midY - 87);
  drawSoftCard(ctx, zx, zy, 64, 174, 32, 'rgba(255,253,249,0.92)', 'rgba(90, 66, 52, 0.14)', 1.5, 0.12, 4);

  ctx.save();
  if (camera.zoom >= MAX_ZOOM - 0.01) ctx.globalAlpha = 0.4;
  drawSoftCard(ctx, zx + 9, zy + 10, 46, 46, 23, '#FFF6E8', 'rgba(90, 66, 52, 0.14)', 1.2, 0.06, 2);
  drawImg(ctx, assets, 'resources/ui/icon_zoom_in.png', zx + 15, zy + 16, 34, 34);
  ctx.restore();

  drawRoundRect(ctx, zx + 6, zy + 68, 52, 34, 17, '#FFE8CC', 'rgba(90, 66, 52, 0.14)', 1.2);
  ctx.fillStyle = '#3B2D26';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${camera.zoom.toFixed(1)}×`, zx + 32, zy + 91);

  ctx.save();
  if (camera.zoom <= MIN_ZOOM + 0.01) ctx.globalAlpha = 0.4;
  drawSoftCard(ctx, zx + 9, zy + 114, 46, 46, 23, '#FFF6E8', 'rgba(90, 66, 52, 0.14)', 1.2, 0.06, 2);
  drawImg(ctx, assets, 'resources/ui/icon_zoom_out.png', zx + 15, zy + 120, 34, 34);
  ctx.restore();

  params.hudHitRegions.push(
    {
      x: zx + 6,
      y: zy + 6,
      w: 52,
      h: 52,
      onTap: () => params.setCamera(zoomCameraBy(camera, ZOOM_STEP)),
    },
    {
      x: zx + 4,
      y: zy + 64,
      w: 56,
      h: 42,
      onTap: () => {
        if (camera.zoom > MIN_ZOOM) params.setCamera(createDefaultCamera());
      },
    },
    {
      x: zx + 6,
      y: zy + 112,
      w: 52,
      h: 52,
      onTap: () => params.setCamera(zoomCameraBy(camera, -ZOOM_STEP)),
    }
  );
}

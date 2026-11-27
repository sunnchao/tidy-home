import { getItemSprite } from '@core/catalogs';
import { type FlyingItemAnim, sampleFlyAnim } from '@core/flyAnimation';
import { getTransitionVisuals, type SceneTransitionState } from '@core/transition';
import type { SaveData } from '@core/types';
import { formatCountdownMmSs, MAX_LIVES, syncLives } from '@core/userProfile';
import type { OrderFlowTracker } from '@shared/orderFlowTracker';
import type { MiniGameAssetStore } from './assets';
import { REF_H, REF_W, type TapRipple, type ToastState } from './types';

function traceRoundRectPath(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  rad: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function drawRoundRect(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke?: string,
  lw = 2,
  shadowAlpha = 0,
  shadowOffsetY = 5
): void {
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.save();
  if (shadowAlpha > 0) {
    // Two-pass soft offset shadow avoids Android Skia/Canvas2D per-card shadowBlur stalls
    const spread = Math.max(1.5, shadowOffsetY * 0.45);
    traceRoundRectPath(ctx, x - spread * 0.5, y + shadowOffsetY, w + spread, h + spread * 0.35, rad + 1);
    ctx.fillStyle = `rgba(59, 45, 38, ${(shadowAlpha * 0.48).toFixed(3)})`;
    ctx.fill();
    traceRoundRectPath(ctx, x, y + Math.max(1.5, shadowOffsetY * 0.62), w, h, rad);
    ctx.fillStyle = `rgba(59, 45, 38, ${(shadowAlpha * 0.72).toFixed(3)})`;
    ctx.fill();
  }
  traceRoundRectPath(ctx, x, y, w, h, rad);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawSoftCard(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke = 'rgba(90, 66, 52, 0.16)',
  lw = 1.6,
  shadowAlpha = 0.12,
  shadowOffsetY = 4
): void {
  drawRoundRect(ctx, x, y, w, h, r, fill, stroke, lw, shadowAlpha, shadowOffsetY);
}

export function drawClippedRoundImage(
  ctx: any,
  assets: MiniGameAssetStore,
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const img = assets.getImage(key);
  if (!img || !img.width || !img.height) return;
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
  ctx.clip();
  const sc = Math.max(w / img.width, h / img.height);
  const dw = img.width * sc;
  const dh = img.height * sc;
  ctx.drawImage(img, x + (w - dw) * 0.5, y + (h - dh) * 0.5, dw, dh);
  ctx.restore();
}

export function drawImg(
  ctx: any,
  assets: MiniGameAssetStore,
  key: string,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const img = assets.getImage(key);
  if (img && img.width > 0 && img.height > 0) {
    try {
      ctx.drawImage(img, x, y, w, h);
    } catch {
      // Ignore transient image decode errors.
    }
  }
}

export function drawFullScreenBg(
  ctx: any,
  assets: MiniGameAssetStore,
  key: string,
  stageW: number,
  stageH: number
): void {
  const coverScale = Math.max(stageW / REF_W, stageH / REF_H);
  const dw = REF_W * coverScale;
  const dh = REF_H * coverScale;
  const dx = (stageW - dw) * 0.5;
  const dy = (stageH - dh) * 0.5;
  drawImg(ctx, assets, key, dx, dy, dw, dh);
}

export function drawLivesPill(
  ctx: any,
  assets: MiniGameAssetStore,
  saveData: SaveData,
  onSyncSave: (next: SaveData) => void,
  x: number,
  y: number,
  w: number,
  accentFill: string
): void {
  const synced = syncLives(saveData, Date.now());
  onSyncSave(synced.save);
  const save = synced.save;

  drawSoftCard(ctx, x, y, w, 44, 22, 'rgba(255, 244, 246, 0.94)', 'rgba(212, 84, 110, 0.24)', 1.5, 0.1, 3);
  drawImg(ctx, assets, 'resources/ui/icon_heart.png', x + 7, y + 7, 30, 30);

  const pipStartX = x + 41;
  for (let i = 0; i < MAX_LIVES; i++) {
    const filled = i < save.lives;
    drawRoundRect(
      ctx,
      pipStartX + i * 18,
      y + 13,
      14,
      18,
      4,
      filled ? accentFill : '#E8DCD6',
      filled ? 'rgba(186, 48, 72, 0.35)' : 'rgba(90, 66, 52, 0.18)',
      1.2
    );
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#3B2D26';
  ctx.font = 'bold 18px sans-serif';
  const countX = pipStartX + 94;
  ctx.fillText(`${save.lives}/${MAX_LIVES}`, countX, y + 28);

  if (save.lives < MAX_LIVES && synced.nextRegenInSec > 0) {
    ctx.fillStyle = '#C93B52';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(formatCountdownMmSs(synced.nextRegenInSec), countX + 34, y + 28);
  }
}

export function drawTapRipple(ctx: any, tapRipple: TapRipple | null, nowMs: number): TapRipple | null {
  if (!tapRipple) return null;
  const age = nowMs - tapRipple.atMs;
  if (age >= 260) return null;

  const p = age / 260;
  ctx.save();
  ctx.globalAlpha = 0.65 * (1 - p);
  ctx.strokeStyle = '#FC9651';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(tapRipple.x, tapRipple.y, 14 + p * 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  return tapRipple;
}

export function drawToast(
  ctx: any,
  toast: ToastState | null,
  stageW: number,
  boardClipTopY: number,
  nowMs: number
): ToastState | null {
  if (!toast || nowMs >= toast.untilMs) return null;

  ctx.save();
  ctx.font = 'bold 21px sans-serif';
  const tw = Math.min(640, Math.max(220, Math.ceil(ctx.measureText(toast.text).width) + 56));
  const tx = (stageW - tw) * 0.5;
  const ty = Math.min(REF_H * 0.45, Math.max(260, boardClipTopY + 12));
  drawSoftCard(ctx, tx, ty, tw, 48, 24, 'rgba(46, 34, 28, 0.90)', 'rgba(255, 224, 130, 0.45)', 1.5, 0.22, 6);
  ctx.fillStyle = '#FFE48C';
  ctx.textAlign = 'center';
  ctx.fillText(toast.text, stageW * 0.5, ty + 31);
  ctx.restore();
  return toast;
}

export function drawTransitionCurtain(
  ctx: any,
  assets: MiniGameAssetStore,
  transitionState: SceneTransitionState,
  stageW: number,
  stageH: number
): void {
  const payload = transitionState.payload;
  const vis = getTransitionVisuals(transitionState);
  if (!vis.visible || !payload || vis.alpha <= 0.005) return;

  ctx.save();
  ctx.globalAlpha = vis.alpha;
  ctx.fillStyle = payload.bgColor || '#FFF5E6';
  ctx.fillRect(0, 0, stageW, stageH);

  ctx.fillStyle = payload.accentColor;
  ctx.globalAlpha = vis.alpha * 0.14;
  ctx.beginPath();
  ctx.arc(stageW * 0.5, stageH * 0.46, Math.min(stageW, stageH) * 0.42, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = vis.alpha;
  ctx.translate(stageW * 0.5, stageH * 0.48 + vis.cardOffsetY);
  ctx.scale(vis.cardScale, vis.cardScale);

  const cw = 480;
  const ch = 224;
  drawSoftCard(ctx, -cw * 0.5, -ch * 0.5, cw, ch, 34, '#FFFDF9', 'rgba(90, 66, 52, 0.16)', 2, 0.18, 8);
  drawImg(ctx, assets, 'resources/ui/icon_paw.png', -32, -ch * 0.5 + 24, 64, 64);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#3B2D26';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(payload.title, 0, 26);

  ctx.fillStyle = payload.accentColor;
  ctx.font = 'bold 21px sans-serif';
  ctx.fillText(payload.subtitle, 0, 66);
  ctx.restore();
}

export function drawFlyingItems(
  ctx: any,
  assets: MiniGameAssetStore,
  activeFlys: FlyingItemAnim[],
  orderFlow: OrderFlowTracker,
  slotLandAtMs: Map<string, number>,
  nowMs: number
): FlyingItemAnim[] {
  if (activeFlys.length === 0) return activeFlys;
  const remaining: FlyingItemAnim[] = [];

  for (const fly of activeFlys) {
    const sample = sampleFlyAnim(fly, nowMs);
    if (sample.phase === 'done') {
      if (fly.orderId) {
        orderFlow.markOrderLanded(fly.orderId);
      }
      if (fly.kind === 'to_tray') {
        slotLandAtMs.set(`tray_${fly.targetSlotIndex}`, nowMs);
      } else if (fly.kind === 'to_order' || fly.kind === 'from_tray_to_order') {
        const activeTr = orderFlow.getActiveTransition(fly.targetSlotIndex, nowMs);
        if (!activeTr || (activeTr.sample.phase !== 'sealed' && activeTr.sample.phase !== 'exiting')) {
          slotLandAtMs.set(`order_${fly.targetSlotIndex}`, nowMs);
        }
      }
      continue;
    }
    remaining.push(fly);
    if (sample.phase !== 'flying' && !(sample.phase === 'waiting' && sample.opacity > 0.01)) continue;

    const drawSize = sample.size * sample.scale;
    const spriteKey = `resources/${getItemSprite(fly.itemId, fly.variantIndex).spriteResource}.png`;
    const img = assets.getImage(spriteKey);
    if (!img) continue;

    ctx.save();
    ctx.translate(sample.x, sample.y);
    ctx.rotate((sample.rotationDeg * Math.PI) / 180);
    ctx.globalAlpha = sample.opacity;
    ctx.fillStyle = `rgba(34, 20, 14, ${(sample.shadowAlpha * 0.55).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(3, sample.shadowOffsetY * 0.72, drawSize * 0.36, drawSize * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(img, -drawSize * 0.5, -drawSize * 0.5, drawSize, drawSize);
    ctx.restore();
  }

  return remaining;
}

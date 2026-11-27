import { getItemSprite, ITEM_BY_ID, ROOM_CATALOG } from '@core/catalogs';
import { createFlyingItemAnim, type FlyAnimKind, sampleFlyAnim } from '@core/flyAnimation';
import { REF_BOX_BASE_SIZE, REF_ITEM_BASE_SIZE } from '@core/levelGenerator';
import type { SessionSnapshot } from '@core/types';

export function spawnFloatToast(rect: DOMRect, text: string, color = '#FFFFFF'): void {
  const el = document.createElement('div');
  el.className = 'float-toast';
  el.textContent = text;
  const isShellWide = rect.height > 400;
  el.style.left = `${rect.left + rect.width / 2}px`;
  el.style.top = `${isShellWide ? rect.top + 224 : Math.max(56, rect.top)}px`;
  el.style.color = color;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

let flySequence = 0;

export function launchWebFlyAnimation(opts: {
  uid: string;
  itemId: string;
  variantIndex: number;
  kind: FlyAnimKind;
  fromRect: DOMRect;
  toRect: DOMRect;
  startRotDeg?: number;
  delayMs?: number;
  visibleWhileWaiting?: boolean;
  startedAtMs?: number;
  onLand?: () => void;
}): void {
  const startCenterX = opts.fromRect.left + opts.fromRect.width * 0.5;
  const startCenterY = opts.fromRect.top + opts.fromRect.height * 0.5;
  const endCenterX = opts.toRect.left + opts.toRect.width * 0.5;
  const endCenterY = opts.toRect.top + opts.toRect.height * 0.5;
  const startSize = Math.max(
    44,
    Math.min(136, Math.round(Math.max(opts.fromRect.width, opts.fromRect.height) * 0.92))
  );
  const endSize = Math.max(
    34,
    Math.min(82, Math.round(Math.max(opts.toRect.width, opts.toRect.height) * 0.86))
  );

  const fly = createFlyingItemAnim({
    id: `fly_${++flySequence}`,
    uid: opts.uid,
    itemId: opts.itemId,
    variantIndex: opts.variantIndex,
    kind: opts.kind,
    fromX: startCenterX,
    fromY: startCenterY,
    toX: endCenterX,
    toY: endCenterY,
    startSize,
    endSize,
    startRotDeg: opts.startRotDeg ?? 0,
    startedAtMs: opts.startedAtMs ?? performance.now(),
    delayMs: opts.delayMs ?? 0,
    visibleWhileWaiting: opts.visibleWhileWaiting,
  });

  const clone = document.createElement('div');
  clone.className = 'fly-clone';
  clone.style.width = `${startSize}px`;
  clone.style.height = `${startSize}px`;
  clone.style.left = `${startCenterX - startSize * 0.5}px`;
  clone.style.top = `${startCenterY - startSize * 0.5}px`;
  clone.style.opacity = fly.delayMs > 0 && !fly.visibleWhileWaiting ? '0' : '1';
  clone.innerHTML = `<img src="${getItemSprite(opts.itemId, opts.variantIndex).spriteWebUrl}" alt="" />`;
  document.body.appendChild(clone);

  const tickFly = () => {
    const sample = sampleFlyAnim(fly, performance.now());
    if (sample.phase === 'done') {
      clone.remove();
      opts.onLand?.();
      return;
    }
    clone.style.opacity = String(sample.opacity);
    if (sample.phase === 'flying') {
      const half = sample.size * 0.5;
      clone.style.width = `${sample.size.toFixed(1)}px`;
      clone.style.height = `${sample.size.toFixed(1)}px`;
      clone.style.left = `${(sample.x - half).toFixed(1)}px`;
      clone.style.top = `${(sample.y - half).toFixed(1)}px`;
      clone.style.transform = `scale(${sample.scale.toFixed(3)}) rotate(${sample.rotationDeg.toFixed(1)}deg)`;
    }
    requestAnimationFrame(tickFly);
  };
  requestAnimationFrame(tickFly);
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function captureBeforeAndAfterSnapshots(
  snap: SessionSnapshot
): Promise<{ beforeShotUrl: string; afterShotUrl: string } | null> {
  const room = ROOM_CATALOG[snap.theme];
  const w = 270;
  const h = 390;

  const bgImg = await loadImage(room.bgWebUrl);
  if (!bgImg) return null;

  let afterShotUrl = '';
  const afterCanvas = document.createElement('canvas');
  afterCanvas.width = w;
  afterCanvas.height = h;
  const actx = afterCanvas.getContext('2d');
  if (actx) {
    actx.drawImage(bgImg, 0, 0, w, h);
    afterShotUrl = afterCanvas.toDataURL('image/jpeg', 0.84);
  }

  const beforeCanvas = document.createElement('canvas');
  beforeCanvas.width = w;
  beforeCanvas.height = h;
  const bctx = beforeCanvas.getContext('2d');
  if (!bctx) return null;
  bctx.drawImage(bgImg, 0, 0, w, h);

  const uniqueUrls = new Set<string>();
  snap.items.forEach((it) =>
    uniqueUrls.add(getItemSprite(it.itemId, it.variantIndex ?? 0).spriteWebUrl)
  );
  if (snap.boxes.length > 0) uniqueUrls.add('/resources/sprites/cardboard_closed.png');

  const imgMap = new Map<string, HTMLImageElement>();
  await Promise.all(
    [...uniqueUrls].map(async (url) => {
      const im = await loadImage(url);
      if (im) imgMap.set(url, im);
    })
  );

  const sorted = [...snap.items]
    .filter((it) => it.state === 'on_board')
    .sort((a, b) => a.layer * 1000 + a.y - (b.layer * 1000 + b.y));
  const shotRefScale = w / 720;
  for (const it of sorted) {
    const sp = imgMap.get(getItemSprite(it.itemId, it.variantIndex ?? 0).spriteWebUrl);
    if (!sp) continue;
    const size = REF_ITEM_BASE_SIZE * shotRefScale * it.scale * (ITEM_BY_ID[it.itemId].visualScale ?? 1);
    bctx.save();
    bctx.translate(it.x * w, it.y * h);
    bctx.rotate((it.rotation * Math.PI) / 180);
    bctx.drawImage(sp, -size / 2, -size / 2, size, size);
    bctx.restore();
  }
  const boxImg = imgMap.get('/resources/sprites/cardboard_closed.png');
  if (boxImg) {
    for (const box of snap.boxes) {
      const size = REF_BOX_BASE_SIZE * shotRefScale * box.scale;
      bctx.drawImage(boxImg, box.x * w - size / 2, box.y * h - size / 2, size, size);
    }
  }
  return {
    beforeShotUrl: beforeCanvas.toDataURL('image/jpeg', 0.84),
    afterShotUrl,
  };
}

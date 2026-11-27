export interface Point {
  x: number;
  y: number;
}

export interface HitRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ViewportTransform {
  screenW: number;
  screenH: number;
  dpr: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface TapStamp extends Point {
  atMs: number;
}

export const TAP_DEDUPE_MS = 120;
export const TAP_DEDUPE_DISTANCE = 16;
export const TAP_SOURCE_DEDUPE_MS = 80;

function firstTouch(list: unknown): any | null {
  if (!list || typeof list !== 'object') return null;
  const candidate = list as { length?: number; [index: number]: unknown };
  if (typeof candidate.length !== 'number' || candidate.length <= 0) return null;
  return candidate[0] ?? null;
}

/** Extracts pointer coordinates from touch lists, changedTouches, detail, or DOM events. */
export function extractTouchPoint(ev: unknown): Point | null {
  if (!ev || typeof ev !== 'object') return null;
  const event = ev as Record<string, any>;
  const src =
    firstTouch(event.touches) ??
    firstTouch(event.changedTouches) ??
    (event.detail && typeof event.detail === 'object' ? event.detail : null) ??
    event;
  const x = src?.clientX ?? src?.pageX ?? src?.x ?? event.clientX ?? event.pageX ?? event.x;
  const y = src?.clientY ?? src?.pageY ?? src?.y ?? event.clientY ?? event.pageY ?? event.y;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: Number(x), y: Number(y) };
}

/** Extracts active (currently touching) coordinates from `touches` only, never `changedTouches`. */
export function extractActiveTouchPoints(ev: unknown): Point[] {
  if (!ev || typeof ev !== 'object') return [];
  const event = ev as Record<string, any>;
  const list = event.touches as { length?: number; [index: number]: any } | undefined;
  if (!list || typeof list.length !== 'number' || list.length <= 0) return [];
  const pts: Point[] = [];
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    const x = t?.clientX ?? t?.pageX ?? t?.x;
    const y = t?.clientY ?? t?.pageY ?? t?.y;
    if (Number.isFinite(x) && Number.isFinite(y)) {
      pts.push({ x: Number(x), y: Number(y) });
    }
  }
  return pts;
}

/** Returns count of currently pressed touch points (0 when all fingers lifted). */
export function countActiveTouches(ev: unknown): number {
  return extractActiveTouchPoints(ev).length;
}

/** Extracts all active touch coordinates (supports multi-touch pinch gestures). */
export function extractTouchPoints(ev: unknown): Point[] {
  const active = extractActiveTouchPoints(ev);
  if (active.length > 0) return active;
  const single = extractTouchPoint(ev);
  return single ? [single] : [];
}

/** Converts screen-space pointer coordinates to the 720x1280 logical stage. */
export function screenToLogic(raw: Point, viewport: ViewportTransform): Point {
  let x = raw.x;
  let y = raw.y;
  const { screenW, screenH, dpr, scale, offsetX, offsetY } = viewport;
  if (!Number.isFinite(scale) || scale <= 0) return { x, y };

  // Some DevTools builds report canvas backing-store pixels instead of CSS pixels.
  if (
    dpr > 1 &&
    (x > screenW * 1.15 || y > screenH * 1.15) &&
    x <= screenW * dpr * 1.05 &&
    y <= screenH * dpr * 1.05
  ) {
    x /= dpr;
    y /= dpr;
  }

  return {
    x: (x - offsetX) / scale,
    y: (y - offsetY) / scale,
  };
}

/** Returns the top-most hit region containing the logical point. */
export function hitRegionAt<T extends HitRegion & { containsPoint?: (pt: Point) => boolean }>(
  regions: readonly T[],
  point: Point
): T | undefined {
  for (let i = regions.length - 1; i >= 0; i--) {
    const region = regions[i];
    if (
      point.x >= region.x &&
      point.x <= region.x + region.w &&
      point.y >= region.y &&
      point.y <= region.y + region.h
    ) {
      if (region.containsPoint && !region.containsPoint(point)) {
        continue;
      }
      return region;
    }
  }
  return undefined;
}

/** Filters duplicate touch/mouse events raised for the same physical tap. */
export function isDuplicateTap(nowMs: number, point: Point, lastTap: TapStamp | null): boolean {
  if (!lastTap) return false;
  return (
    nowMs - lastTap.atMs < TAP_DEDUPE_MS &&
    Math.hypot(point.x - lastTap.x, point.y - lastTap.y) < TAP_DEDUPE_DISTANCE
  );
}

/** Cross-channel guard: touch and mouse can report different coordinates for one press. */
export function isRecentTap(nowMs: number, lastTap: TapStamp | null): boolean {
  return lastTap !== null && nowMs - lastTap.atMs < TAP_SOURCE_DEDUPE_MS;
}

export interface SafeTopOffsetInput {
  statusBarHeight: number;
  safeAreaTop: number;
  menuButtonBottom: number;
  scale: number;
  isMiniGame: boolean;
}

/**
 * Computes the logical Y top inset needed to keep HUD controls cleanly below
 * the MiniGame menu capsule and status bar across portrait devices.
 */
export function computeSafeTopOffset(input: SafeTopOffsetInput): number {
  const safeTop = Math.max(
    0,
    Number.isFinite(input.safeAreaTop) ? input.safeAreaTop : 0,
    Number.isFinite(input.statusBarHeight) ? input.statusBarHeight : 0
  );
  const rawMenuBottom = Number.isFinite(input.menuButtonBottom) ? input.menuButtonBottom : 0;
  const effectiveMenuBottom = rawMenuBottom > 0 ? rawMenuBottom : input.isMiniGame ? safeTop + 42 : 0;
  const safeScreenY = Math.max(safeTop, effectiveMenuBottom > 0 ? effectiveMenuBottom + 14 : 0);
  if (safeScreenY <= 0 || !Number.isFinite(input.scale) || input.scale <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(280, Math.ceil(safeScreenY / input.scale)));
}

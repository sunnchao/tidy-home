import { describe, expect, it } from 'vitest';
import {
  computeSafeTopOffset,
  countActiveTouches,
  extractActiveTouchPoints,
  extractTouchPoint,
  extractTouchPoints,
  hitRegionAt,
  isDuplicateTap,
  isRecentTap,
  screenToLogic,
  TAP_DEDUPE_MS,
  TAP_SOURCE_DEDUPE_MS,
  type ViewportTransform,
} from '../src/minigame/input';

const viewport: ViewportTransform = {
  screenW: 390,
  screenH: 753,
  dpr: 3,
  scale: 0.542,
  offsetX: 0,
  offsetY: 29.8,
};

describe('extractTouchPoint', () => {
  it('accepts array-like touch lists from the DevTools runtime', () => {
    expect(
      extractTouchPoint({
        touches: { 0: { clientX: 12, clientY: 34 }, length: 1 },
      })
    ).toEqual({ x: 12, y: 34 });
  });

  it('falls back to changedTouches when touches is empty', () => {
    expect(
      extractTouchPoint({
        touches: { length: 0 },
        changedTouches: { 0: { clientX: 56, clientY: 78 }, length: 1 },
      })
    ).toEqual({ x: 56, y: 78 });
  });

  it('reads detail coordinates from synthetic DOM events', () => {
    expect(extractTouchPoint({ detail: { x: 91, y: 82 } })).toEqual({ x: 91, y: 82 });
  });

  it('returns null for missing or non-finite coordinates', () => {
    expect(extractTouchPoint(null)).toBeNull();
    expect(extractTouchPoint({ touches: { length: 0 } })).toBeNull();
    expect(extractTouchPoint({ clientX: Number.NaN, clientY: 10 })).toBeNull();
  });

  it('extracts multi-touch arrays for pinch zoom gestures', () => {
    expect(
      extractTouchPoints({
        touches: {
          0: { clientX: 40, clientY: 80 },
          1: { clientX: 200, clientY: 300 },
          length: 2,
        },
      })
    ).toEqual([
      { x: 40, y: 80 },
      { x: 200, y: 300 },
    ]);
  });

  it('ignores changedTouches in active touch extraction so pinch lift clears cleanly', () => {
    const touchEndEv = {
      touches: { length: 0 },
      changedTouches: { 0: { clientX: 120, clientY: 220 }, length: 1 },
    };
    expect(extractActiveTouchPoints(touchEndEv)).toEqual([]);
    expect(countActiveTouches(touchEndEv)).toBe(0);
    // Legacy extractTouchPoints still reads changedTouches for single-tap fallback
    expect(extractTouchPoints(touchEndEv)).toEqual([{ x: 120, y: 220 }]);
  });
});

describe('screenToLogic', () => {
  it('maps the DevTools CSS viewport to the 720x1280 logical stage', () => {
    const point = screenToLogic({ x: 195, y: 503 }, viewport);
    expect(point.x).toBeCloseTo(359.8, 1);
    expect(point.y).toBeCloseTo(873.1, 1);
  });

  it('divides backing-store pixels reported instead of CSS pixels', () => {
    expect(
      screenToLogic(
        { x: 1170, y: 2259 },
        { screenW: 390, screenH: 753, dpr: 3, scale: 1, offsetX: 0, offsetY: 0 }
      )
    ).toEqual({ x: 390, y: 753 });
  });

  it('does not divide coordinates that are already CSS pixels', () => {
    expect(
      screenToLogic(
        { x: 390, y: 753 },
        { screenW: 390, screenH: 753, dpr: 3, scale: 1, offsetX: 0, offsetY: 0 }
      )
    ).toEqual({ x: 390, y: 753 });
  });
});

describe('hitRegionAt', () => {
  it('returns the top-most overlapping region', () => {
    const bottom = { id: 'bottom', x: 0, y: 0, w: 100, h: 100 };
    const top = { id: 'top', x: 10, y: 10, w: 20, h: 20 };
    expect(hitRegionAt([bottom, top], { x: 15, y: 15 })?.id).toBe('top');
  });

  it('returns undefined outside every region', () => {
    expect(hitRegionAt([{ x: 0, y: 0, w: 10, h: 10 }], { x: 20, y: 20 })).toBeUndefined();
  });
});

describe('isDuplicateTap', () => {
  it('filters the second event for the same physical tap', () => {
    expect(
      isDuplicateTap(100, { x: 50, y: 50 }, { atMs: 100 - TAP_DEDUPE_MS + 1, x: 52, y: 51 })
    ).toBe(true);
  });

  it('allows taps outside the time window', () => {
    expect(
      isDuplicateTap(300, { x: 50, y: 50 }, { atMs: 100, x: 50, y: 50 })
    ).toBe(false);
  });

  it('allows a distinct tap at another location', () => {
    expect(
      isDuplicateTap(100, { x: 90, y: 90 }, { atMs: 99, x: 50, y: 50 })
    ).toBe(false);
  });
});

describe('isRecentTap', () => {
  it('suppresses a second input channel for the same physical press', () => {
    expect(isRecentTap(140, { atMs: 100, x: 50, y: 50 })).toBe(true);
    expect(isRecentTap(100 + TAP_SOURCE_DEDUPE_MS, { atMs: 100, x: 50, y: 50 })).toBe(false);
  });

  it('does not suppress the first tap', () => {
    expect(isRecentTap(100, null)).toBe(false);
  });
});

describe('computeSafeTopOffset', () => {
  it('clears WeChat/Douyin capsule bottom + margin without clipping on tall phones', () => {
    const scale = 390 / 720;
    const offset = computeSafeTopOffset({
      statusBarHeight: 47,
      safeAreaTop: 47,
      menuButtonBottom: 86,
      scale,
      isMiniGame: true,
    });
    expect(offset * scale).toBeGreaterThanOrEqual(86 + 14);
    expect(offset).toBeLessThanOrEqual(280);
  });

  it('uses safe fallback below status bar when menu rect is unavailable inside MiniGame', () => {
    const scale = 375 / 720;
    const offset = computeSafeTopOffset({
      statusBarHeight: 44,
      safeAreaTop: 44,
      menuButtonBottom: 0,
      scale,
      isMiniGame: true,
    });
    expect(offset * scale).toBeGreaterThanOrEqual(44 + 42 + 14);
  });

  it('returns 0 in non-MiniGame environment without insets', () => {
    expect(
      computeSafeTopOffset({
        statusBarHeight: 0,
        safeAreaTop: 0,
        menuButtonBottom: 0,
        scale: 1,
        isMiniGame: false,
      })
    ).toBe(0);
  });
});

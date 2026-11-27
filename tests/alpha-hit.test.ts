import { describe, expect, it } from 'vitest';
import { getRotatedBounds, hitTestRotatedSprite, type AlphaMask } from '@shared/alphaHitTest';

function makeVerticalBarMask(gridSize = 8): AlphaMask {
  const alphaGrid = new Uint8Array(gridSize * gridSize);
  const midL = Math.floor(gridSize / 2) - 1;
  const midR = Math.floor(gridSize / 2);
  for (let y = 0; y < gridSize; y++) {
    for (let x = midL; x <= midR; x++) {
      alphaGrid[y * gridSize + x] = 255;
    }
  }
  return { gridSize, alphaGrid };
}

describe('Pixel-Alpha Rotated Sprite Hit Testing', () => {
  it('passes through transparent sprite corners while hitting opaque center shapes', () => {
    const mask = makeVerticalBarMask(16);
    const box = { cx: 200, cy: 300, w: 100, h: 200, rotationDeg: 0 };

    // Center opaque strip hits
    expect(hitTestRotatedSprite(200, 300, box, mask)).toBe(true);
    // Far left transparent corner misses despite being inside box AABB
    expect(hitTestRotatedSprite(156, 210, box, mask)).toBe(false);
    // Outside rect misses
    expect(hitTestRotatedSprite(300, 300, box, mask)).toBe(false);
  });

  it('rotates hit space matching sprite rotationDeg and computes tight AABB', () => {
    const mask = makeVerticalBarMask(16);
    const box = { cx: 100, cy: 100, w: 80, h: 160, rotationDeg: 90 };

    // When rotated 90 degrees, the vertical bar lies horizontally across y=100, x=30..170
    expect(hitTestRotatedSprite(40, 100, box, mask)).toBe(true);
    expect(hitTestRotatedSprite(100, 70, box, mask)).toBe(false);

    const bounds = getRotatedBounds(box);
    expect(bounds.w).toBeCloseTo(160, 2);
    expect(bounds.h).toBeCloseTo(80, 2);
  });

  it('falls back to rotated rectangle hit testing when mask is unavailable', () => {
    const box = { cx: 100, cy: 100, w: 100, h: 50, rotationDeg: 45 };
    expect(hitTestRotatedSprite(100, 100, box, null)).toBe(true);
    expect(hitTestRotatedSprite(160, 100, box, null)).toBe(false);
  });
});

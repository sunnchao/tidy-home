export interface AlphaMask {
  gridSize: number;
  alphaGrid: Uint8Array;
}

export interface RotatedSpriteBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotationDeg: number;
}

export const DEFAULT_ALPHA_GRID_SIZE = 32;

/**
 * Computes conservative axis-aligned bounding box of a rotated sprite rectangle.
 */
export function getRotatedBounds(box: RotatedSpriteBox): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const rad = (box.rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const aabbW = box.w * cos + box.h * sin;
  const aabbH = box.w * sin + box.h * cos;
  return {
    x: box.cx - aabbW * 0.5,
    y: box.cy - aabbH * 0.5,
    w: aabbW,
    h: aabbH,
  };
}

/**
 * Tests whether `(ptX, ptY)` hits the non-transparent pixels of a rotated sprite.
 * Includes a ~1 grid-cell forgiving touch margin so slender items (e.g. guitar neck, key blades)
 * stay easy to tap on touch screens without blocking adjacent transparent corners.
 * If `mask` is unavailable, falls back to exact rotated rectangle hit testing.
 */
export function hitTestRotatedSprite(
  ptX: number,
  ptY: number,
  box: RotatedSpriteBox,
  mask: AlphaMask | null | undefined,
  alphaThreshold = 20
): boolean {
  if (box.w <= 0 || box.h <= 0) return false;
  const dx = ptX - box.cx;
  const dy = ptY - box.cy;
  const rad = (-box.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  const u = localX / box.w + 0.5;
  const v = localY / box.h + 0.5;
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
  if (!mask || mask.alphaGrid.length === 0) return true;

  const size = mask.gridSize;
  const gx = Math.min(size - 1, Math.max(0, Math.floor(u * size)));
  const gy = Math.min(size - 1, Math.max(0, Math.floor(v * size)));
  if (mask.alphaGrid[gy * size + gx] >= alphaThreshold) return true;

  for (let oy = -1; oy <= 1; oy++) {
    const ny = gy + oy;
    if (ny < 0 || ny >= size) continue;
    for (let ox = -1; ox <= 1; ox++) {
      if (ox === 0 && oy === 0) continue;
      const nx = gx + ox;
      if (nx < 0 || nx >= size) continue;
      if (mask.alphaGrid[ny * size + nx] >= alphaThreshold) {
        const subX = u * size - (nx + 0.5);
        const subY = v * size - (ny + 0.5);
        if (subX * subX + subY * subY <= 1.05) {
          return true;
        }
      }
    }
  }
  return false;
}

export type CanvasFactory = (width: number, height: number) => {
  width: number;
  height: number;
  getContext: (kind: '2d') => any;
} | null;

/**
 * Lazily samples and caches 32x32 alpha bitmasks for loaded sprite images.
 */
export class AlphaMaskStore {
  private readonly cache = new Map<string, AlphaMask | null>();
  private scratchCanvas: ReturnType<CanvasFactory> = null;
  private scratchCtx: any = null;

  constructor(
    private readonly createCanvas: CanvasFactory,
    private readonly gridSize = DEFAULT_ALPHA_GRID_SIZE
  ) {}

  getMask(key: string, image: any): AlphaMask | null {
    if (this.cache.has(key)) {
      return this.cache.get(key) ?? null;
    }
    const w = Number(image?.naturalWidth ?? image?.width ?? 0);
    const h = Number(image?.naturalHeight ?? image?.height ?? 0);
    if (!image || w <= 0 || h <= 0) {
      return null;
    }
    if (image.complete === false) {
      return null;
    }

    if (!this.scratchCanvas) {
      this.scratchCanvas = this.createCanvas(this.gridSize, this.gridSize);
      this.scratchCtx = this.scratchCanvas?.getContext('2d') ?? null;
    }
    if (!this.scratchCtx) {
      this.cache.set(key, null);
      return null;
    }

    try {
      this.scratchCtx.clearRect(0, 0, this.gridSize, this.gridSize);
      this.scratchCtx.drawImage(image, 0, 0, this.gridSize, this.gridSize);
      const data = this.scratchCtx.getImageData(0, 0, this.gridSize, this.gridSize)?.data;
      if (!data || data.length < this.gridSize * this.gridSize * 4) {
        this.cache.set(key, null);
        return null;
      }
      const alphaGrid = new Uint8Array(this.gridSize * this.gridSize);
      let hasOpaque = false;
      for (let i = 0; i < alphaGrid.length; i++) {
        const a = data[i * 4 + 3];
        alphaGrid[i] = a;
        if (a >= 20) hasOpaque = true;
      }
      const mask = hasOpaque ? { gridSize: this.gridSize, alphaGrid } : null;
      this.cache.set(key, mask);
      return mask;
    } catch {
      this.cache.set(key, null);
      return null;
    }
  }
}

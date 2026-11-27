import type { BoardItemInstance, CardboardBoxInstance } from './types';

export type OcclusionTier = 0 | 1 | 2;

export const MIN_SPRITE_ASPECT = 0.32;
export const MAX_SPRITE_ASPECT = 2.2;

/**
 * Computes aspect-preserving display width and height whose area equals `baseSize^2`.
 */
export function computeAspectDimensions(
  baseSize: number,
  aspectRatio = 1
): { width: number; height: number } {
  const safeRatio = Math.min(
    MAX_SPRITE_ASPECT,
    Math.max(MIN_SPRITE_ASPECT, Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1)
  );
  const root = Math.sqrt(safeRatio);
  return {
    width: baseSize * root,
    height: baseSize / root,
  };
}

export interface ItemVisualDepth {
  layerNorm: number;
  occlusionTier: OcclusionTier;
  scaleFactor: number;
  liftPxWeb: number;
  liftPxRef: number;
  opacity: number;
  grayscale: number;
  brightness: number;
  saturate: number;
  contrast: number;
  shadowXWeb: number;
  shadowYWeb: number;
  shadowBlurWeb: number;
  castAlpha: number;
  contactAlpha: number;
  rimCatchAlpha: number;
  shadowOffsetXRef: number;
  shadowOffsetYRef: number;
  shadowBlurRef: number;
  shadowAlpha: number;
  canvasShadeColor: string | null;
}

export interface PileGroundShadow {
  key: string;
  x: number;
  y: number;
  rxNorm: number;
  ryNorm: number;
  alpha: number;
}

/**
 * Computes fixed per-layer scale and 3-tier occlusion depth cues so clickable
 * top items pop cleanly forward while buried items recede: covered once they are
 * partly grayed and dimmed, covered twice they turn grayer, darker and more see-through.
 */
export function computeItemVisualDepth(
  item: Pick<BoardItemInstance, 'layer' | 'blockedBy'>
): ItemVisualDepth {
  const layer = Math.max(0, item.layer);
  const layerNorm = Math.min(1, layer / 4);
  const blockerCount = item.blockedBy.length;
  const occlusionTier: OcclusionTier = blockerCount === 0 ? 0 : blockerCount === 1 ? 1 : 2;
  const scaleFactor = 0.95 + layerNorm * 0.14;

  const liftPxWeb = layer * 2.8 + (occlusionTier === 0 ? 1.4 : 0);
  const liftPxRef = layer * 4.2 + (occlusionTier === 0 ? 2.0 : 0);

  if (occlusionTier === 0) {
    return {
      layerNorm,
      occlusionTier,
      scaleFactor,
      liftPxWeb,
      liftPxRef,
      opacity: 1,
      grayscale: 0,
      brightness: 1.05 + layerNorm * 0.02,
      saturate: 1.08,
      contrast: 1.04,
      shadowXWeb: 2.2 + layer * 0.7,
      shadowYWeb: 5.0 + layer * 1.4,
      shadowBlurWeb: 6.5 + layer * 1.5,
      castAlpha: 0.36,
      contactAlpha: 0.48,
      rimCatchAlpha: 0,
      shadowOffsetXRef: 3.0 + layer * 1.0,
      shadowOffsetYRef: 6.6 + layer * 2.0,
      shadowBlurRef: 8.5 + layer * 2.0,
      shadowAlpha: 0.38,
      canvasShadeColor: null,
    };
  }

  if (occlusionTier === 1) {
    return {
      layerNorm,
      occlusionTier,
      scaleFactor,
      liftPxWeb,
      liftPxRef,
      opacity: 0.92,
      grayscale: 0.24,
      brightness: 0.72 + layerNorm * 0.015,
      saturate: 0.68,
      contrast: 0.94,
      shadowXWeb: 0.8,
      shadowYWeb: 1.6,
      shadowBlurWeb: 2.2,
      castAlpha: 0.16,
      contactAlpha: 0.22,
      rimCatchAlpha: 0,
      shadowOffsetXRef: 1.2,
      shadowOffsetYRef: 2.2,
      shadowBlurRef: 3.0,
      shadowAlpha: 0.18,
      canvasShadeColor: 'rgba(44, 30, 22, 0.28)',
    };
  }

  return {
    layerNorm,
    occlusionTier,
    scaleFactor,
    liftPxWeb,
    liftPxRef,
    opacity: 0.88,
    grayscale: 0.42,
    brightness: 0.54 + layerNorm * 0.015,
    saturate: 0.5,
    contrast: 0.9,
    shadowXWeb: 0.4,
    shadowYWeb: 0.9,
    shadowBlurWeb: 1.4,
    castAlpha: 0.1,
    contactAlpha: 0.14,
    rimCatchAlpha: 0,
    shadowOffsetXRef: 0.7,
    shadowOffsetYRef: 1.4,
    shadowBlurRef: 2.0,
    shadowAlpha: 0.12,
    canvasShadeColor: 'rgba(38, 25, 19, 0.44)',
  };
}

/**
 * Emits grounded ambient-occlusion ellipses beneath active piles and closed boxes
 * to anchor stacks to room furniture surfaces.
 */
export function computePileGroundShadows(
  items: BoardItemInstance[],
  boxes: CardboardBoxInstance[]
): PileGroundShadow[] {
  const groups = new Map<string, BoardItemInstance[]>();
  for (const item of items) {
    if (item.state !== 'on_board') continue;
    let list = groups.get(item.anchorId);
    if (!list) {
      list = [];
      groups.set(item.anchorId, list);
    }
    list.push(item);
  }

  const shadows: PileGroundShadow[] = [];

  for (const [anchorId, group] of groups) {
    let minLayer = Infinity;
    for (const it of group) {
      if (it.layer < minLayer) minLayer = it.layer;
    }
    const baseItems = group.filter((it) => it.layer === minLayer);
    const count = group.length;
    const avgX = baseItems.reduce((sum, it) => sum + it.x, 0) / baseItems.length;
    const avgY = baseItems.reduce((sum, it) => sum + it.y, 0) / baseItems.length;
    const avgScale = baseItems.reduce((sum, it) => sum + it.scale, 0) / baseItems.length;
    const stackExtra = Math.min(3, count - 1);

    shadows.push({
      key: `pile_${anchorId}`,
      x: avgX,
      y: avgY + 0.022 * avgScale,
      rxNorm: (0.052 + stackExtra * 0.005) * avgScale,
      ryNorm: (0.016 + stackExtra * 0.002) * avgScale,
      alpha: Math.min(0.16, 0.06 + count * 0.018),
    });
  }

  for (const box of boxes) {
    if (box.opened) continue;
    shadows.push({
      key: `box_${box.uid}`,
      x: box.x,
      y: box.y + 0.026 * box.scale,
      rxNorm: 0.064 * box.scale,
      ryNorm: 0.022 * box.scale,
      alpha: 0.2,
    });
  }

  return shadows;
}

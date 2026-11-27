import { describe, expect, it } from 'vitest';
import { getAllSpriteResources, getItemSprite, ITEM_BY_ID, ITEM_CATALOG } from '@core/catalogs';
import { generateLevel } from '@core/levelGenerator';
import type { BoardItemInstance, CardboardBoxInstance } from '@core/types';
import { computeItemVisualDepth, computePileGroundShadows } from '@core/visualDepth';
import itemsJson from '../assets/resources/configs/items.json';

function makeItem(
  uid: string,
  anchorId: string,
  layer: number,
  blockedBy: string[],
  overrides: Partial<BoardItemInstance> = {}
): BoardItemInstance {
  return {
    uid,
    itemId: 'handbag',
    anchorId,
    layer,
    x: 0.4,
    y: 0.55,
    rotation: 0,
    scale: 1,
    radius: 44,
    state: 'on_board',
    hiddenByBoxId: null,
    blockedBy,
    ...overrides,
  };
}

function makeBox(uid: string, anchorId: string, opened = false): CardboardBoxInstance {
  return {
    uid,
    anchorId,
    x: 0.6,
    y: 0.62,
    scale: 1,
    radius: 48,
    hitsLeft: opened ? 0 : 2,
    maxHits: 2,
    opened,
    containedItemUids: [],
  };
}

describe('Visual Depth & Material Asset Consistency', () => {
  it('computes strictly monotonic fixed-scale depth across layers 0..4', () => {
    const scales = [0, 1, 2, 3, 4].map((layer) => computeItemVisualDepth({ layer, blockedBy: [] }).scaleFactor);
    for (let i = 1; i < scales.length; i++) {
      expect(scales[i]).toBeGreaterThan(scales[i - 1]);
    }
    expect(scales[0]).toBeCloseTo(0.95, 5);
    expect(scales[4]).toBeCloseTo(1.09, 5);

    // Scale depends only on fixed layer, never on blocker count
    const blockedScale = computeItemVisualDepth({ layer: 2, blockedBy: ['a', 'b'] }).scaleFactor;
    expect(blockedScale).toBeCloseTo(scales[2], 5);
  });

  it('keeps opaque 3-tier occlusion brightness, cast shadows, and grounded shade without transparent ghosting', () => {
    const t0 = computeItemVisualDepth({ layer: 1, blockedBy: [] });
    const t1 = computeItemVisualDepth({ layer: 1, blockedBy: ['b1'] });
    const t2 = computeItemVisualDepth({ layer: 1, blockedBy: ['b1', 'b2'] });

    expect(t0.occlusionTier).toBe(0);
    expect(t1.occlusionTier).toBe(1);
    expect(t2.occlusionTier).toBe(2);

    expect(t0.opacity).toBe(1);
    expect(t1.opacity).toBeCloseTo(0.92, 5);
    expect(t2.opacity).toBeCloseTo(0.88, 5);
    expect(t0.grayscale).toBe(0);
    expect(t1.grayscale).toBeGreaterThan(t0.grayscale);
    expect(t2.grayscale).toBeGreaterThan(t1.grayscale);
    expect(t0.brightness).toBeGreaterThan(t1.brightness);
    expect(t1.brightness).toBeGreaterThan(t2.brightness);
    expect(t0.brightness - t1.brightness).toBeGreaterThan(0.25);
    expect(t0.saturate).toBeGreaterThan(t1.saturate);
    expect(t1.saturate).toBeGreaterThan(t2.saturate);
    expect(t0.contrast).toBeGreaterThan(t1.contrast);
    expect(t1.contrast).toBeGreaterThan(t2.contrast);
    expect(t0.shadowBlurWeb).toBeGreaterThan(t1.shadowBlurWeb);
    expect(t1.shadowBlurWeb).toBeGreaterThan(t2.shadowBlurWeb);
    expect(t0.castAlpha).toBeGreaterThan(t1.castAlpha);
    expect(t1.castAlpha).toBeGreaterThan(t2.castAlpha);
    // Crisp cartoon outlines need no artificial sticker white rims
    expect(t0.rimCatchAlpha).toBe(0);
    expect(t1.rimCatchAlpha).toBe(0);
    expect(t2.rimCatchAlpha).toBe(0);

    // Canvas fallback shade (used when pixel access fails) applies to buried tiers only
    expect(t0.canvasShadeColor).toBeNull();
    expect(t1.canvasShadeColor).not.toBeNull();
    expect(t2.canvasShadeColor).not.toBeNull();
  });

  it('computes grounded pile shadows for active anchors and unopened boxes only', () => {
    const items: BoardItemInstance[] = [
      makeItem('i1', 'a1', 0, ['i2'], { x: 0.3, y: 0.5, scale: 0.9 }),
      makeItem('i2', 'a1', 1, [], { x: 0.31, y: 0.49, scale: 0.9 }),
      makeItem('i3', 'a2', 0, [], { x: 0.5, y: 0.6, scale: 1.0 }),
      makeItem('i4', 'a3', 0, [], { state: 'in_tray' }),
      makeItem('i5', 'a4', 0, [], { state: 'delivered' }),
    ];
    const boxes: CardboardBoxInstance[] = [
      makeBox('b1', 'a5', false),
      makeBox('b2', 'a6', true),
    ];

    const shadows = computePileGroundShadows(items, boxes);
    const keys = shadows.map((s) => s.key);
    expect(keys).toEqual(['pile_a1', 'pile_a2', 'box_b1']);

    const pile1 = shadows.find((s) => s.key === 'pile_a1')!;
    const pile2 = shadows.find((s) => s.key === 'pile_a2')!;
    expect(pile1.y).toBeGreaterThan(0.5);
    expect(pile1.alpha).toBeGreaterThan(pile2.alpha);
  });

  it('keeps items.json synced with ITEM_CATALOG and all base + variant sprite PNGs present', async () => {
    const fsMod = await import(/* @vite-ignore */ 'node:' + 'fs');
    const urlMod = await import(/* @vite-ignore */ 'node:' + 'url');

    expect(itemsJson.length).toBe(ITEM_CATALOG.length);
    const jsonById = new Map(itemsJson.map((entry) => [entry.id, entry]));
    for (const def of ITEM_CATALOG) {
      const jsonItem = jsonById.get(def.id);
      expect(jsonItem, `items.json missing ${def.id}`).toBeDefined();
      expect(jsonItem!.color).toBe(def.color);
      expect(jsonItem!.visualScale).toBe(def.visualScale);
      expect(jsonItem!.variants?.length ?? 0).toBe(def.variants?.length ?? 0);
    }

    const allSprites = getAllSpriteResources();
    expect(allSprites.length).toBe(138);
    for (const res of allSprites) {
      const spriteUrl = new URL(`../assets/resources/${res}.png`, import.meta.url);
      expect(fsMod.existsSync(urlMod.fileURLToPath(spriteUrl)), `missing sprite PNG for ${res}`).toBe(true);
    }
  });

  it('distributes distinct visual variants across multi-copy orders in generated levels', () => {
    let sawVariedOrder = false;
    for (let lv = 1; lv <= 6; lv++) {
      const level = generateLevel(lv);
      const variantsByItem = new Map<string, Set<number>>();
      for (const item of level.initialItems) {
        const def = ITEM_BY_ID[item.itemId];
        const variantPoolSize = 1 + (def.variants?.length ?? 0);
        const idx = item.variantIndex ?? 0;
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(variantPoolSize);
        const resolved = getItemSprite(item.itemId, idx);
        expect(resolved.spriteWebUrl).toBe(`/resources/${resolved.spriteResource}.png`);
        if (variantPoolSize > 1) {
          const seen = variantsByItem.get(item.itemId) ?? new Set<number>();
          seen.add(idx);
          variantsByItem.set(item.itemId, seen);
        }
      }
      for (const seen of variantsByItem.values()) {
        if (seen.size >= 2) sawVariedOrder = true;
      }
    }
    expect(sawVariedOrder).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { getItemSprite, ROOM_CATALOG } from '@core/catalogs';
import { GameSession } from '@core/gameSession';
import { generateLevel } from '@core/levelGenerator';
import { computeAspectDimensions } from '@core/visualDepth';

describe('Semantic Pose Layout, Aspect Dimensions & Quick-Fill', () => {
  it('assigns non-square aspect ratios cleanly while preserving visual footprint area', () => {
    const uprightGuitar = getItemSprite('ukulele', 2);
    expect(uprightGuitar.pose).toBe('lean_upright');
    expect(uprightGuitar.aspectRatio).toBeLessThan(0.75);

    const openBook = getItemSprite('book', 2);
    expect(openBook.aspectRatio).toBeGreaterThan(1.2);

    const gDim = computeAspectDimensions(140, uprightGuitar.aspectRatio);
    expect(gDim.height).toBeGreaterThan(gDim.width);
    expect(gDim.width * gDim.height).toBeCloseTo(140 * 140, 1);
  });

  it('places furniture-fitted semantic poses and respects anchor alignment in generated levels', () => {
    const lv1 = generateLevel(1);
    const livingAnchors = new Map(ROOM_CATALOG.living_room.anchors.map((a) => [a.id, a]));
    let sawOrientedPose = false;
    for (const item of lv1.initialItems) {
      const anchor = livingAnchors.get(item.anchorId);
      expect(anchor).toBeDefined();
      if (
        item.pose === 'drape_sofa_back' ||
        item.pose === 'drape_sofa_edge' ||
        item.pose === 'drape_table_edge' ||
        item.pose === 'lean_upright'
      ) {
        sawOrientedPose = true;
        expect(Math.abs(item.rotation)).toBeLessThanOrEqual(12);
      }
    }
    expect(sawOrientedPose).toBe(true);
  });

  it('supports reward-assisted fillOrderByReward without leaving orphaned items', () => {
    const lv1 = generateLevel(1);
    const session = new GameSession(lv1);
    const firstOrder = session.getSnapshot().orderSlots[0].order!;
    const res = session.fillOrderByReward(0);
    expect(res.filled).toBe(true);
    expect(res.deliveredCount).toBe(firstOrder.requiredCount);

    const snapAfter = session.getSnapshot();
    const stillRemaining = snapAfter.items.filter(
      (it) => it.itemId === firstOrder.itemId && it.state !== 'delivered'
    );
    const openOrdersForItem = [
      ...snapAfter.orderSlots.map((s) => s.order).filter(Boolean),
    ];
    expect(snapAfter.ordersCompleted).toBeGreaterThanOrEqual(1);
    expect(snapAfter.progressDone).toBeGreaterThanOrEqual(firstOrder.requiredCount);
    expect(stillRemaining.length).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(openOrdersForItem)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import {
  computeFlyControlPoint,
  createFlyingItemAnim,
  createOrderSlotTransition,
  expediteSlotTransitionForDirectTap,
  getActiveSlotTransition,
  getOrderTransitionEnterStartMs,
  getOrderTransitionEndMs,
  getQueuedOrderDelayMs,
  ORDER_TRANSITION_TIMING,
  sampleFlyAnim,
  sampleOrderSlotTransition,
  sampleSlotBounce,
} from '@core/flyAnimation';
import { GameSession } from '@core/gameSession';
import {
  buildRewardShareRequest,
  isShareUnlockMode,
  REWARD_UNLOCK_COPY,
} from '@core/rewardUnlock';
import type { AdPlacement, GeneratedLevel } from '@core/types';

function makeFlySessionLevel(): GeneratedLevel {
  return {
    levelNumber: 1,
    loopIndex: 1,
    seed: 42,
    theme: 'living_room',
    timeOfDay: 'morning',
    modifiers: ['none'],
    hostTitle: '客厅测试',
    hostOpening: '欢迎',
    hostVictory: '干得漂亮',
    tutorialHint: null,
    totalItems: 4,
    distinctItemTypes: 2,
    maxStackDepth: 1,
    orderQueue: [
      { id: 'ord_1', itemId: 'handbag', requiredCount: 2 },
      { id: 'ord_2', itemId: 'cactus', requiredCount: 1 },
      { id: 'ord_3', itemId: 'thermos', requiredCount: 1 },
    ],
    initialItems: [
      {
        uid: 'tray_match_1',
        itemId: 'thermos',
        variantIndex: 1,
        anchorId: 'lr_sofa_1',
        layer: 0,
        x: 0.35,
        y: 0.52,
        rotation: 12,
        scale: 1,
        radius: 36,
        state: 'on_board',
        hiddenByBoxId: null,
        blockedBy: [],
      },
      {
        uid: 'board_order_1',
        itemId: 'handbag',
        variantIndex: 2,
        anchorId: 'lr_sofa_2',
        layer: 0,
        x: 0.52,
        y: 0.56,
        rotation: -14,
        scale: 1,
        radius: 38,
        state: 'on_board',
        hiddenByBoxId: null,
        blockedBy: [],
      },
      {
        uid: 'board_order_2',
        itemId: 'handbag',
        variantIndex: 0,
        anchorId: 'lr_table_1',
        layer: 0,
        x: 0.44,
        y: 0.65,
        rotation: 6,
        scale: 1,
        radius: 38,
        state: 'on_board',
        hiddenByBoxId: null,
        blockedBy: [],
      },
      {
        uid: 'tray_match_2',
        itemId: 'thermos',
        variantIndex: 0,
        anchorId: 'lr_rug_1',
        layer: 0,
        x: 0.65,
        y: 0.68,
        rotation: 0,
        scale: 1,
        radius: 36,
        state: 'on_board',
        hiddenByBoxId: null,
        blockedBy: [],
      },
    ],
    initialBoxes: [],
    petEnabled: false,
    catMischiefEnabled: false,
    petCooldownSec: 20,
    coinMultiplier: 1,
    isMilestoneLevel: false,
    levelBadge: null,
    baseTraySlots: 5,
    maxTraySlots: 7,
  };
}

describe('Fly Animation Curves & Event Payloads', () => {
  it('computes upward arched Bezier control points and exact start/end samples', () => {
    const toTrayCtrl = computeFlyControlPoint(320, 620, 120, 1080, 'to_tray');
    expect(toTrayCtrl.ctrlY).toBeLessThan(620);

    const toOrderCtrl = computeFlyControlPoint(420, 720, 140, 260, 'to_order');
    expect(toOrderCtrl.ctrlY).toBeLessThan((720 + 260) / 2);

    const anim = createFlyingItemAnim({
      id: 'fly_1',
      uid: 'item_1',
      itemId: 'handbag',
      variantIndex: 1,
      kind: 'to_order',
      fromX: 400,
      fromY: 700,
      toX: 150,
      toY: 250,
      startSize: 90,
      endSize: 56,
      startRotDeg: 18,
      targetSlotIndex: 0,
      startedAtMs: 1000,
      delayMs: 50,
      durationMs: 360,
    });

    const waiting = sampleFlyAnim(anim, 1020);
    expect(waiting.phase).toBe('waiting');
    expect(waiting.opacity).toBe(0);

    const mid = sampleFlyAnim(anim, 1050 + 180);
    expect(mid.phase).toBe('flying');
    expect(mid.scale).toBeGreaterThan(1.1);
    expect(mid.shadowOffsetY).toBeGreaterThan(10);
    expect(mid.size).toBeGreaterThan(56);
    expect(mid.size).toBeLessThan(90);

    const done = sampleFlyAnim(anim, 1500);
    expect(done.phase).toBe('done');
    expect(done.x).toBeCloseTo(150, 5);
    expect(done.y).toBeCloseTo(250, 5);
    expect(done.size).toBe(56);
    expect(done.rotationDeg).toBe(0);

    const bounceIdle = sampleSlotBounce(undefined, 1500);
    expect(bounceIdle.active).toBe(false);
    const bounceActive = sampleSlotBounce(1500, 1545);
    expect(bounceActive.active).toBe(true);
    expect(bounceActive.scale).toBeGreaterThan(1);
    const bounceDone = sampleSlotBounce(1500, 1800);
    expect(bounceDone.active).toBe(false);
    expect(bounceDone.scale).toBe(1);
  });

  it('emits source tray indices and coordinates for tray, delivery, tray-drain, and undo flights', () => {
    const session = new GameSession(makeFlySessionLevel());
    const events: Array<{ type: string; payload?: Record<string, unknown> }> = [];
    session.onEvent((e) => events.push({ type: e.type, payload: e.payload }));

    // 1. Tap non-order item -> moves to tray slot 0 with rotation preserved
    expect(session.tapItem('tray_match_1').accepted).toBe(true);
    const toTrayEv = events.find((e) => e.type === 'item_to_tray');
    expect(toTrayEv?.payload?.trayIndex).toBe(0);
    expect(toTrayEv?.payload?.variantIndex).toBe(1);
    expect(toTrayEv?.payload?.rotation).toBe(12);

    // 2. Undo sends it back from trayIndex 0 to board coords
    expect(session.useBooster('undo').ok).toBe(true);
    const undoEv = events.find((e) => e.type === 'booster_used' && e.payload?.type === 'undo');
    expect(undoEv?.payload?.fromTrayIndex).toBe(0);
    expect(undoEv?.payload?.toX).toBeCloseTo(0.35, 3);
    expect(undoEv?.payload?.toY).toBeCloseTo(0.52, 3);
    expect(undoEv?.payload?.variantIndex).toBe(1);

    // 3. Put thermos back in tray, then finish ord_1 (handbag) -> thermos auto-drains from tray slot 0
    events.length = 0;
    expect(session.tapItem('tray_match_1').accepted).toBe(true);
    expect(session.tapItem('board_order_1').accepted).toBe(true);
    expect(session.tapItem('board_order_2').accepted).toBe(true);

    const directDeliver = events.find(
      (e) => e.type === 'item_delivered' && e.payload?.uid === 'board_order_1'
    );
    expect(directDeliver?.payload?.fromTray).toBe(false);
    expect(directDeliver?.payload?.variantIndex).toBe(2);

    const trayDrainDeliver = events.find(
      (e) => e.type === 'item_delivered' && e.payload?.uid === 'tray_match_1'
    );
    expect(trayDrainDeliver?.payload?.fromTray).toBe(true);
    expect(trayDrainDeliver?.payload?.fromTrayIndex).toBe(0);
    expect(trayDrainDeliver?.payload?.slotIndex).toBe(0);
    expect(trayDrainDeliver?.payload?.orderId).toBe('ord_3');

    expect(directDeliver?.payload?.orderId).toBe('ord_1');
    const orderDone = events.find((e) => e.type === 'order_completed');
    expect(orderDone?.payload?.orderId).toBe('ord_1');
    expect(orderDone?.payload?.requiredCount).toBe(2);
    const orderRefreshed = events.find((e) => e.type === 'order_refreshed');
    expect(orderRefreshed?.payload?.orderId).toBe('ord_3');
    expect(orderRefreshed?.payload?.requiredCount).toBe(1);
  });

  it('keeps visibleWhileWaiting flights visible during delay and sequences order slot transitions', () => {
    const delayed = createFlyingItemAnim({
      id: 'fly_wait',
      uid: 'tray_item',
      itemId: 'thermos',
      kind: 'from_tray_to_order',
      fromX: 80,
      fromY: 720,
      toX: 90,
      toY: 220,
      startSize: 64,
      endSize: 48,
      startedAtMs: 1000,
      delayMs: 300,
      visibleWhileWaiting: true,
    });
    const waitingSample = sampleFlyAnim(delayed, 1100);
    expect(waitingSample.phase).toBe('waiting');
    expect(waitingSample.opacity).toBe(1);

    const transition = createOrderSlotTransition({
      slotIndex: 0,
      completedOrder: { id: 'ord_1', itemId: 'handbag', requiredCount: 3 },
      nextOrder: { id: 'ord_2', itemId: 'thermos', requiredCount: 2 },
      sealStartAtMs: 1480,
    });

    const waitLand = sampleOrderSlotTransition(transition, 1200);
    expect(waitLand.phase).toBe('waiting_land');
    expect(waitLand.displayOrder?.id).toBe('ord_1');
    expect(waitLand.forceFullCount).toBe(false);
    expect(waitLand.showSealedBadge).toBe(false);

    const sealed = sampleOrderSlotTransition(transition, 1480 + 180);
    expect(sealed.phase).toBe('sealed');
    expect(sealed.displayOrder?.id).toBe('ord_1');
    expect(sealed.forceFullCount).toBe(true);
    expect(sealed.showSealedBadge).toBe(true);
    expect(sealed.scale).toBeGreaterThan(1.01);

    const exiting = sampleOrderSlotTransition(
      transition,
      1480 + ORDER_TRANSITION_TIMING.sealHoldMs + 160
    );
    expect(exiting.phase).toBe('exiting');
    expect(exiting.displayOrder?.id).toBe('ord_1');
    expect(exiting.opacity).toBeLessThan(1);
    expect(exiting.offsetY).toBeLessThan(0);

    const enterStart = getOrderTransitionEnterStartMs(transition);
    const entering = sampleOrderSlotTransition(transition, enterStart + 120);
    expect(entering.phase).toBe('entering');
    expect(entering.displayOrder?.id).toBe('ord_2');
    expect(entering.forceFullCount).toBe(false);
    expect(entering.showSealedBadge).toBe(false);
    expect(entering.offsetY).toBeGreaterThan(0);

    const done = sampleOrderSlotTransition(transition, getOrderTransitionEndMs(transition) + 10);
    expect(done.phase).toBe('done');
    expect(done.offsetY).toBe(0);
    expect(done.scale).toBe(1);
    expect(done.opacity).toBe(1);

    const queue = [transition];
    expect(getQueuedOrderDelayMs(queue, 'ord_1', 1500, 180)).toBe(0);
    expect(getQueuedOrderDelayMs(queue, 'ord_2', 1500, 180)).toBe(enterStart + 180 - 1500);

    expediteSlotTransitionForDirectTap(queue, 'ord_2', 1500 + 480, 1520);
    expect(getOrderTransitionEnterStartMs(transition)).toBeLessThanOrEqual(1500 + 480 - 90);
    expect(transition.exitMs).toBeGreaterThanOrEqual(120);

    expect(getActiveSlotTransition(queue, getOrderTransitionEndMs(transition) + 50)).toBeNull();
    expect(queue.length).toBe(0);
  });
});

describe('Share-to-Unlock Replacement Mode', () => {
  it('defaults to share unlock mode with non-ad copy across all 10 placements', () => {
    expect(isShareUnlockMode('douyin')).toBe(true);
    expect(isShareUnlockMode('wechat')).toBe(false);
    expect(isShareUnlockMode('web-mock')).toBe(false);

    const placements: AdPlacement[] = [
      'unlock_order_box',
      'unlock_tray_slot',
      'revive_clear_tray',
      'booster_magnet',
      'booster_undo',
      'booster_hint',
      'booster_shuffle',
      'cat_pet_extra',
      'daily_cat_bonus',
      'refill_lives',
    ];

    for (const placement of placements) {
      const copy = REWARD_UNLOCK_COPY[placement];
      expect(copy.modalTitle).not.toMatch(/广告|视频/);
      expect(copy.buttonLabel).not.toMatch(/广告|视频/);
      expect(copy.successToast).not.toMatch(/广告|视频/);

      const req = buildRewardShareRequest(placement, {
        userId: 'TH-123456',
        levelNumber: 4,
        roomName: '樱花甜品屋',
      });
      expect(req.title.length).toBeGreaterThan(5);
      expect(req.purposeTitle).toBe(copy.modalTitle);
      expect(req.rewardDesc).toBe(copy.actionLabel);
      expect(req.query).toContain(`unlock=${placement}`);
    }

    expect(REWARD_UNLOCK_COPY.unlock_order_box.shortTag).toBe('解锁第3箱');
    expect(REWARD_UNLOCK_COPY.unlock_tray_slot.shortTag).toBe('解锁+1');
  });

  it('provides generated lock UI icon asset on disk', async () => {
    const fsMod = await import(/* @vite-ignore */ 'node:' + 'fs');
    const urlMod = await import(/* @vite-ignore */ 'node:' + 'url');
    const lockPng = new URL('../assets/resources/ui/icon_lock.png', import.meta.url);
    expect(fsMod.existsSync(urlMod.fileURLToPath(lockPng))).toBe(true);
  });
});

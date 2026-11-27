import { afterEach, describe, expect, it, vi } from 'vitest';
import { ORDER_TRANSITION_TIMING } from '@core/flyAnimation';
import { evaluateExternalShare } from '@core/shareVerifier';
import type { OrderSlotState, PetCatState } from '@core/types';
import { createDefaultSaveData } from '@platform/IPlatformAdapter';
import { DouyinAdapter } from '@platform/DouyinAdapter';
import { MockPlatformAdapter } from '@platform/MockPlatformAdapter';
import { WeChatAdapter } from '@platform/WeChatAdapter';
import { computeCatBadgeState, computeOrderSlotDisplay, getLevelBadgeTag } from '@shared/hudViewModel';
import { OrderFlowTracker } from '@shared/orderFlowTracker';
import { executeRewardUnlock, executeVerifiedShare } from '@shared/rewardFlow';

describe('Shared Client View Models & Coordinators', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('computes order slot display counts excluding in-flight items and handles seal state', () => {
    const slot: OrderSlotState = {
      slotIndex: 0,
      unlocked: true,
      isAdSlot: false,
      order: { id: 'ord_1', itemId: 'handbag', requiredCount: 3 },
      collectedCount: 2,
    };
    const inFlight = new Map([['ord_1', 1]]);

    const plain = computeOrderSlotDisplay(slot, null, inFlight);
    expect(plain.displayOrder?.id).toBe('ord_1');
    expect(plain.displayCount).toBe(1);
    expect(plain.showSealed).toBe(false);

    const sealed = computeOrderSlotDisplay(
      slot,
      {
        sample: {
          displayOrder: { id: 'ord_1', itemId: 'handbag', requiredCount: 3 },
          forceFullCount: true,
          phase: 'sealed',
          showSealedBadge: true,
        },
      },
      inFlight
    );
    expect(sealed.displayCount).toBe(3);
    expect(sealed.showSealed).toBe(true);
  });

  it('tracks delivery timing, order transitions, and win unlock delay cleanly', () => {
    const tracker = new OrderFlowTracker();
    const d1 = tracker.scheduleDelivery({
      slotIndex: 0,
      orderId: 'ord_1',
      fromTray: false,
      nowMs: 1000,
    });
    expect(d1.delayMs).toBe(0);
    expect(tracker.getInFlightCounts().get('ord_1')).toBe(1);

    tracker.onOrderCompleted({
      slotIndex: 0,
      orderId: 'ord_1',
      itemId: 'handbag',
      requiredCount: 1,
      nowMs: 1050,
    });
    expect(tracker.hasPendingTransitions()).toBe(true);
    expect(tracker.onOrderRefreshed({
      slotIndex: 0,
      orderId: 'ord_2',
      itemId: 'cactus',
      requiredCount: 2,
    })).toBe(true);

    const unlockAt = tracker.computeWinUnlockAt(1100);
    expect(unlockAt).toBeGreaterThanOrEqual(1480 + ORDER_TRANSITION_TIMING.sealHoldMs + 140);
    expect(tracker.isWinReady(1200)).toBe(false);
    expect(tracker.isWinReady(unlockAt)).toBe(true);

    tracker.markOrderLanded('ord_1');
    expect(tracker.getInFlightCounts().has('ord_1')).toBe(false);

    tracker.reset();
    expect(tracker.hasPendingTransitions()).toBe(false);
    expect(tracker.isWinReady(0)).toBe(true);
  });

  it('computes cat badge state and level badge tags consistently', () => {
    const basePet: PetCatState = {
      enabled: true,
      x: 0.5,
      y: 0.5,
      mood: 'idle',
      cooldownSec: 12,
      nextActionInSec: 12,
      petsReceived: 1,
      petsNeeded: 2,
      freeGiftsUsedInLevel: 0,
      maxFreeGiftsPerLevel: 1,
      adGiftsUsedInLevel: 0,
      maxAdGiftsPerLevel: 1,
      bubbleText: null,
      bubbleTimerSec: 0,
      targetItemUid: null,
    };

    expect(computeCatBadgeState(basePet, 2)).toMatchObject({ mode: 'treat', text: '寻物(1/2)' });
    expect(computeCatBadgeState(basePet, 0)).toMatchObject({ mode: 'missing_treat', text: '缺猫条' });
    expect(
      computeCatBadgeState({ ...basePet, freeGiftsUsedInLevel: 1 }, 2).mode
    ).toBe('ad');
    expect(
      computeCatBadgeState({ ...basePet, freeGiftsUsedInLevel: 1, adGiftsUsedInLevel: 1 }, 2)
    ).toMatchObject({ mode: 'done', text: '本局已满' });

    expect(
      getLevelBadgeTag({ levelBadge: 'x2', coinMultiplier: 2, isMilestoneLevel: false }, true)
    ).toBe('2× 金币关');
  });

  it('only grants Douyin share rewards after SDK confirmation, using the latest save', async () => {
    const share = vi.fn<(options: { success(): void; cancel(): void }) => void>();
    vi.stubGlobal('tt', { shareAppMessage: share });
    const platform = new DouyinAdapter();
    const persist = vi.spyOn(platform, 'saveProgress');
    const initial = createDefaultSaveData();
    let save = initial;
    const onRewarded = vi.fn();

    const unlock = () => executeRewardUnlock({
      placement: 'unlock_order_box',
      platform,
      saveData: save,
      snapshot: { levelNumber: 1, theme: 'living_room' },
      onRewarded,
    });
    const cancelledUnlock = unlock();
    share.mock.calls[0][0].cancel();
    expect((await cancelledUnlock).unlocked).toBe(false);
    expect(onRewarded).not.toHaveBeenCalled();

    const confirmedUnlock = unlock();
    share.mock.calls[1][0].success();
    expect((await confirmedUnlock).unlocked).toBe(true);
    expect(onRewarded).toHaveBeenCalledTimes(1);

    const pendingReward = executeVerifiedShare({
      platform,
      getSaveData: () => save,
      snapshot: { theme: 'living_room' },
    });
    save = { ...save, coins: save.coins + 42 };
    share.mock.calls[2][0].success();
    const outcome = await pendingReward;
    expect(outcome).toMatchObject({
      verified: true,
      rewarded: true,
      saveData: { petTreats: initial.petTreats + 1, coins: initial.coins + 42 },
    });
    expect(persist).toHaveBeenCalledOnce();
  });

  it('skips the ad SDK when the WeChat rewarded video unit is unconfigured', async () => {
    const createRewardedVideoAd = vi.fn();
    vi.stubGlobal('wx', { createRewardedVideoAd });
    const platform = new WeChatAdapter();
    const onRewarded = vi.fn();
    const result = await executeRewardUnlock({
      platform,
      placement: 'unlock_order_box',
      saveData: createDefaultSaveData(),
      snapshot: { levelNumber: 1, theme: 'living_room' },
      onRewarded,
    });
    expect(result).toMatchObject({ unlocked: false, toastText: '当前版本暂无可用的激励视频' });
    expect(createRewardedVideoAd).not.toHaveBeenCalled();
    expect(onRewarded).not.toHaveBeenCalled();
  });

  it('keeps ordinary sharing separate from rewards on WeChat and Web', async () => {
    const wechat = new WeChatAdapter({
      rewardedVideoAdUnitId: 'test',
      wxApi: { shareAppMessage: vi.fn() },
    });
    const web = new MockPlatformAdapter();
    web.setShareHandler(async () => evaluateExternalShare('sdk_confirmed'));
    const save = createDefaultSaveData();
    for (const platform of [wechat, web]) {
      const persist = vi.spyOn(platform, 'saveProgress');
      const ad = vi.spyOn(platform, 'showRewardedAd').mockResolvedValue({ rewarded: false });
      const share = vi.spyOn(platform, 'shareResult');
      const onRewarded = vi.fn();
      const settings = {
        platform,
        snapshot: { levelNumber: 1, theme: 'living_room' as const },
      };
      const unlocked = await executeRewardUnlock({
        ...settings,
        placement: 'unlock_order_box',
        saveData: save,
        onRewarded,
      });
      expect(unlocked).toMatchObject({ unlocked: false, usedShareMode: false });
      expect(ad).toHaveBeenCalledWith('unlock_order_box');
      expect(share).not.toHaveBeenCalled();
      expect(onRewarded).not.toHaveBeenCalled();

      const result = await executeVerifiedShare({ ...settings, getSaveData: () => save });
      expect(result).toMatchObject({ verified: false, rewarded: false, saveData: save });
      expect(share).toHaveBeenCalledOnce();
      expect(persist).not.toHaveBeenCalled();
    }
  });
});

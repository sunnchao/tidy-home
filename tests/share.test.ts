import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluateExternalShare } from '@core/shareVerifier';
import {
  canClaimShareReward,
  claimVerifiedShareReward,
  DAILY_SHARE_LIMIT,
  syncDailyReset,
} from '@core/userProfile';
import { createDefaultSaveData } from '@platform/IPlatformAdapter';
import { DouyinAdapter } from '@platform/DouyinAdapter';
import { MockPlatformAdapter } from '@platform/MockPlatformAdapter';
import { WeChatAdapter } from '@platform/WeChatAdapter';

describe('External Share Verification & Daily Rewards', () => {
  afterEach(() => {
    delete (globalThis as any).wx;
    delete (globalThis as any).tt;
    vi.useRealTimers();
  });

  it('only verifies an explicit SDK confirmation', () => {
    expect(evaluateExternalShare('unconfirmed').verified).toBe(false);
    expect(evaluateExternalShare('cancelled').verified).toBe(false);
    expect(evaluateExternalShare('failed').verified).toBe(false);
    expect(evaluateExternalShare('sdk_confirmed')).toMatchObject({ verified: true, shared: true });
  });

  it('enforces daily verified-share cap (3/day) and cross-day reset', () => {
    let save = createDefaultSaveData();
    const initialTreats = save.petTreats;
    save.dailyClaimDate = '2026-11-25';

    for (let i = 0; i < DAILY_SHARE_LIMIT; i++) {
      expect(canClaimShareReward(save, '2026-11-25')).toBe(true);
      const res = claimVerifiedShareReward(save, '2026-11-25');
      expect(res.ok).toBe(true);
      expect(res.granted).toBe(1);
      save = res.save;
    }

    expect(save.petTreats).toBe(initialTreats + DAILY_SHARE_LIMIT);
    expect(save.totalSharesVerified).toBe(DAILY_SHARE_LIMIT);
    expect(canClaimShareReward(save, '2026-11-25')).toBe(false);
    expect(claimVerifiedShareReward(save, '2026-11-25').ok).toBe(false);

    save = syncDailyReset(save, '2026-11-26');
    expect(save.dailyShareClaimed).toBe(0);
    expect(canClaimShareReward(save, '2026-11-26')).toBe(true);
  });

  it('opens WeChat sharing without awarding a background-and-return attempt', async () => {
    vi.useFakeTimers();
    const hideListeners: Array<() => void> = [];
    const showListeners: Array<() => void> = [];
    const shareAppMessage = vi.fn();
    (globalThis as any).wx = {
      showShareMenu: vi.fn(),
      onShareAppMessage: vi.fn(),
      onHide: (cb: () => void) => hideListeners.push(cb),
      onShow: (cb: () => void) => showListeners.push(cb),
      shareAppMessage,
    };

    const adapter = new WeChatAdapter();
    const result = adapter.shareResult({ title: 'test' });
    hideListeners.forEach((listener) => listener());
    await vi.advanceTimersByTimeAsync(3200);
    showListeners.forEach((listener) => listener());
    expect(shareAppMessage).toHaveBeenCalledOnce();
    expect(await result).toMatchObject({ verified: false, reason: 'unconfirmed' });
  });

  it('waits for Douyin confirmation and rejects cancellation, failure, and missing callbacks', async () => {
    vi.useFakeTimers();
    const hideListeners: Array<() => void> = [];
    const showListeners: Array<() => void> = [];
    const shareAppMessage = vi.fn<(options: { success(): void; fail(): void; cancel(): void }) => void>();
    (globalThis as any).tt = {
      shareAppMessage,
      onHide: (listener: () => void) => hideListeners.push(listener),
      onShow: (listener: () => void) => showListeners.push(listener),
    };
    const adapter = new DouyinAdapter();

    const pending = adapter.shareResult('test');
    const finished = vi.fn();
    void pending.then(finished);
    hideListeners.forEach((listener) => listener());
    await vi.advanceTimersByTimeAsync(5000);
    showListeners.forEach((listener) => listener());
    await Promise.resolve();
    expect(finished).not.toHaveBeenCalled();
    shareAppMessage.mock.calls[0][0].success();
    expect(await pending).toMatchObject({ verified: true, reason: 'sdk_confirmed' });

    const cancelled = adapter.shareResult('test');
    shareAppMessage.mock.calls[1][0].cancel();
    shareAppMessage.mock.calls[1][0].success();
    expect(await cancelled).toMatchObject({ verified: false, reason: 'cancelled' });

    const failed = adapter.shareResult('test');
    shareAppMessage.mock.calls[2][0].fail();
    expect(await failed).toMatchObject({ verified: false, reason: 'failed' });

    const timedOut = adapter.shareResult('test');
    await vi.runAllTimersAsync();
    shareAppMessage.mock.calls[3][0].success();
    expect(await timedOut).toMatchObject({ verified: false, reason: 'unconfirmed' });
    expect((await new MockPlatformAdapter().shareResult('test')).verified).toBe(false);
  });
});

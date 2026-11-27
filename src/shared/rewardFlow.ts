import { ROOM_CATALOG } from '@core/catalogs';
import { buildRewardShareRequest, isShareUnlockMode, REWARD_UNLOCK_COPY } from '@core/rewardUnlock';
import type { AdPlacement, SaveData, SessionSnapshot } from '@core/types';
import {
  canClaimShareReward,
  claimVerifiedShareReward,
  DAILY_SHARE_LIMIT,
  syncDailyReset,
} from '@core/userProfile';
import type { IPlatformAdapter } from '@platform/IPlatformAdapter';

export interface RewardUnlockOutcome {
  unlocked: boolean;
  usedShareMode: boolean;
  toastText?: string;
  toastColor?: string;
}

export async function executeRewardUnlock(params: {
  placement: AdPlacement;
  platform: IPlatformAdapter;
  saveData: SaveData;
  snapshot: Pick<SessionSnapshot, 'levelNumber' | 'theme'>;
  onRewarded: () => void;
}): Promise<RewardUnlockOutcome> {
  if (isShareUnlockMode(params.platform.platformName)) {
    const req = buildRewardShareRequest(params.placement, {
      userId: params.saveData.userId,
      levelNumber: params.snapshot.levelNumber,
      roomName: ROOM_CATALOG[params.snapshot.theme]?.name,
    });
    const res = await params.platform.shareResult(req);
    if (res.verified && res.shared && res.reason === 'sdk_confirmed') {
      params.onRewarded();
      return {
        unlocked: true,
        usedShareMode: true,
        toastText: REWARD_UNLOCK_COPY[params.placement].successToast,
        toastColor: '#FFD147',
      };
    }
    return {
      unlocked: false,
      usedShareMode: true,
      toastText: res.message,
      toastColor: '#FFE082',
    };
  }

  const res = await params.platform.showRewardedAd(params.placement);
  if (res.rewarded) {
    params.onRewarded();
    return { unlocked: true, usedShareMode: false };
  }
  return {
    unlocked: false,
    usedShareMode: false,
    toastText: res.reason === 'ad_unconfigured' ? '当前版本暂无可用的激励视频' : '本次未获得广告奖励',
    toastColor: '#FFE082',
  };
}

export interface VerifiedShareOutcome {
  verified: boolean;
  rewarded: boolean;
  saveData: SaveData;
  toastText: string;
  toastColor: string;
}

export async function executeVerifiedShare(params: {
  platform: IPlatformAdapter;
  getSaveData: () => SaveData;
  snapshot: Pick<SessionSnapshot, 'theme'>;
  shareTitle?: string;
}): Promise<VerifiedShareOutcome> {
  const { userId, currentLevel } = params.getSaveData();
  const canReward = isShareUnlockMode(params.platform.platformName);
  const room = ROOM_CATALOG[params.snapshot.theme];
  const title =
    params.shareTitle ??
    `我在《我来收纳》整理了第 ${currentLevel} 关「${room.name}」，快来一起挑战!`;

  const result = await params.platform.shareResult({
    title,
    query: canReward ? `from=${userId}&lv=${currentLevel}` : undefined,
  });
  const save = params.getSaveData();

  if (!canReward || !result.verified || !result.shared || result.reason !== 'sdk_confirmed' || save.userId !== userId) {
    return {
      verified: false,
      rewarded: false,
      saveData: save,
      toastText: !canReward && (result.reason === 'unconfirmed' || result.reason === 'cancelled') ? '' : result.message,
      toastColor: '#FFE082',
    };
  }

  const syncedSave = syncDailyReset(save);
  if (!canClaimShareReward(syncedSave)) {
    return {
      verified: true,
      rewarded: false,
      saveData: syncedSave,
      toastText: '外部分享成功！今日猫条奖励次数已满',
      toastColor: '#A6DFD1',
    };
  }

  const reward = claimVerifiedShareReward(syncedSave);
  if (reward.ok) {
    params.platform.saveProgress(reward.save);
    return {
      verified: true,
      rewarded: true,
      saveData: reward.save,
      toastText: `外部分享验证成功！猫条 +1 (今日余 ${reward.remainingToday}/${DAILY_SHARE_LIMIT})`,
      toastColor: '#FFD147',
    };
  }

  return {
    verified: true,
    rewarded: false,
    saveData: syncedSave,
    toastText: '外部分享成功！',
    toastColor: '#A6DFD1',
  };
}

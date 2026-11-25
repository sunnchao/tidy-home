import { getLocalDateKey } from '../core/userProfile';
import type { AdPlacement, SaveData } from '../core/types';

export interface RewardedAdResult {
  rewarded: boolean;
  reason?: string;
}

export interface IPlatformAdapter {
  readonly platformName: 'web-mock' | 'wechat' | 'douyin';
  loadSave(): SaveData;
  saveProgress(data: SaveData): void;
  clearSave(): void;
  showRewardedAd(placement: AdPlacement): Promise<RewardedAdResult>;
  showInterstitialAd(): Promise<void>;
  vibrateShort(style?: 'light' | 'medium' | 'heavy'): void;
  shareResult(title: string): void;
}

function generateUserId(): string {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `TH-${rand}`;
}

export function createDefaultSaveData(): SaveData {
  const today = getLocalDateKey();
  return {
    userId: generateUserId(),
    nickname: '收纳小管家',
    createdAt: today,
    currentLevel: 1,
    highestLevel: 1,
    totalStars: 0,
    totalLevelsCleared: 0,
    petTreats: 2,
    dailyClaimDate: today,
    dailyFreeClaimed: 0,
    dailyAdClaimed: 0,
    boosters: {
      magnet: 2,
      undo: 2,
      hint: 2,
      shuffle: 2,
    },
    muted: false,
    vibrationEnabled: true,
    bgmEnabled: true,
    levelStars: {},
  };
}

export const DEFAULT_SAVE_DATA: SaveData = createDefaultSaveData();

export function normalizeSaveData(raw: Partial<SaveData> | null | undefined): SaveData {
  const base = createDefaultSaveData();
  if (!raw || typeof raw !== 'object') {
    return base;
  }
  const today = getLocalDateKey();
  const sameDay = raw.dailyClaimDate === today;

  const cleanStars: Record<number, number> = {};
  if (raw.levelStars && typeof raw.levelStars === 'object') {
    for (const [k, v] of Object.entries(raw.levelStars)) {
      const lv = Number(k);
      const st = Number(v);
      if (Number.isInteger(lv) && lv >= 1 && Number.isFinite(st) && st >= 1) {
        cleanStars[lv] = Math.min(3, Math.floor(st));
      }
    }
  }

  return {
    userId: typeof raw.userId === 'string' && raw.userId.length > 0 ? raw.userId : base.userId,
    nickname: typeof raw.nickname === 'string' && raw.nickname.length > 0 ? raw.nickname : base.nickname,
    createdAt: typeof raw.createdAt === 'string' && raw.createdAt.length > 0 ? raw.createdAt : today,
    currentLevel: typeof raw.currentLevel === 'number' && raw.currentLevel >= 1 ? Math.floor(raw.currentLevel) : 1,
    highestLevel: typeof raw.highestLevel === 'number' && raw.highestLevel >= 1 ? Math.floor(raw.highestLevel) : 1,
    totalStars: typeof raw.totalStars === 'number' && raw.totalStars >= 0 ? Math.floor(raw.totalStars) : 0,
    totalLevelsCleared:
      typeof raw.totalLevelsCleared === 'number' && raw.totalLevelsCleared >= 0
        ? Math.floor(raw.totalLevelsCleared)
        : 0,
    petTreats:
      typeof raw.petTreats === 'number' && raw.petTreats >= 0 ? Math.floor(raw.petTreats) : base.petTreats,
    dailyClaimDate: today,
    dailyFreeClaimed:
      sameDay && typeof raw.dailyFreeClaimed === 'number' ? Math.max(0, Math.floor(raw.dailyFreeClaimed)) : 0,
    dailyAdClaimed:
      sameDay && typeof raw.dailyAdClaimed === 'number' ? Math.max(0, Math.floor(raw.dailyAdClaimed)) : 0,
    boosters: {
      magnet: typeof raw.boosters?.magnet === 'number' ? Math.max(0, Math.floor(raw.boosters.magnet)) : 2,
      undo: typeof raw.boosters?.undo === 'number' ? Math.max(0, Math.floor(raw.boosters.undo)) : 2,
      hint: typeof raw.boosters?.hint === 'number' ? Math.max(0, Math.floor(raw.boosters.hint)) : 2,
      shuffle: typeof raw.boosters?.shuffle === 'number' ? Math.max(0, Math.floor(raw.boosters.shuffle)) : 2,
    },
    muted: Boolean(raw.muted),
    vibrationEnabled: typeof raw.vibrationEnabled === 'boolean' ? raw.vibrationEnabled : true,
    bgmEnabled: typeof raw.bgmEnabled === 'boolean' ? raw.bgmEnabled : true,
    levelStars: cleanStars,
  };
}

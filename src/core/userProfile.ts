import type { BoosterType, SaveData } from './types';

export const DAILY_FREE_LIMIT = 2;
export const DAILY_AD_LIMIT = 1;
export const CLEARS_PER_PET_REWARD = 2;

export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function syncDailyReset(save: SaveData, todayKey: string = getLocalDateKey()): SaveData {
  if (save.dailyClaimDate === todayKey) {
    return { ...save, boosters: { ...save.boosters } };
  }
  return {
    ...save,
    boosters: { ...save.boosters },
    dailyClaimDate: todayKey,
    dailyFreeClaimed: 0,
    dailyAdClaimed: 0,
  };
}

export function canClaimDailyFree(save: SaveData, todayKey: string = getLocalDateKey()): boolean {
  const synced = syncDailyReset(save, todayKey);
  return synced.dailyFreeClaimed < DAILY_FREE_LIMIT;
}

export function canClaimDailyAdBonus(save: SaveData, todayKey: string = getLocalDateKey()): boolean {
  const synced = syncDailyReset(save, todayKey);
  return synced.dailyAdClaimed < DAILY_AD_LIMIT;
}

export function claimDailyFree(
  save: SaveData,
  todayKey: string = getLocalDateKey()
): { ok: boolean; granted: number; save: SaveData } {
  const synced = syncDailyReset(save, todayKey);
  if (synced.dailyFreeClaimed >= DAILY_FREE_LIMIT) {
    return { ok: false, granted: 0, save: synced };
  }
  return {
    ok: true,
    granted: 1,
    save: {
      ...synced,
      dailyFreeClaimed: synced.dailyFreeClaimed + 1,
      petTreats: synced.petTreats + 1,
    },
  };
}

export function claimDailyAdBonus(
  save: SaveData,
  todayKey: string = getLocalDateKey()
): { ok: boolean; granted: number; save: SaveData } {
  const synced = syncDailyReset(save, todayKey);
  if (synced.dailyAdClaimed >= DAILY_AD_LIMIT) {
    return { ok: false, granted: 0, save: synced };
  }
  return {
    ok: true,
    granted: 1,
    save: {
      ...synced,
      dailyAdClaimed: synced.dailyAdClaimed + 1,
      petTreats: synced.petTreats + 1,
    },
  };
}

export function updateNickname(save: SaveData, rawName: string): SaveData {
  const trimmed = rawName.trim().slice(0, 12);
  return {
    ...save,
    boosters: { ...save.boosters },
    levelStars: { ...save.levelStars },
    nickname: trimmed.length > 0 ? trimmed : save.nickname,
  };
}

export function getClearsUntilNextPetReward(save: SaveData): number {
  const mod = save.totalLevelsCleared % CLEARS_PER_PET_REWARD;
  return mod === 0 ? CLEARS_PER_PET_REWARD : CLEARS_PER_PET_REWARD - mod;
}

export function recordLevelVictory(
  save: SaveData,
  levelNumber: number,
  starsEarned: number,
  boosters: Record<BoosterType, number>
): {
  save: SaveData;
  milestonePetTreatsGranted: number;
  clearsUntilNextReward: number;
  starDelta: number;
} {
  const synced = syncDailyReset(save);
  const nextClears = synced.totalLevelsCleared + 1;
  const milestoneGranted = nextClears % CLEARS_PER_PET_REWARD === 0 ? 1 : 0;

  const prevBest = synced.levelStars[levelNumber] ?? 0;
  const newBest = Math.min(3, Math.max(prevBest, Math.max(1, Math.floor(starsEarned))));
  const starDelta = Math.max(0, newBest - prevBest);

  const nextCurrent = Math.max(synced.currentLevel, levelNumber + 1);
  const updated: SaveData = {
    ...synced,
    currentLevel: nextCurrent,
    highestLevel: Math.max(synced.highestLevel, nextCurrent),
    totalStars: synced.totalStars + starDelta,
    totalLevelsCleared: nextClears,
    petTreats: synced.petTreats + milestoneGranted,
    boosters: { ...boosters },
    levelStars: {
      ...synced.levelStars,
      [levelNumber]: newBest,
    },
  };

  return {
    save: updated,
    milestonePetTreatsGranted: milestoneGranted,
    clearsUntilNextReward: getClearsUntilNextPetReward(updated),
    starDelta,
  };
}

import type { BoosterType, RoomThemeId, SaveData } from './types';

export const DAILY_FREE_LIMIT = 2;
export const DAILY_AD_LIMIT = 1;
export const DAILY_SHARE_LIMIT = 3;
export const CLEARS_PER_PET_REWARD = 2;

export const MAX_LIVES = 5;
export const LIFE_REGEN_MS = 10 * 60 * 1000;

export const INITIAL_COINS = 100;
export const CAT_TREAT_PRICE = 50;
export const CAT_TREAT_PACK3_PRICE = 130;
export const LIFE_COIN_PRICE = 60;
export const ORDER_COMPLETE_COINS = 5;
export const GOLDEN_ITEM_COINS = 10;
export const DAILY_FREE_COINS = 20;

const ROOM_UNLOCK_LEVELS: ReadonlyArray<{ level: number; id: RoomThemeId }> = [
  { level: 1, id: 'living_room' },
  { level: 2, id: 'bathroom' },
  { level: 3, id: 'study' },
  { level: 4, id: 'cafe' },
  { level: 5, id: 'kitchen' },
  { level: 6, id: 'bedroom' },
];

export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function syncDailyReset(save: SaveData, todayKey: string = getLocalDateKey()): SaveData {
  if (save.dailyClaimDate === todayKey) {
    return {
      ...save,
      boosters: { ...save.boosters },
      levelStars: { ...save.levelStars },
    };
  }
  return {
    ...save,
    boosters: { ...save.boosters },
    levelStars: { ...save.levelStars },
    dailyClaimDate: todayKey,
    dailyFreeClaimed: 0,
    dailyAdClaimed: 0,
    dailyShareClaimed: 0,
  };
}

/**
 * Synchronizes the 5-chance health bar using elapsed 10-minute intervals.
 */
export function syncLives(
  save: SaveData,
  nowMs: number = Date.now()
): { save: SaveData; gained: number; nextRegenInSec: number } {
  const safeNow = Math.max(0, Math.floor(nowMs));
  const curLives = Math.max(0, Math.min(MAX_LIVES, Math.floor(save.lives ?? MAX_LIVES)));
  if (curLives >= MAX_LIVES) {
    return {
      save: {
        ...save,
        lives: MAX_LIVES,
        lastLifeRegenAtMs: 0,
      },
      gained: 0,
      nextRegenInSec: 0,
    };
  }

  const anchorMs =
    typeof save.lastLifeRegenAtMs === 'number' && save.lastLifeRegenAtMs > 0
      ? save.lastLifeRegenAtMs
      : safeNow;

  const elapsed = Math.max(0, safeNow - anchorMs);
  const rawGained = Math.floor(elapsed / LIFE_REGEN_MS);
  const gained = Math.min(MAX_LIVES - curLives, rawGained);
  const nextLives = curLives + gained;

  if (nextLives >= MAX_LIVES) {
    return {
      save: {
        ...save,
        lives: MAX_LIVES,
        lastLifeRegenAtMs: 0,
      },
      gained,
      nextRegenInSec: 0,
    };
  }

  const nextAnchor = anchorMs + gained * LIFE_REGEN_MS;
  const remainingMs = Math.max(0, LIFE_REGEN_MS - (safeNow - nextAnchor));
  return {
    save: {
      ...save,
      lives: nextLives,
      lastLifeRegenAtMs: nextAnchor,
    },
    gained,
    nextRegenInSec: Math.ceil(remainingMs / 1000),
  };
}

export function consumeLife(
  save: SaveData,
  nowMs: number = Date.now()
): { ok: boolean; save: SaveData; nextRegenInSec: number } {
  const synced = syncLives(save, nowMs);
  if (synced.save.lives <= 0) {
    return { ok: false, save: synced.save, nextRegenInSec: synced.nextRegenInSec };
  }

  const wasFull = synced.save.lives >= MAX_LIVES;
  const nextLives = synced.save.lives - 1;
  const nextRegenAt = wasFull ? Math.floor(nowMs) : synced.save.lastLifeRegenAtMs || Math.floor(nowMs);
  const after = syncLives(
    {
      ...synced.save,
      lives: nextLives,
      lastLifeRegenAtMs: nextRegenAt,
    },
    nowMs
  );
  return {
    ok: true,
    save: after.save,
    nextRegenInSec: after.nextRegenInSec,
  };
}

export function grantLife(
  save: SaveData,
  amount = 1,
  nowMs: number = Date.now()
): { save: SaveData; granted: number } {
  const synced = syncLives(save, nowMs);
  const add = Math.max(0, Math.floor(amount));
  const before = synced.save.lives;
  const nextLives = Math.min(MAX_LIVES, before + add);
  const granted = nextLives - before;

  const updated = syncLives(
    {
      ...synced.save,
      lives: nextLives,
      lastLifeRegenAtMs: nextLives >= MAX_LIVES ? 0 : synced.save.lastLifeRegenAtMs,
    },
    nowMs
  );
  return { save: updated.save, granted };
}

export function formatCountdownMmSs(sec: number): string {
  const clamped = Math.max(0, Math.ceil(sec));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function addCoins(save: SaveData, amount: number): SaveData {
  const delta = Math.max(0, Math.floor(amount));
  return {
    ...save,
    boosters: { ...save.boosters },
    levelStars: { ...save.levelStars },
    coins: Math.max(0, (save.coins ?? 0) + delta),
  };
}

export function buyCatTreats(
  save: SaveData,
  pack: 'single' | 'pack3'
): { ok: boolean; reason?: 'insufficient_coins'; spent: number; gained: number; save: SaveData } {
  const price = pack === 'pack3' ? CAT_TREAT_PACK3_PRICE : CAT_TREAT_PRICE;
  const treats = pack === 'pack3' ? 3 : 1;
  const currentCoins = Math.max(0, Math.floor(save.coins ?? 0));
  if (currentCoins < price) {
    return { ok: false, reason: 'insufficient_coins', spent: 0, gained: 0, save };
  }
  return {
    ok: true,
    spent: price,
    gained: treats,
    save: {
      ...save,
      boosters: { ...save.boosters },
      levelStars: { ...save.levelStars },
      coins: currentCoins - price,
      petTreats: save.petTreats + treats,
    },
  };
}

export function buyLifeWithCoins(
  save: SaveData,
  nowMs: number = Date.now()
): { ok: boolean; reason?: 'insufficient_coins' | 'lives_full'; spent: number; save: SaveData } {
  const synced = syncLives(save, nowMs).save;
  if (synced.lives >= MAX_LIVES) {
    return { ok: false, reason: 'lives_full', spent: 0, save: synced };
  }
  const currentCoins = Math.max(0, Math.floor(synced.coins ?? 0));
  if (currentCoins < LIFE_COIN_PRICE) {
    return { ok: false, reason: 'insufficient_coins', spent: 0, save: synced };
  }
  const granted = grantLife(
    {
      ...synced,
      coins: currentCoins - LIFE_COIN_PRICE,
    },
    1,
    nowMs
  );
  return {
    ok: true,
    spent: LIFE_COIN_PRICE,
    save: granted.save,
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

export function canClaimShareReward(save: SaveData, todayKey: string = getLocalDateKey()): boolean {
  const synced = syncDailyReset(save, todayKey);
  return synced.dailyShareClaimed < DAILY_SHARE_LIMIT;
}

export function claimDailyFree(
  save: SaveData,
  todayKey: string = getLocalDateKey()
): { ok: boolean; granted: number; grantedCoins: number; save: SaveData } {
  const synced = syncDailyReset(save, todayKey);
  if (synced.dailyFreeClaimed >= DAILY_FREE_LIMIT) {
    return { ok: false, granted: 0, grantedCoins: 0, save: synced };
  }
  return {
    ok: true,
    granted: 1,
    grantedCoins: DAILY_FREE_COINS,
    save: {
      ...synced,
      dailyFreeClaimed: synced.dailyFreeClaimed + 1,
      petTreats: synced.petTreats + 1,
      coins: (synced.coins ?? 0) + DAILY_FREE_COINS,
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

export function claimVerifiedShareReward(
  save: SaveData,
  todayKey: string = getLocalDateKey()
): { ok: boolean; granted: number; remainingToday: number; save: SaveData } {
  const synced = syncDailyReset(save, todayKey);
  if (synced.dailyShareClaimed >= DAILY_SHARE_LIMIT) {
    return { ok: false, granted: 0, remainingToday: 0, save: synced };
  }
  const nextClaimed = synced.dailyShareClaimed + 1;
  return {
    ok: true,
    granted: 1,
    remainingToday: Math.max(0, DAILY_SHARE_LIMIT - nextClaimed),
    save: {
      ...synced,
      dailyShareClaimed: nextClaimed,
      totalSharesVerified: (synced.totalSharesVerified ?? 0) + 1,
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

export function resetWinStreak(save: SaveData): SaveData {
  return {
    ...save,
    boosters: { ...save.boosters },
    levelStars: { ...save.levelStars },
    winStreak: 0,
  };
}

export function getClearsUntilNextPetReward(save: SaveData): number {
  const mod = save.totalLevelsCleared % CLEARS_PER_PET_REWARD;
  return mod === 0 ? CLEARS_PER_PET_REWARD : CLEARS_PER_PET_REWARD - mod;
}

export function getButlerRank(totalLevelsCleared: number): { title: string; nextAt: number | null } {
  if (totalLevelsCleared >= 30) return { title: '整理之神', nextAt: null };
  if (totalLevelsCleared >= 15) return { title: '极简收纳大师', nextAt: 30 };
  if (totalLevelsCleared >= 8) return { title: '暖居魔法师', nextAt: 15 };
  if (totalLevelsCleared >= 3) return { title: '清爽小能手', nextAt: 8 };
  return { title: '见习整理员', nextAt: 3 };
}

export function getNextUnlockTeaser(currentLevel: number, highestLevel: number): string {
  const effectiveMax = Math.max(currentLevel, highestLevel);
  if (effectiveMax < 2) return '通关第 1 关解锁「泡沫浴室 · 海洋蓝」新主题!';
  if (effectiveMax < 3) return '通关第 2 关解锁「森林画室 · 翡翠手账室」新主题!';
  if (effectiveMax < 4) return '通关第 3 关解锁「樱花甜品屋 · 浪漫粉」+ 双倍金币关!';
  if (effectiveMax < 5) return '通关第 4 关解锁「温馨厨房」+ 第 5 关里程碑大奖!';
  if (effectiveMax < 6) return '通关第 5 关解锁「梦幻卧室 · 星夜紫」全主题巡礼!';
  const nextMilestone = Math.ceil(effectiveMax / 5) * 5;
  const gap = nextMilestone - effectiveMax;
  if (gap === 0) return `第 ${nextMilestone} 关是里程碑挑战关：首通必送 +1 猫条 & +60 金币!`;
  return `再闯 ${gap} 关迎战第 ${nextMilestone} 关里程碑（送 +1 猫条 & +60 金币）`;
}

export function recordLevelVictory(
  save: SaveData,
  levelNumber: number,
  starsEarned: number,
  boosters: Record<BoosterType, number>,
  opts: { nowMs?: number } = {}
): {
  save: SaveData;
  milestonePetTreatsGranted: number;
  clearsUntilNextReward: number;
  starDelta: number;
  lifeGranted: number;
  clearCoinsAwarded: number;
  streakBonusCoins: number;
  unlockedRoomId: RoomThemeId | null;
} {
  const nowMs = opts.nowMs ?? Date.now();
  const dailySynced = syncDailyReset(save);
  const lifeSynced = syncLives(dailySynced, nowMs).save;
  const lifeReward = grantLife(lifeSynced, 1, nowMs);

  const clampedStars = Math.min(3, Math.max(1, Math.floor(starsEarned)));
  const prevBest = lifeReward.save.levelStars[levelNumber] ?? 0;
  const newBest = Math.max(prevBest, clampedStars);
  const starDelta = Math.max(0, newBest - prevBest);
  const isFirstClear = prevBest === 0 && levelNumber >= lifeReward.save.highestLevel;

  const nextClears = lifeReward.save.totalLevelsCleared + 1;
  const everyTwoTreats = nextClears % CLEARS_PER_PET_REWARD === 0 ? 1 : 0;
  const milestoneLevelTreat = isFirstClear && levelNumber % 5 === 0 ? 1 : 0;
  const milestoneGranted = everyTwoTreats + milestoneLevelTreat;

  const nextStreak = (lifeReward.save.winStreak ?? 0) + 1;
  const streakBonusCoins = isFirstClear ? Math.min(50, nextStreak * 10) : 0;
  const milestoneCoins = isFirstClear && levelNumber % 5 === 0 ? 60 : 0;
  const clearCoinsAwarded = isFirstClear
    ? 30 + clampedStars * 15 + streakBonusCoins + milestoneCoins
    : 20 + starDelta * 10;

  const nextCurrent = Math.max(lifeReward.save.currentLevel, levelNumber + 1);
  const nextHighest = Math.max(lifeReward.save.highestLevel, nextCurrent);
  const unlockedEntry =
    nextHighest > lifeReward.save.highestLevel
      ? ROOM_UNLOCK_LEVELS.find((r) => r.level === nextHighest)
      : undefined;

  const updated: SaveData = {
    ...lifeReward.save,
    currentLevel: nextCurrent,
    highestLevel: nextHighest,
    totalStars: lifeReward.save.totalStars + starDelta,
    totalLevelsCleared: nextClears,
    petTreats: lifeReward.save.petTreats + milestoneGranted,
    coins: (lifeReward.save.coins ?? 0) + clearCoinsAwarded,
    winStreak: nextStreak,
    bestWinStreak: Math.max(lifeReward.save.bestWinStreak ?? 0, nextStreak),
    boosters: { ...boosters },
    levelStars: {
      ...lifeReward.save.levelStars,
      [levelNumber]: newBest,
    },
  };

  return {
    save: updated,
    milestonePetTreatsGranted: milestoneGranted,
    clearsUntilNextReward: getClearsUntilNextPetReward(updated),
    starDelta,
    lifeGranted: lifeReward.granted,
    clearCoinsAwarded,
    streakBonusCoins,
    unlockedRoomId: unlockedEntry ? unlockedEntry.id : null,
  };
}

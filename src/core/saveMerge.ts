import type { BoosterType, SaveData } from './types';
import { getLocalDateKey, MAX_LIVES } from './userProfile';

function sumLevelStars(levelStars: Record<number, number>): number {
  let total = 0;
  for (const val of Object.values(levelStars)) {
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
      total += Math.min(3, Math.floor(val));
    }
  }
  return total;
}

function isFreshDefaultSave(save: SaveData): boolean {
  return (
    save.totalLevelsCleared === 0 &&
    save.highestLevel <= 1 &&
    save.currentLevel <= 1 &&
    save.totalStars === 0 &&
    Object.keys(save.levelStars).length === 0
  );
}

function pickNewer<T>(
  localVal: T,
  remoteVal: T,
  localTs: number,
  remoteTs: number,
  preferRemoteOnTie: boolean
): T {
  if (remoteTs > localTs) return remoteVal;
  if (localTs > remoteTs) return localVal;
  return preferRemoteOnTie ? remoteVal : localVal;
}

/**
 * Merges a local SaveData snapshot with a CloudBase remote SaveData snapshot
 * without ever regressing unlocked levels, cleared count, or per-level star records.
 */
export function mergeSaveData(local: SaveData, remote: SaveData): SaveData {
  const localFresh = isFreshDefaultSave(local);
  const remoteFresh = isFreshDefaultSave(remote);

  if (localFresh && !remoteFresh) {
    return {
      ...remote,
      boosters: { ...remote.boosters },
      levelStars: { ...remote.levelStars },
      updatedAtMs: Math.max(local.updatedAtMs ?? 0, remote.updatedAtMs ?? 0, Date.now()),
    };
  }
  if (remoteFresh && !localFresh) {
    return {
      ...local,
      boosters: { ...local.boosters },
      levelStars: { ...local.levelStars },
      updatedAtMs: Math.max(local.updatedAtMs ?? 0, remote.updatedAtMs ?? 0, Date.now()),
    };
  }

  const localTs = typeof local.updatedAtMs === 'number' && Number.isFinite(local.updatedAtMs) ? local.updatedAtMs : 0;
  const remoteTs =
    typeof remote.updatedAtMs === 'number' && Number.isFinite(remote.updatedAtMs) ? remote.updatedAtMs : 0;
  const remoteAheadInProgress =
    remote.highestLevel > local.highestLevel ||
    (remote.highestLevel === local.highestLevel && remote.totalLevelsCleared > local.totalLevelsCleared);

  // Union per-level star best scores so stars never disappear across devices.
  const mergedStars: Record<number, number> = {};
  const allLevelKeys = new Set<string>([
    ...Object.keys(local.levelStars),
    ...Object.keys(remote.levelStars),
  ]);
  for (const key of allLevelKeys) {
    const lv = Number(key);
    if (!Number.isInteger(lv) || lv < 1) continue;
    const lvLocal = local.levelStars[lv] ?? 0;
    const lvRemote = remote.levelStars[lv] ?? 0;
    const best = Math.min(3, Math.max(lvLocal, lvRemote));
    if (best > 0) {
      mergedStars[lv] = best;
    }
  }

  const highestLevel = Math.max(local.highestLevel, remote.highestLevel);
  const totalLevelsCleared = Math.max(local.totalLevelsCleared, remote.totalLevelsCleared);
  const computedStars = sumLevelStars(mergedStars);
  const totalStars = Math.max(computedStars, local.totalStars, remote.totalStars);

  const rawCurrentLevel = pickNewer(
    local.currentLevel,
    remote.currentLevel,
    localTs,
    remoteTs,
    remoteAheadInProgress
  );
  const currentLevel = Math.min(highestLevel, Math.max(1, rawCurrentLevel));

  // Merge daily claim counters safely for the latest date key (never allow double-claim across devices).
  const today = getLocalDateKey();
  const dailyDate =
    local.dailyClaimDate === remote.dailyClaimDate
      ? local.dailyClaimDate
      : local.dailyClaimDate > remote.dailyClaimDate
        ? local.dailyClaimDate
        : remote.dailyClaimDate;
  const localMatchesDaily = local.dailyClaimDate === dailyDate;
  const remoteMatchesDaily = remote.dailyClaimDate === dailyDate;

  const dailyFreeClaimed = Math.max(
    localMatchesDaily ? local.dailyFreeClaimed : 0,
    remoteMatchesDaily ? remote.dailyFreeClaimed : 0
  );
  const dailyAdClaimed = Math.max(
    localMatchesDaily ? local.dailyAdClaimed : 0,
    remoteMatchesDaily ? remote.dailyAdClaimed : 0
  );
  const dailyShareClaimed = Math.max(
    localMatchesDaily ? local.dailyShareClaimed : 0,
    remoteMatchesDaily ? remote.dailyShareClaimed : 0
  );

  const boosterKeys: BoosterType[] = ['magnet', 'undo', 'hint', 'shuffle'];
  const mergedBoosters: Record<BoosterType, number> = {
    magnet: 0,
    undo: 0,
    hint: 0,
    shuffle: 0,
  };
  for (const key of boosterKeys) {
    mergedBoosters[key] = pickNewer(
      local.boosters[key],
      remote.boosters[key],
      localTs,
      remoteTs,
      remoteAheadInProgress
    );
  }

  const pickedLives = Math.max(
    0,
    Math.min(
      MAX_LIVES,
      pickNewer(local.lives, remote.lives, localTs, remoteTs, remoteAheadInProgress)
    )
  );
  const pickedRegenAt =
    pickedLives >= MAX_LIVES
      ? 0
      : pickNewer(
          local.lastLifeRegenAtMs,
          remote.lastLifeRegenAtMs,
          localTs,
          remoteTs,
          remoteAheadInProgress
        );

  const createdAt =
    local.createdAt && remote.createdAt
      ? local.createdAt <= remote.createdAt
        ? local.createdAt
        : remote.createdAt
      : local.createdAt || remote.createdAt || today;

  return {
    userId: remote.userId || local.userId,
    nickname: pickNewer(local.nickname, remote.nickname, localTs, remoteTs, remoteAheadInProgress),
    createdAt,
    currentLevel,
    highestLevel,
    totalStars,
    totalLevelsCleared,
    petTreats: pickNewer(local.petTreats, remote.petTreats, localTs, remoteTs, remoteAheadInProgress),
    lives: pickedLives,
    lastLifeRegenAtMs: pickedRegenAt,
    coins: pickNewer(local.coins, remote.coins, localTs, remoteTs, remoteAheadInProgress),
    winStreak: pickNewer(local.winStreak, remote.winStreak, localTs, remoteTs, remoteAheadInProgress),
    bestWinStreak: Math.max(local.bestWinStreak, remote.bestWinStreak),
    dailyClaimDate: dailyDate || today,
    dailyFreeClaimed,
    dailyAdClaimed,
    dailyShareClaimed,
    totalSharesVerified: Math.max(local.totalSharesVerified, remote.totalSharesVerified),
    boosters: mergedBoosters,
    muted: pickNewer(local.muted, remote.muted, localTs, remoteTs, false),
    vibrationEnabled: pickNewer(local.vibrationEnabled, remote.vibrationEnabled, localTs, remoteTs, false),
    bgmEnabled: pickNewer(local.bgmEnabled, remote.bgmEnabled, localTs, remoteTs, false),
    levelStars: mergedStars,
    updatedAtMs: Math.max(localTs, remoteTs),
  };
}

/**
 * Compares two SaveData values for gameplay-relevant equivalence (ignoring updatedAtMs jitter).
 */
export function isSaveDataEquivalent(a: SaveData, b: SaveData): boolean {
  if (
    a.userId !== b.userId ||
    a.nickname !== b.nickname ||
    a.createdAt !== b.createdAt ||
    a.currentLevel !== b.currentLevel ||
    a.highestLevel !== b.highestLevel ||
    a.totalStars !== b.totalStars ||
    a.totalLevelsCleared !== b.totalLevelsCleared ||
    a.petTreats !== b.petTreats ||
    a.lives !== b.lives ||
    a.lastLifeRegenAtMs !== b.lastLifeRegenAtMs ||
    a.coins !== b.coins ||
    a.winStreak !== b.winStreak ||
    a.bestWinStreak !== b.bestWinStreak ||
    a.dailyClaimDate !== b.dailyClaimDate ||
    a.dailyFreeClaimed !== b.dailyFreeClaimed ||
    a.dailyAdClaimed !== b.dailyAdClaimed ||
    a.dailyShareClaimed !== b.dailyShareClaimed ||
    a.totalSharesVerified !== b.totalSharesVerified ||
    a.muted !== b.muted ||
    a.vibrationEnabled !== b.vibrationEnabled ||
    a.bgmEnabled !== b.bgmEnabled
  ) {
    return false;
  }

  const boosterKeys: BoosterType[] = ['magnet', 'undo', 'hint', 'shuffle'];
  for (const key of boosterKeys) {
    if (a.boosters[key] !== b.boosters[key]) return false;
  }

  const keysA = Object.keys(a.levelStars);
  const keysB = Object.keys(b.levelStars);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    const lv = Number(key);
    if (a.levelStars[lv] !== b.levelStars[lv]) return false;
  }
  return true;
}

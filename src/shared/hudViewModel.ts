import { ROOM_CATALOG, ROOM_ORDER } from '@core/catalogs';
import type { OrderSnapshotItem, OrderSlotTransition } from '@core/flyAnimation';
import { REWARD_UNLOCK_COPY } from '@core/rewardUnlock';
import type {
  BoardItemInstance,
  OrderSlotState,
  PetCatState,
  RoomDefinition,
  RoomThemeId,
  SaveData,
  SessionSnapshot,
} from '@core/types';
import type { OcclusionTier } from '@core/visualDepth';

export interface VictoryDisplayMeta {
  milestoneGranted: number;
  lifeGranted: number;
  clearCoinsAwarded: number;
  streakBonusCoins: number;
  unlockedRoomId: RoomThemeId | null;
}

export function createEmptyVictoryMeta(): VictoryDisplayMeta {
  return {
    milestoneGranted: 0,
    lifeGranted: 0,
    clearCoinsAwarded: 0,
    streakBonusCoins: 0,
    unlockedRoomId: null,
  };
}

export interface OrderSlotDisplayState {
  displayOrder: OrderSnapshotItem | null;
  displayCount: number;
  showSealed: boolean;
  isEntering: boolean;
}

/**
 * Computes consistent order card display counts and transition flags while flights
 * are still in the air or an order box is sealing/swapping.
 */
export function computeOrderSlotDisplay(
  slot: OrderSlotState,
  activeTransition: { sample: { displayOrder: OrderSnapshotItem | null; forceFullCount: boolean; phase: string; showSealedBadge: boolean } } | null,
  inFlightOrderCounts: ReadonlyMap<string, number>
): OrderSlotDisplayState {
  const sample = activeTransition?.sample ?? null;
  const displayOrder: OrderSnapshotItem | null = sample ? sample.displayOrder : slot.order;
  if (!displayOrder) {
    return {
      displayOrder: null,
      displayCount: 0,
      showSealed: false,
      isEntering: sample?.phase === 'entering',
    };
  }

  const inFlight = inFlightOrderCounts.get(displayOrder.id) ?? 0;
  const displayCount = sample
    ? sample.forceFullCount
      ? displayOrder.requiredCount
      : sample.phase === 'waiting_land'
        ? Math.max(0, displayOrder.requiredCount - inFlight)
        : slot.order?.id === displayOrder.id
          ? Math.max(0, slot.collectedCount - inFlight)
          : 0
    : Math.max(0, slot.collectedCount - inFlight);

  return {
    displayOrder,
    displayCount,
    showSealed: Boolean(sample?.showSealedBadge),
    isEntering: sample?.phase === 'entering',
  };
}

export interface CatBadgeState {
  mode: 'treat' | 'missing_treat' | 'ad' | 'done';
  text: string;
  shareUnlock: boolean;
}

export function computeCatBadgeState(
  pet: Pick<PetCatState, 'maxFreeGiftsPerLevel' | 'freeGiftsUsedInLevel' | 'maxAdGiftsPerLevel' | 'adGiftsUsedInLevel' | 'petsReceived' | 'petsNeeded'>,
  petTreats: number,
  shareUnlock = false
): CatBadgeState {
  const freeLeft = pet.maxFreeGiftsPerLevel - pet.freeGiftsUsedInLevel;
  const adLeft = pet.maxAdGiftsPerLevel - pet.adGiftsUsedInLevel;

  if (freeLeft > 0) {
    if (petTreats > 0) {
      return {
        mode: 'treat',
        text: `寻物(${pet.petsReceived}/${pet.petsNeeded})`,
        shareUnlock,
      };
    }
    return { mode: 'missing_treat', text: '缺猫条', shareUnlock };
  }

  if (adLeft > 0) {
    return {
      mode: 'ad',
      text: shareUnlock ? REWARD_UNLOCK_COPY.cat_pet_extra.shortTag : '广告续摸',
      shareUnlock,
    };
  }

  return { mode: 'done', text: '本局已满', shareUnlock };
}

export function getRoomForLevel(levelNumber: number): { theme: RoomThemeId; room: RoomDefinition } {
  const idx = (Math.max(1, Math.floor(levelNumber)) - 1) % ROOM_ORDER.length;
  const theme = ROOM_ORDER[idx];
  return { theme, room: ROOM_CATALOG[theme] };
}

export function getHomePlayCtaLabel(saveData: Pick<SaveData, 'totalLevelsCleared' | 'currentLevel'>): string {
  return saveData.totalLevelsCleared === 0 && saveData.currentLevel === 1
    ? '开始整理 · 第 1 关'
    : `继续整理 · 第 ${saveData.currentLevel} 关`;
}

export function getActiveOrderItemIds(snap: Pick<SessionSnapshot, 'orderSlots'>): Set<string> {
  return new Set(
    snap.orderSlots.filter((s) => s.unlocked && s.order).map((s) => s.order!.itemId)
  );
}

export function isBoardItemHinted(
  item: Pick<BoardItemInstance, 'uid' | 'itemId'>,
  occlusionTier: OcclusionTier,
  snap: Pick<SessionSnapshot, 'highlightedItemUid' | 'levelNumber' | 'progressDone'>,
  activeOrderItemIds: ReadonlySet<string>
): boolean {
  return (
    snap.highlightedItemUid === item.uid ||
    (snap.levelNumber === 1 &&
      occlusionTier === 0 &&
      activeOrderItemIds.has(item.itemId) &&
      snap.progressDone === 0)
  );
}

export function getLevelBadgeTag(
  snap: Pick<SessionSnapshot, 'levelBadge' | 'coinMultiplier' | 'isMilestoneLevel'>,
  verbose = false
): string | null {
  if (!snap.levelBadge) return null;
  if (snap.coinMultiplier > 1) return verbose ? '2× 金币关' : '2×金币';
  if (snap.isMilestoneLevel) return verbose ? '里程碑关' : '里程碑';
  return verbose ? '挑战关' : '挑战';
}

export type ActiveSlotTransitionSample = {
  transition: OrderSlotTransition;
  sample: ReturnType<typeof import('@core/flyAnimation').sampleOrderSlotTransition>;
};

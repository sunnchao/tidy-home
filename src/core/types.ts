export type RoomThemeId = 'living_room' | 'bedroom' | 'kitchen';

export type TimeOfDay = 'morning' | 'sunset' | 'night';

export type LevelModifierId = 'none' | 'blackout_flashlight';

export type BoosterType = 'magnet' | 'undo' | 'hint' | 'shuffle';

export type AdPlacement =
  | 'unlock_order_box'
  | 'unlock_tray_slot'
  | 'revive_clear_tray'
  | 'booster_magnet'
  | 'booster_undo'
  | 'booster_hint'
  | 'booster_shuffle'
  | 'cat_pet_extra'
  | 'daily_cat_bonus';

export interface RoomAnchor {
  id: string;
  /** Normalized board coordinate [0..1] left-to-right */
  x: number;
  /** Normalized board coordinate [0..1] top-to-bottom */
  y: number;
  /** Surface category used for visual perspective & grouping */
  zone: string;
  /** Perspective scale multiplier */
  scale: number;
  /** Max items allowed stacked directly on this anchor */
  capacity: number;
}

export interface HostDialogue {
  role: string;
  openings: string[];
  victories: string[];
}

export interface RoomDefinition {
  id: RoomThemeId;
  name: string;
  bgResource: string;
  bgWebUrl: string;
  paletteTint: Record<TimeOfDay, { overlayColor: string; overlayOpacity: number; label: string }>;
  host: HostDialogue;
  anchors: RoomAnchor[];
}

export interface ItemDefinition {
  id: string;
  name: string;
  category: 'living' | 'bedroom' | 'kitchen' | 'general';
  /** Normalized collision radius on 720px reference width */
  radius: number;
  /** Accent hex color for particles & badges */
  color: string;
  spriteResource: string;
  spriteWebUrl: string;
}

export interface OrderSpec {
  id: string;
  itemId: string;
  requiredCount: number;
}

export interface OrderSlotState {
  slotIndex: number;
  unlocked: boolean;
  isAdSlot: boolean;
  order: OrderSpec | null;
  collectedCount: number;
}

export interface TrayItem {
  uid: string;
  itemId: string;
  fromAnchorId: string;
  fromLayer: number;
  fromX: number;
  fromY: number;
  fromRotation: number;
  fromScale: number;
}

export interface BoardItemInstance {
  uid: string;
  itemId: string;
  anchorId: string;
  layer: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  radius: number;
  state: 'on_board' | 'hidden_in_box' | 'in_tray' | 'delivered';
  hiddenByBoxId: string | null;
  blockedBy: string[];
}

export interface CardboardBoxInstance {
  uid: string;
  anchorId: string;
  x: number;
  y: number;
  scale: number;
  radius: number;
  hitsLeft: number;
  maxHits: number;
  opened: boolean;
  containedItemUids: string[];
}

export interface PetCatState {
  enabled: boolean;
  mood: 'idle' | 'mischief' | 'pleased';
  x: number;
  y: number;
  cooldownSec: number;
  nextActionInSec: number;
  petsReceived: number;
  petsNeeded: number;
  freeGiftsUsedInLevel: number;
  maxFreeGiftsPerLevel: number;
  adGiftsUsedInLevel: number;
  maxAdGiftsPerLevel: number;
  bubbleText: string | null;
  bubbleTimerSec: number;
  targetItemUid: string | null;
}

export interface GeneratedLevel {
  levelNumber: number;
  loopIndex: number;
  seed: number;
  theme: RoomThemeId;
  timeOfDay: TimeOfDay;
  modifiers: LevelModifierId[];
  hostTitle: string;
  hostOpening: string;
  hostVictory: string;
  tutorialHint: string | null;
  totalItems: number;
  distinctItemTypes: number;
  maxStackDepth: number;
  orderQueue: OrderSpec[];
  initialItems: BoardItemInstance[];
  initialBoxes: CardboardBoxInstance[];
  petEnabled: boolean;
  petCooldownSec: number;
  baseTraySlots: number;
  maxTraySlots: number;
}

export interface GameEvent {
  type:
    | 'level_started'
    | 'item_blocked'
    | 'item_delivered'
    | 'item_to_tray'
    | 'order_completed'
    | 'order_refreshed'
    | 'box_hit'
    | 'box_opened'
    | 'fever_started'
    | 'fever_ended'
    | 'cat_mischief'
    | 'cat_petted'
    | 'cat_gift_delivered'
    | 'cat_need_ad'
    | 'cat_limit_reached'
    | 'booster_used'
    | 'hint_ready'
    | 'tray_full'
    | 'revived'
    | 'ad_order_unlocked'
    | 'ad_tray_unlocked'
    | 'level_won';
  payload?: Record<string, unknown>;
}

export interface SessionSnapshot {
  levelNumber: number;
  loopIndex: number;
  theme: RoomThemeId;
  timeOfDay: TimeOfDay;
  modifiers: LevelModifierId[];
  status: 'playing' | 'failed_tray_full' | 'won';
  hostTitle: string;
  hostOpening: string;
  hostVictory: string;
  tutorialHint: string | null;
  progressDone: number;
  progressTotal: number;
  distinctItemTypes: number;
  maxStackDepth: number;
  ordersCompleted: number;
  ordersTotal: number;
  orderSlots: OrderSlotState[];
  pendingOrdersCount: number;
  trayMaxSlots: number;
  trayUnlockedSlots: number;
  tray: TrayItem[];
  items: BoardItemInstance[];
  boxes: CardboardBoxInstance[];
  pet: PetCatState;
  comboCount: number;
  comboTimerSec: number;
  feverActive: boolean;
  feverRemainingSec: number;
  boosters: Record<BoosterType, number>;
  highlightedItemUid: string | null;
  highlightedBlockerUids: string[];
  elapsedSec: number;
  starsEarned: number;
}

export interface SaveData {
  userId: string;
  nickname: string;
  createdAt: string;
  currentLevel: number;
  highestLevel: number;
  totalStars: number;
  totalLevelsCleared: number;
  petTreats: number;
  dailyClaimDate: string;
  dailyFreeClaimed: number;
  dailyAdClaimed: number;
  boosters: Record<BoosterType, number>;
  muted: boolean;
  vibrationEnabled: boolean;
  bgmEnabled: boolean;
  levelStars: Record<number, number>;
}

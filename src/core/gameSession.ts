import { getItemSpritePool, ITEM_BY_ID, ROOM_CATALOG } from './catalogs';
import { BOX_SPREAD_OFFSETS, distPx, generateLevel, type GenerateLevelOptions, recomputeBlockers } from './levelGenerator';
import { SeededRng } from './rng';
import type {
  BoardItemInstance,
  BoosterType,
  CardboardBoxInstance,
  GameEvent,
  GeneratedLevel,
  OrderSlotState,
  PetCatState,
  RoomAnchor,
  SessionSnapshot,
  TrayItem,
} from './types';
import { GOLDEN_ITEM_COINS, ORDER_COMPLETE_COINS } from './userProfile';

export interface GameSessionOptions {
  initialBoosters?: Record<BoosterType, number>;
}

export class GameSession {
  readonly level: GeneratedLevel;
  private status: 'playing' | 'failed_tray_full' | 'won' = 'playing';
  private items: BoardItemInstance[];
  private boxes: CardboardBoxInstance[];
  private orderSlots: OrderSlotState[];
  private pendingOrders;
  private ordersCompleted = 0;
  private trayUnlockedSlots: number;
  private tray: TrayItem[] = [];
  private pet: PetCatState;
  private comboCount = 0;
  private comboTimerSec = 0;
  private feverActive = false;
  private feverRemainingSec = 0;
  private boosters: Record<BoosterType, number>;
  private highlightedItemUid: string | null = null;
  private highlightedBlockerUids: string[] = [];
  private elapsedSec = 0;
  private starsEarned = 0;
  private coinsEarnedInSession = 0;
  private rng: SeededRng;
  private listeners: Array<(event: GameEvent) => void> = [];

  constructor(level: GeneratedLevel, options: GameSessionOptions = {}) {
    this.level = level;
    this.rng = new SeededRng(level.seed ^ 0x517cc1b7);
    this.items = level.initialItems.map((it) => ({ ...it, blockedBy: [...it.blockedBy] }));
    this.boxes = level.initialBoxes.map((b) => ({ ...b, containedItemUids: [...b.containedItemUids] }));
    this.trayUnlockedSlots = level.baseTraySlots;
    this.boosters = options.initialBoosters
      ? { ...options.initialBoosters }
      : { magnet: 2, undo: 2, hint: 2, shuffle: 2 };

    const queue = level.orderQueue.map((o) => ({ ...o }));
    const first = queue.shift() ?? null;
    const second = queue.shift() ?? null;
    this.pendingOrders = queue;

    this.orderSlots = [
      { slotIndex: 0, unlocked: true, isAdSlot: false, order: first, collectedCount: 0 },
      { slotIndex: 1, unlocked: true, isAdSlot: false, order: second, collectedCount: 0 },
      { slotIndex: 2, unlocked: false, isAdSlot: true, order: null, collectedCount: 0 },
    ];

    this.pet = {
      enabled: level.petEnabled,
      mood: 'idle',
      x: 0.78,
      y: 0.72,
      cooldownSec: level.petCooldownSec,
      nextActionInSec: level.petEnabled && level.catMischiefEnabled ? Math.min(12, level.petCooldownSec * 0.6) : 9999,
      petsReceived: 0,
      petsNeeded: 2,
      freeGiftsUsedInLevel: 0,
      maxFreeGiftsPerLevel: 5,
      adGiftsUsedInLevel: 0,
      maxAdGiftsPerLevel: 1,
      bubbleText: level.petEnabled
        ? level.catMischiefEnabled
          ? '喵呜~ 喂猫条摸我2下，帮你找藏起来的物品!'
          : '喵~ 摸我2下喂猫条，我帮你精准找收纳物品!'
        : null,
      bubbleTimerSec: level.petEnabled ? 3.8 : 0,
      targetItemUid: null,
    };

    recomputeBlockers(this.items, this.boxes);
  }

  static fromLevelNumber(
    levelNumber: number,
    genOptions?: GenerateLevelOptions,
    sessionOptions?: GameSessionOptions
  ): GameSession {
    return new GameSession(generateLevel(levelNumber, genOptions), sessionOptions);
  }

  onEvent(listener: (event: GameEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(type: GameEvent['type'], payload?: Record<string, unknown>): void {
    const ev: GameEvent = { type, payload };
    for (const l of this.listeners) {
      l(ev);
    }
  }

  getBoosters(): Record<BoosterType, number> {
    return { ...this.boosters };
  }

  addBoosterStock(type: BoosterType, amount = 1): void {
    this.boosters[type] = Math.max(0, this.boosters[type] + amount);
  }

  refillBoosters(amount = 3): void {
    this.boosters = {
      magnet: Math.max(this.boosters.magnet, amount),
      undo: Math.max(this.boosters.undo, amount),
      hint: Math.max(this.boosters.hint, amount),
      shuffle: Math.max(this.boosters.shuffle, amount),
    };
  }

  isPlaying(): boolean {
    return this.status === 'playing';
  }

  getLoopDigest(): {
    status: 'playing' | 'failed_tray_full' | 'won';
    petMood: PetCatState['mood'];
    petBubbleText: string | null;
    feverActive: boolean;
    comboCount: number;
  } {
    return {
      status: this.status,
      petMood: this.pet.mood,
      petBubbleText: this.pet.bubbleText,
      feverActive: this.feverActive,
      comboCount: this.comboCount,
    };
  }

  getSnapshot(): SessionSnapshot {
    const deliveredCount = this.items.filter((it) => it.state === 'delivered').length;
    return {
      levelNumber: this.level.levelNumber,
      loopIndex: this.level.loopIndex,
      theme: this.level.theme,
      timeOfDay: this.level.timeOfDay,
      modifiers: [...this.level.modifiers],
      status: this.status,
      hostTitle: this.level.hostTitle,
      hostOpening: this.level.hostOpening,
      hostVictory: this.level.hostVictory,
      tutorialHint: this.level.tutorialHint,
      progressDone: deliveredCount,
      progressTotal: this.level.totalItems,
      distinctItemTypes: this.level.distinctItemTypes,
      maxStackDepth: this.level.maxStackDepth,
      ordersCompleted: this.ordersCompleted,
      ordersTotal: this.level.orderQueue.length,
      orderSlots: this.orderSlots.map((s) => ({
        ...s,
        order: s.order ? { ...s.order } : null,
      })),
      pendingOrdersCount: this.pendingOrders.length,
      trayMaxSlots: this.level.maxTraySlots,
      trayUnlockedSlots: this.trayUnlockedSlots,
      tray: this.tray.map((t) => ({ ...t })),
      items: this.items.map((it) => ({ ...it, blockedBy: [...it.blockedBy] })),
      boxes: this.boxes.map((b) => ({ ...b, containedItemUids: [...b.containedItemUids] })),
      pet: { ...this.pet },
      comboCount: this.comboCount,
      comboTimerSec: this.comboTimerSec,
      feverActive: this.feverActive,
      feverRemainingSec: this.feverRemainingSec,
      boosters: { ...this.boosters },
      highlightedItemUid: this.highlightedItemUid,
      highlightedBlockerUids: [...this.highlightedBlockerUids],
      elapsedSec: this.elapsedSec,
      starsEarned: this.starsEarned,
      coinMultiplier: this.level.coinMultiplier,
      isMilestoneLevel: this.level.isMilestoneLevel,
      levelBadge: this.level.levelBadge,
      coinsEarnedInSession: this.coinsEarnedInSession,
    };
  }

  private alignItemPoseToAnchor(item: BoardItemInstance, anchor: RoomAnchor): void {
    const pool = getItemSpritePool(item.itemId);
    const pref = anchor.preferredPose;
    let chosenIdx = -1;
    if (pref) {
      chosenIdx = pool.findIndex((p) => p.pose === pref);
    }
    if (chosenIdx < 0) {
      chosenIdx = pool.findIndex((p) => p.pose === 'flat' || p.pose === 'tuck_corner');
    }
    if (chosenIdx < 0) chosenIdx = 0;
    const chosen = pool[chosenIdx];
    item.variantIndex = chosenIdx;
    item.pose = chosen.pose;
    item.aspectRatio = chosen.aspectRatio;
    const isOriented =
      chosen.pose === 'drape_sofa_back' ||
      chosen.pose === 'drape_sofa_edge' ||
      chosen.pose === 'drape_table_edge' ||
      chosen.pose === 'lean_upright';
    item.rotation = isOriented
      ? (anchor.fixedRotation ?? 0) + this.rng.float(-5, 5)
      : (anchor.fixedRotation ?? 0) + this.rng.float(-(anchor.rotationJitter ?? 15), anchor.rotationJitter ?? 15);
  }

  private findMatchingSlot(itemId: string): OrderSlotState | null {
    for (const slot of this.orderSlots) {
      if (
        slot.unlocked &&
        slot.order &&
        slot.order.itemId === itemId &&
        slot.collectedCount < slot.order.requiredCount
      ) {
        return slot;
      }
    }
    return null;
  }

  private awardSessionCoins(amount: number, reason: 'golden_item' | 'order_completed', meta?: Record<string, unknown>): void {
    const coins = Math.max(0, Math.floor(amount * this.level.coinMultiplier));
    if (coins <= 0) return;
    this.coinsEarnedInSession += coins;
    this.emit('coin_earned', { amount: coins, reason, ...meta });
  }

  private deliverItemToSlot(
    item: BoardItemInstance,
    slot: OrderSlotState,
    meta: { fromX: number; fromY: number; fromTray: boolean; fromTrayIndex?: number }
  ): void {
    item.state = 'delivered';
    slot.collectedCount += 1;

    this.emit('item_delivered', {
      uid: item.uid,
      itemId: item.itemId,
      variantIndex: item.variantIndex ?? 0,
      slotIndex: slot.slotIndex,
      orderId: slot.order?.id ?? '',
      fromX: meta.fromX,
      fromY: meta.fromY,
      fromTray: meta.fromTray,
      fromTrayIndex: meta.fromTrayIndex,
      rotation: item.rotation,
      collectedCount: slot.collectedCount,
      requiredCount: slot.order?.requiredCount ?? 0,
    });

    if (item.isGolden) {
      item.isGolden = false;
      this.awardSessionCoins(GOLDEN_ITEM_COINS, 'golden_item', {
        uid: item.uid,
        x: meta.fromX,
        y: meta.fromY,
      });
    }

    if (slot.order && slot.collectedCount >= slot.order.requiredCount) {
      const completedOrder = slot.order;
      this.ordersCompleted += 1;
      this.emit('order_completed', {
        slotIndex: slot.slotIndex,
        orderId: completedOrder.id,
        itemId: completedOrder.itemId,
        requiredCount: completedOrder.requiredCount,
      });
      this.awardSessionCoins(ORDER_COMPLETE_COINS, 'order_completed', {
        slotIndex: slot.slotIndex,
      });

      const next = this.pendingOrders.shift() ?? null;
      slot.order = next;
      slot.collectedCount = 0;
      if (next) {
        this.emit('order_refreshed', {
          slotIndex: slot.slotIndex,
          orderId: next.id,
          itemId: next.itemId,
          requiredCount: next.requiredCount,
        });
      }
    }
  }

  /**
   * Loops until no item remaining in tray matches any active unlocked order box.
   */
  private drainTrayMatches(): void {
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (let i = 0; i < this.tray.length; i++) {
        const trayItem = this.tray[i];
        const slot = this.findMatchingSlot(trayItem.itemId);
        if (slot) {
          this.tray.splice(i, 1);
          const boardRef = this.items.find((it) => it.uid === trayItem.uid);
          if (boardRef) {
            this.deliverItemToSlot(boardRef, slot, {
              fromX: 0.5,
              fromY: 0.82,
              fromTray: true,
              fromTrayIndex: i,
            });
          }
          progressed = true;
          break;
        }
      }
    }
  }

  private registerComboHit(): void {
    this.comboCount += 1;
    this.comboTimerSec = 3.6;

    if (this.comboCount >= 5 && !this.feverActive) {
      this.feverActive = true;
      this.feverRemainingSec = 6.0;
      this.emit('fever_started', { comboCount: this.comboCount });
    }
  }

  private checkWinOrTrayFull(): void {
    const allDelivered = this.items.every((it) => it.state === 'delivered');
    if (allDelivered && this.tray.length === 0) {
      this.status = 'won';
      const par3 = Math.max(95, Math.round(this.level.totalItems * 1.6));
      const par2 = Math.round(par3 * 1.7);
      this.starsEarned = this.elapsedSec <= par3 ? 3 : this.elapsedSec <= par2 ? 2 : 1;
      this.emit('level_won', {
        levelNumber: this.level.levelNumber,
        starsEarned: this.starsEarned,
        elapsedSec: this.elapsedSec,
        coinsEarnedInSession: this.coinsEarnedInSession,
      });
      return;
    }

    if (this.tray.length >= this.trayUnlockedSlots) {
      this.status = 'failed_tray_full';
      this.emit('tray_full', { trayLength: this.tray.length });
    }
  }

  tapItem(uid: string): { accepted: boolean; reason?: string } {
    if (this.status !== 'playing') {
      return { accepted: false, reason: 'not_playing' };
    }
    const item = this.items.find((it) => it.uid === uid);
    if (!item || item.state !== 'on_board') {
      return { accepted: false, reason: 'not_on_board' };
    }

    recomputeBlockers(this.items, this.boxes);
    if (item.blockedBy.length > 0) {
      this.emit('item_blocked', { uid: item.uid, blockedBy: [...item.blockedBy] });
      return { accepted: false, reason: 'blocked' };
    }

    this.highlightedItemUid = null;
    this.highlightedBlockerUids = [];

    const slot = this.findMatchingSlot(item.itemId);
    if (slot) {
      this.deliverItemToSlot(item, slot, {
        fromX: item.x,
        fromY: item.y,
        fromTray: false,
      });
      this.registerComboHit();
      this.drainTrayMatches();
      recomputeBlockers(this.items, this.boxes);
      this.checkWinOrTrayFull();
      return { accepted: true };
    }

    // Move into temporary tray
    item.state = 'in_tray';
    this.tray.push({
      uid: item.uid,
      itemId: item.itemId,
      variantIndex: item.variantIndex,
      fromAnchorId: item.anchorId,
      fromLayer: item.layer,
      fromX: item.x,
      fromY: item.y,
      fromRotation: item.rotation,
      fromScale: item.scale,
    });
    if (!this.feverActive) {
      this.comboCount = 0;
      this.comboTimerSec = 0;
    }

    this.emit('item_to_tray', {
      uid: item.uid,
      itemId: item.itemId,
      variantIndex: item.variantIndex ?? 0,
      trayIndex: this.tray.length - 1,
      fromX: item.x,
      fromY: item.y,
      rotation: item.rotation,
    });

    recomputeBlockers(this.items, this.boxes);
    this.checkWinOrTrayFull();
    return { accepted: true };
  }

  tapBox(boxUid: string): { accepted: boolean; opened: boolean } {
    if (this.status !== 'playing') return { accepted: false, opened: false };
    const box = this.boxes.find((b) => b.uid === boxUid && !b.opened);
    if (!box) return { accepted: false, opened: false };

    box.hitsLeft = Math.max(0, box.hitsLeft - 1);
    if (box.hitsLeft > 0) {
      this.emit('box_hit', { uid: box.uid, hitsLeft: box.hitsLeft });
      return { accepted: true, opened: false };
    }

    box.opened = true;
    const room = ROOM_CATALOG[this.level.theme];
    const targetAnchors = [...room.anchors].sort(
      (a, b) => distPx(a.x, a.y, box.x, box.y) - distPx(b.x, b.y, box.x, box.y)
    );

    const spawned: string[] = [];
    box.containedItemUids.forEach((uid, idx) => {
      const it = this.items.find((x) => x.uid === uid);
      if (!it) return;
      const anchor: RoomAnchor = targetAnchors[idx % targetAnchors.length];
      const off = BOX_SPREAD_OFFSETS[idx % BOX_SPREAD_OFFSETS.length];
      const spawnX = Math.min(0.9, Math.max(0.1, anchor.x + off.dx));
      const spawnY = Math.min(0.76, Math.max(0.41, anchor.y + off.dy));
      let topLayer = 0;
      for (const other of this.items) {
        if (
          other.state === 'on_board' &&
          (other.anchorId === anchor.id || distPx(other.x, other.y, spawnX, spawnY) < 95)
        ) {
          topLayer = Math.max(topLayer, other.layer + 1);
        }
      }
      it.state = 'on_board';
      it.hiddenByBoxId = null;
      it.anchorId = anchor.id;
      it.layer = topLayer;
      it.x = spawnX;
      it.y = spawnY;
      this.alignItemPoseToAnchor(it, anchor);
      it.scale = anchor.scale;
      it.radius = ITEM_BY_ID[it.itemId].radius * anchor.scale;
      spawned.push(uid);
    });

    recomputeBlockers(this.items, this.boxes);
    this.emit('box_opened', { uid: box.uid, spawnedItemUids: spawned });
    return { accepted: true, opened: true };
  }

  unlockAdOrderSlot(): boolean {
    const adSlot = this.orderSlots.find((s) => s.isAdSlot && !s.unlocked);
    if (!adSlot) return false;
    adSlot.unlocked = true;
    if (!adSlot.order && this.pendingOrders.length > 0) {
      adSlot.order = this.pendingOrders.shift() ?? null;
      adSlot.collectedCount = 0;
    }
    this.emit('ad_order_unlocked', { slotIndex: adSlot.slotIndex });
    this.drainTrayMatches();
    recomputeBlockers(this.items, this.boxes);
    if (this.status === 'failed_tray_full' && this.tray.length < this.trayUnlockedSlots) {
      this.status = 'playing';
    }
    this.checkWinOrTrayFull();
    return true;
  }

  /**
   * Reward-assisted quick-fill ("装满"): completes all remaining items for an active order box
   * by pulling matching items directly from tray, board, or unopened boxes while keeping item state clean.
   */
  fillOrderByReward(slotIndex: number): { filled: boolean; deliveredCount: number; itemId?: string } {
    if (this.status !== 'playing') {
      return { filled: false, deliveredCount: 0 };
    }
    const slot = this.orderSlots[slotIndex];
    if (!slot || !slot.unlocked || !slot.order) {
      return { filled: false, deliveredCount: 0 };
    }
    const targetOrder = slot.order;
    const needed = Math.max(0, targetOrder.requiredCount - slot.collectedCount);
    if (needed <= 0) {
      return { filled: false, deliveredCount: 0 };
    }

    let deliveredCount = 0;
    while (deliveredCount < needed && slot.order === targetOrder) {
      const trayIdx = this.tray.findIndex((t) => t.itemId === targetOrder.itemId);
      if (trayIdx >= 0) {
        const trayItem = this.tray.splice(trayIdx, 1)[0];
        const boardRef = this.items.find((it) => it.uid === trayItem.uid);
        if (boardRef) {
          this.deliverItemToSlot(boardRef, slot, {
            fromX: 0.5,
            fromY: 0.82,
            fromTray: true,
            fromTrayIndex: trayIdx,
          });
          deliveredCount += 1;
          continue;
        }
      }

      const candidate =
        this.items.find(
          (it) => it.state === 'on_board' && it.itemId === targetOrder.itemId
        ) ??
        this.items.find(
          (it) => it.state === 'hidden_in_box' && it.itemId === targetOrder.itemId
        );
      if (!candidate) break;

      if (candidate.state === 'hidden_in_box' && candidate.hiddenByBoxId) {
        const box = this.boxes.find((b) => b.uid === candidate.hiddenByBoxId);
        if (box) {
          box.containedItemUids = box.containedItemUids.filter((u) => u !== candidate.uid);
        }
        candidate.hiddenByBoxId = null;
      }

      this.deliverItemToSlot(candidate, slot, {
        fromX: candidate.x,
        fromY: candidate.y,
        fromTray: false,
      });
      deliveredCount += 1;
    }

    if (deliveredCount === 0) {
      return { filled: false, deliveredCount: 0 };
    }

    this.highlightedItemUid = null;
    this.highlightedBlockerUids = [];
    this.drainTrayMatches();
    recomputeBlockers(this.items, this.boxes);
    this.emit('order_reward_filled', {
      slotIndex,
      orderId: targetOrder.id,
      itemId: targetOrder.itemId,
      deliveredCount,
    });
    this.checkWinOrTrayFull();
    return { filled: true, deliveredCount, itemId: targetOrder.itemId };
  }

  unlockAdTraySlot(): boolean {
    if (this.trayUnlockedSlots >= this.level.maxTraySlots) return false;
    this.trayUnlockedSlots += 1;
    if (this.status === 'failed_tray_full' && this.tray.length < this.trayUnlockedSlots) {
      this.status = 'playing';
    }
    this.emit('ad_tray_unlocked', { trayUnlockedSlots: this.trayUnlockedSlots });
    return true;
  }

  reviveClearTray(count = 3): number {
    if (this.tray.length === 0) return 0;
    const room = ROOM_CATALOG[this.level.theme];
    const moved = Math.min(count, this.tray.length);

    for (let i = 0; i < moved; i++) {
      const trayItem = this.tray.pop()!;
      const boardRef = this.items.find((it) => it.uid === trayItem.uid);
      if (!boardRef) continue;
      const anchor = room.anchors[(i * 7 + this.rng.int(0, 6)) % room.anchors.length];
      let topLayer = 0;
      for (const other of this.items) {
        if (other.state === 'on_board' && other.anchorId === anchor.id) {
          topLayer = Math.max(topLayer, other.layer + 1);
        }
      }
      boardRef.state = 'on_board';
      boardRef.anchorId = anchor.id;
      boardRef.layer = topLayer;
      boardRef.x = anchor.x;
      boardRef.y = anchor.y;
      this.alignItemPoseToAnchor(boardRef, anchor);
      boardRef.scale = anchor.scale;
      boardRef.radius = ITEM_BY_ID[boardRef.itemId].radius * anchor.scale;
    }

    recomputeBlockers(this.items, this.boxes);
    if (this.tray.length < this.trayUnlockedSlots && this.status === 'failed_tray_full') {
      this.status = 'playing';
    }
    this.emit('revived', { returnedCount: moved });
    return moved;
  }

  useBooster(type: BoosterType): { ok: boolean; reason?: string } {
    if (this.status !== 'playing') return { ok: false, reason: 'not_playing' };
    if (this.boosters[type] <= 0) return { ok: false, reason: 'no_stock' };

    if (type === 'magnet') {
      let delivered = 0;
      for (let pass = 0; pass < 2; pass++) {
        const candidate = this.items.find((it) => {
          if (pass === 0 && it.state !== 'on_board') return false;
          if (pass === 1 && it.state !== 'on_board' && it.state !== 'hidden_in_box') return false;
          return this.findMatchingSlot(it.itemId) !== null;
        });
        if (!candidate) break;
        const slot = this.findMatchingSlot(candidate.itemId)!;
        if (candidate.state === 'hidden_in_box' && candidate.hiddenByBoxId) {
          const box = this.boxes.find((b) => b.uid === candidate.hiddenByBoxId);
          if (box) {
            box.containedItemUids = box.containedItemUids.filter((u) => u !== candidate.uid);
          }
          candidate.hiddenByBoxId = null;
        }
        this.deliverItemToSlot(candidate, slot, {
          fromX: candidate.x,
          fromY: candidate.y,
          fromTray: false,
        });
        delivered += 1;
        this.drainTrayMatches();
      }
      if (delivered === 0) return { ok: false, reason: 'no_target' };
      this.boosters.magnet -= 1;
      recomputeBlockers(this.items, this.boxes);
      this.emit('booster_used', { type: 'magnet', delivered });
      this.checkWinOrTrayFull();
      return { ok: true };
    }

    if (type === 'undo') {
      if (this.tray.length === 0) return { ok: false, reason: 'tray_empty' };
      const fromTrayIndex = this.tray.length - 1;
      const last = this.tray.pop()!;
      const item = this.items.find((it) => it.uid === last.uid);
      if (!item) return { ok: false, reason: 'missing_item' };

      let topLayer = last.fromLayer;
      for (const other of this.items) {
        if (other.state === 'on_board' && other.anchorId === last.fromAnchorId) {
          topLayer = Math.max(topLayer, other.layer + 1);
        }
      }
      item.state = 'on_board';
      item.anchorId = last.fromAnchorId;
      item.layer = topLayer;
      item.x = last.fromX;
      item.y = last.fromY;
      item.rotation = last.fromRotation;
      item.scale = last.fromScale;
      this.boosters.undo -= 1;
      recomputeBlockers(this.items, this.boxes);
      this.emit('booster_used', {
        type: 'undo',
        uid: item.uid,
        itemId: item.itemId,
        variantIndex: item.variantIndex ?? 0,
        fromTrayIndex,
        toX: item.x,
        toY: item.y,
        toRotation: item.rotation,
      });
      return { ok: true };
    }

    if (type === 'hint') {
      recomputeBlockers(this.items, this.boxes);
      const unblockedMatch = this.items.find(
        (it) =>
          it.state === 'on_board' &&
          it.blockedBy.length === 0 &&
          this.findMatchingSlot(it.itemId) !== null
      );
      if (unblockedMatch) {
        this.boosters.hint -= 1;
        this.highlightedItemUid = unblockedMatch.uid;
        this.highlightedBlockerUids = [];
        this.emit('hint_ready', {
          targetUid: unblockedMatch.uid,
          blockerUids: [],
        });
        this.emit('booster_used', { type: 'hint' });
        return { ok: true };
      }

      const blockedMatch = this.items.find(
        (it) => it.state === 'on_board' && this.findMatchingSlot(it.itemId) !== null
      );
      if (blockedMatch) {
        const rootBlocker = this.findUnblockedRootBlocker(blockedMatch);
        this.boosters.hint -= 1;
        this.highlightedItemUid = rootBlocker;
        this.highlightedBlockerUids = [blockedMatch.uid];
        this.emit('hint_ready', {
          targetUid: rootBlocker,
          blockerUids: [blockedMatch.uid],
        });
        this.emit('booster_used', { type: 'hint' });
        return { ok: true };
      }

      const closedBox = this.boxes.find((b) => !b.opened);
      if (closedBox) {
        this.boosters.hint -= 1;
        this.highlightedItemUid = closedBox.uid;
        this.highlightedBlockerUids = [];
        this.emit('hint_ready', { targetUid: closedBox.uid, blockerUids: [] });
        this.emit('booster_used', { type: 'hint' });
        return { ok: true };
      }
      return { ok: false, reason: 'no_hint' };
    }

    if (type === 'shuffle') {
      const boardItems = this.items.filter((it) => it.state === 'on_board');
      if (boardItems.length === 0) return { ok: false, reason: 'board_empty' };

      const room = ROOM_CATALOG[this.level.theme];
      const closedBoxAnchors = new Set(
        this.boxes.filter((b) => !b.opened).map((b) => b.anchorId)
      );
      const usableAnchors = this.rng.shuffle(
        room.anchors.filter((a) => !closedBoxAnchors.has(a.id))
      );
      const targetAnchors = usableAnchors.length > 0 ? usableAnchors : room.anchors;

      boardItems.sort((a, b) => {
        const aMatch = this.findMatchingSlot(a.itemId) ? 1 : 0;
        const bMatch = this.findMatchingSlot(b.itemId) ? 1 : 0;
        return aMatch - bMatch;
      });

      const depthMap = new Map<string, number>();
      boardItems.forEach((it, idx) => {
        const anchor = targetAnchors[idx % targetAnchors.length];
        const layer = depthMap.get(anchor.id) ?? 0;
        depthMap.set(anchor.id, layer + 1);
        it.anchorId = anchor.id;
        it.layer = layer;
        it.x = Math.min(0.9, Math.max(0.1, anchor.x + this.rng.float(-0.018, 0.018)));
        it.y = Math.min(0.76, Math.max(0.4, anchor.y + this.rng.float(-0.012, 0.012) - layer * 0.008));
        this.alignItemPoseToAnchor(it, anchor);
        it.scale = anchor.scale;
        it.radius = ITEM_BY_ID[it.itemId].radius * anchor.scale;
      });

      this.boosters.shuffle -= 1;
      this.highlightedItemUid = null;
      this.highlightedBlockerUids = [];
      recomputeBlockers(this.items, this.boxes);
      this.emit('booster_used', { type: 'shuffle' });
      return { ok: true };
    }

    return { ok: false, reason: 'unknown_booster' };
  }

  private findUnblockedRootBlocker(item: BoardItemInstance): string {
    let curr: BoardItemInstance = item;
    for (let guard = 0; guard < 12; guard++) {
      if (curr.blockedBy.length === 0) return curr.uid;
      const firstBlockerId = curr.blockedBy[0];
      const box = this.boxes.find((b) => b.uid === firstBlockerId && !b.opened);
      if (box) return box.uid;
      const parent = this.items.find((it) => it.uid === firstBlockerId && it.state === 'on_board');
      if (!parent) return curr.uid;
      curr = parent;
    }
    return curr.uid;
  }

  petCat(availableTreats: number): {
    status:
      | 'petted'
      | 'gifted'
      | 'need_ad_no_treats'
      | 'need_ad_level_cap'
      | 'level_limit_reached'
      | 'unavailable';
    treatsSpent: number;
    itemUid?: string;
  } {
    if (!this.pet.enabled || this.status !== 'playing') {
      return { status: 'unavailable', treatsSpent: 0 };
    }

    const totalRemainingInLevel =
      this.pet.maxFreeGiftsPerLevel -
      this.pet.freeGiftsUsedInLevel +
      (this.pet.maxAdGiftsPerLevel - this.pet.adGiftsUsedInLevel);

    if (totalRemainingInLevel <= 0) {
      this.pet.bubbleText = '喵~ 本局已经帮满次数啦，剩下的靠你咯!';
      this.pet.bubbleTimerSec = 3.0;
      this.emit('cat_limit_reached');
      return { status: 'level_limit_reached', treatsSpent: 0 };
    }

    if (this.pet.freeGiftsUsedInLevel >= this.pet.maxFreeGiftsPerLevel) {
      this.pet.bubbleText = '本局猫条帮忙次数用完啦，点我看看还能怎么帮忙。';
      this.pet.bubbleTimerSec = 3.5;
      this.emit('cat_need_ad', { reason: 'level_cap' });
      return { status: 'need_ad_level_cap', treatsSpent: 0 };
    }

    if (availableTreats <= 0) {
      this.pet.bubbleText = '没有猫条啦，去猫条小铺看看吧！';
      this.pet.bubbleTimerSec = 3.5;
      this.emit('cat_need_ad', { reason: 'no_treats' });
      return { status: 'need_ad_no_treats', treatsSpent: 0 };
    }

    this.pet.petsReceived += 1;
    this.emit('cat_petted', { petsReceived: this.pet.petsReceived, petsNeeded: this.pet.petsNeeded });

    if (this.pet.petsReceived < this.pet.petsNeeded) {
      this.pet.bubbleText = '喵~ 再摸一下就替你找出需要收纳的物品!';
      this.pet.bubbleTimerSec = 3.0;
      return { status: 'petted', treatsSpent: 0 };
    }

    this.pet.petsReceived = 0;
    this.pet.freeGiftsUsedInLevel += 1;
    const itemUid = this.deliverCatGift();
    return { status: 'gifted', treatsSpent: 1, itemUid };
  }

  grantAdCatGift(): { gifted: boolean; itemUid?: string } {
    if (!this.pet.enabled || this.status !== 'playing') {
      return { gifted: false };
    }
    if (this.pet.adGiftsUsedInLevel >= this.pet.maxAdGiftsPerLevel) {
      return { gifted: false };
    }
    this.pet.petsReceived = 0;
    this.pet.adGiftsUsedInLevel += 1;
    const itemUid = this.deliverCatGift();
    return { gifted: Boolean(itemUid), itemUid };
  }

  private deliverCatGift(): string | undefined {
    this.pet.mood = 'pleased';
    this.pet.nextActionInSec = this.pet.cooldownSec;
    this.pet.targetItemUid = null;

    recomputeBlockers(this.items, this.boxes);
    // Smart finder: prefer occluded active order item first, then unblocked on_board, then hidden_in_box
    const activeTarget =
      this.items.find(
        (it) => it.state === 'on_board' && it.blockedBy.length > 0 && this.findMatchingSlot(it.itemId) !== null
      ) ??
      this.items.find((it) => it.state === 'on_board' && this.findMatchingSlot(it.itemId) !== null) ??
      this.items.find((it) => it.state === 'hidden_in_box' && this.findMatchingSlot(it.itemId) !== null);

    if (activeTarget) {
      const foundX = activeTarget.x;
      const foundY = activeTarget.y;
      if (activeTarget.state === 'hidden_in_box' && activeTarget.hiddenByBoxId) {
        const box = this.boxes.find((b) => b.uid === activeTarget.hiddenByBoxId);
        if (box) {
          box.containedItemUids = box.containedItemUids.filter((u) => u !== activeTarget.uid);
        }
        activeTarget.hiddenByBoxId = null;
      }
      const slot = this.findMatchingSlot(activeTarget.itemId)!;
      const def = ITEM_BY_ID[activeTarget.itemId];
      this.pet.bubbleText = `呼噜噜~ 替你找到「${def.name}」并收进箱子啦!`;
      this.pet.bubbleTimerSec = 3.5;
      this.deliverItemToSlot(activeTarget, slot, {
        fromX: foundX,
        fromY: foundY,
        fromTray: false,
      });
      this.registerComboHit();
      this.drainTrayMatches();
      recomputeBlockers(this.items, this.boxes);
      this.emit('cat_gift_delivered', {
        uid: activeTarget.uid,
        itemId: activeTarget.itemId,
        itemName: def.name,
        fromX: foundX,
        fromY: foundY,
      });
      this.checkWinOrTrayFull();
      return activeTarget.uid;
    }

    this.pet.bubbleText = '呼噜噜~ 好舒服!';
    this.pet.bubbleTimerSec = 2.5;
    return undefined;
  }

  movePetTo(x: number, y: number): { x: number; y: number } | null {
    if (!this.pet.enabled || this.status !== 'playing') return null;
    const clampedX = Math.min(0.90, Math.max(0.10, Number.isFinite(x) ? x : this.pet.x));
    const clampedY = Math.min(0.78, Math.max(0.38, Number.isFinite(y) ? y : this.pet.y));
    this.pet.x = clampedX;
    this.pet.y = clampedY;
    this.emit('cat_moved', { x: clampedX, y: clampedY });
    return { x: clampedX, y: clampedY };
  }

  forceCatMischief(): boolean {
    if (this.status !== 'playing') return false;
    this.pet.enabled = true;
    return this.triggerCatMischief();
  }

  private triggerCatMischief(): boolean {
    const candidates = this.items.filter(
      (it) => it.state === 'on_board' && it.blockedBy.length === 0
    );
    if (candidates.length < 3) return false;

    const chosen = this.rng.pick(candidates);
    const room = ROOM_CATALOG[this.level.theme];
    const closedBoxAnchors = new Set(this.boxes.filter((b) => !b.opened).map((b) => b.anchorId));
    const usableAnchors = room.anchors.filter((a) => !closedBoxAnchors.has(a.id));
    const destAnchor = this.rng.pick(usableAnchors.length > 0 ? usableAnchors : room.anchors);
    const nextX = Math.min(0.88, Math.max(0.12, destAnchor.x + this.rng.float(-0.02, 0.02)));
    const nextY = Math.min(0.75, Math.max(0.42, destAnchor.y + this.rng.float(-0.015, 0.015)));
    let topLayer = 0;
    for (const other of this.items) {
      if (
        other.uid !== chosen.uid &&
        other.state === 'on_board' &&
        (other.anchorId === destAnchor.id || distPx(other.x, other.y, nextX, nextY) < 110)
      ) {
        topLayer = Math.max(topLayer, other.layer + 1);
      }
    }

    chosen.anchorId = destAnchor.id;
    chosen.layer = topLayer;
    chosen.x = nextX;
    chosen.y = nextY;
    this.alignItemPoseToAnchor(chosen, destAnchor);
    chosen.scale = destAnchor.scale;
    chosen.radius = ITEM_BY_ID[chosen.itemId].radius * destAnchor.scale;

    recomputeBlockers(this.items, this.boxes);

    this.pet.mood = 'mischief';
    this.pet.petsReceived = 0;
    this.pet.targetItemUid = chosen.uid;
    this.pet.bubbleText = '喵哈哈哈！我把东西扒乱啦（喂猫条摸2下赔给你）';
    this.pet.bubbleTimerSec = 6.0;
    this.pet.nextActionInSec = this.pet.cooldownSec;

    this.emit('cat_mischief', {
      itemUid: chosen.uid,
      x: chosen.x,
      y: chosen.y,
    });
    return true;
  }

  tick(dtSec: number): void {
    if (this.status !== 'playing' || dtSec <= 0) return;

    this.elapsedSec += dtSec;

    if (this.feverActive) {
      this.feverRemainingSec -= dtSec;
      if (this.feverRemainingSec <= 0) {
        this.feverActive = false;
        this.feverRemainingSec = 0;
        this.comboCount = 0;
        this.comboTimerSec = 0;
        this.emit('fever_ended');
      }
    } else if (this.comboCount > 0) {
      this.comboTimerSec -= dtSec;
      if (this.comboTimerSec <= 0) {
        this.comboCount = 0;
        this.comboTimerSec = 0;
      }
    }

    if (this.pet.bubbleTimerSec > 0) {
      this.pet.bubbleTimerSec = Math.max(0, this.pet.bubbleTimerSec - dtSec);
      if (this.pet.bubbleTimerSec === 0) {
        this.pet.bubbleText = null;
        if (this.pet.mood === 'pleased' || this.pet.mood === 'mischief') {
          this.pet.mood = 'idle';
        }
      }
    }

    // Corner-docked companion cat cheers periodically without silently teleporting board items
    // (silently relocating top items previously caused buried lower items to suddenly unlock on their own).
    if (this.pet.enabled && this.level.catMischiefEnabled) {
      this.pet.nextActionInSec -= dtSec;
      if (this.pet.nextActionInSec <= 0) {
        this.pet.nextActionInSec = this.pet.cooldownSec;
        if (!this.pet.bubbleText) {
          this.pet.bubbleText = '喵~ 找不到压在下面的物品？喂猫条摸我2下帮你叼出来!';
          this.pet.bubbleTimerSec = 4.2;
        }
      }
    }
  }
}

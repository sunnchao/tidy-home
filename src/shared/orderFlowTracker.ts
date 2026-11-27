import {
  createOrderSlotTransition,
  expediteSlotTransitionForDirectTap,
  getActiveSlotTransition,
  getOrderTransitionEndMs,
  getQueuedOrderDelayMs,
  type OrderSlotTransition,
  type OrderSlotVisualSample,
} from '@core/flyAnimation';

export interface DeliveryScheduleResult {
  delayMs: number;
  visibleWhileWaiting: boolean;
  flyDurationMs: number;
}

/**
 * Coordinates in-flight order counts, tray drain staggering, and order box seal/exit/enter
 * transitions across both DOM (Web) and Canvas 2D (MiniGame) runtimes.
 */
export class OrderFlowTracker {
  private readonly orderTransitions = new Map<number, OrderSlotTransition[]>();
  private readonly inFlightOrderCounts = new Map<string, number>();
  private readonly latestOrderLandAtMs = new Map<string, number>();
  private trayDrainBatchCount = 0;
  private winUnlockAtMs = 0;

  reset(): void {
    this.orderTransitions.clear();
    this.inFlightOrderCounts.clear();
    this.latestOrderLandAtMs.clear();
    this.trayDrainBatchCount = 0;
    this.winUnlockAtMs = 0;
  }

  getInFlightCounts(): ReadonlyMap<string, number> {
    return this.inFlightOrderCounts;
  }

  getActiveTransition(
    slotIndex: number,
    nowMs: number
  ): { transition: OrderSlotTransition; sample: OrderSlotVisualSample } | null {
    return getActiveSlotTransition(this.orderTransitions.get(slotIndex), nowMs);
  }

  hasPendingTransitions(): boolean {
    for (const queue of this.orderTransitions.values()) {
      if (queue.length > 0) return true;
    }
    return false;
  }

  scheduleDelivery(params: {
    slotIndex: number;
    orderId: string;
    fromTray: boolean;
    nowMs: number;
    flyDurationMs?: number;
  }): DeliveryScheduleResult {
    const flyDurationMs = params.flyDurationMs ?? (params.fromTray ? 400 : 480);
    let stagger = 0;
    let delayMs = 0;

    if (params.fromTray) {
      stagger = this.trayDrainBatchCount * 90;
      delayMs = stagger;
      this.trayDrainBatchCount += 1;
      queueMicrotask(() => {
        this.trayDrainBatchCount = 0;
      });
    }

    const queue = this.orderTransitions.get(params.slotIndex);
    if (params.fromTray || (queue && queue.length > 0 && params.nowMs < queue[queue.length - 1].sealStartAtMs)) {
      const queuedDelay = getQueuedOrderDelayMs(queue, params.orderId, params.nowMs, 180);
      if (queuedDelay > 0) {
        delayMs = Math.max(delayMs, queuedDelay + stagger);
      }
    } else if (!params.fromTray && queue && queue.length > 0) {
      expediteSlotTransitionForDirectTap(queue, params.orderId, params.nowMs + flyDurationMs, params.nowMs);
    }

    const visibleWhileWaiting = delayMs > 0;
    const landAt = params.nowMs + delayMs + flyDurationMs;
    if (params.orderId) {
      this.inFlightOrderCounts.set(params.orderId, (this.inFlightOrderCounts.get(params.orderId) ?? 0) + 1);
      this.latestOrderLandAtMs.set(params.orderId, Math.max(this.latestOrderLandAtMs.get(params.orderId) ?? 0, landAt));
    }

    return { delayMs, visibleWhileWaiting, flyDurationMs };
  }

  markOrderLanded(orderId: string): void {
    if (!orderId) return;
    const left = (this.inFlightOrderCounts.get(orderId) ?? 1) - 1;
    if (left <= 0) this.inFlightOrderCounts.delete(orderId);
    else this.inFlightOrderCounts.set(orderId, left);
  }

  onOrderCompleted(params: {
    slotIndex: number;
    orderId: string;
    itemId: string;
    requiredCount: number;
    nowMs: number;
  }): void {
    const queue = this.orderTransitions.get(params.slotIndex) ?? [];
    const prevEndMs = queue.length > 0 ? getOrderTransitionEndMs(queue[queue.length - 1]) : 0;
    const landAt = Math.max(
      params.nowMs + 120,
      this.latestOrderLandAtMs.get(params.orderId) ?? params.nowMs + 480
    );
    queue.push(
      createOrderSlotTransition({
        slotIndex: params.slotIndex,
        completedOrder: {
          id: params.orderId,
          itemId: params.itemId,
          requiredCount: params.requiredCount,
        },
        nextOrder: null,
        sealStartAtMs: Math.max(landAt, prevEndMs),
      })
    );
    this.orderTransitions.set(params.slotIndex, queue);
  }

  onOrderRefreshed(params: {
    slotIndex: number;
    orderId: string;
    itemId: string;
    requiredCount: number;
  }): boolean {
    const queue = this.orderTransitions.get(params.slotIndex);
    if (!queue || queue.length === 0) return false;
    queue[queue.length - 1].nextOrder = {
      id: params.orderId,
      itemId: params.itemId,
      requiredCount: params.requiredCount,
    };
    return true;
  }

  computeWinUnlockAt(nowMs: number): number {
    let unlockAt = nowMs;
    for (const queue of this.orderTransitions.values()) {
      for (const tr of queue) {
        unlockAt = Math.max(unlockAt, tr.sealStartAtMs + tr.sealHoldMs + 140);
      }
    }
    this.winUnlockAtMs = unlockAt;
    return unlockAt;
  }

  isWinReady(nowMs: number): boolean {
    return nowMs >= this.winUnlockAtMs;
  }
}

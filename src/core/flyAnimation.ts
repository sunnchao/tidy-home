export type FlyAnimKind = 'to_tray' | 'to_order' | 'from_tray_to_order' | 'undo_to_board';

export interface FlyingItemAnim {
  id: string;
  uid: string;
  itemId: string;
  variantIndex: number;
  kind: FlyAnimKind;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  ctrlX: number;
  ctrlY: number;
  startSize: number;
  endSize: number;
  startRotDeg: number;
  targetSlotIndex: number;
  orderId?: string;
  visibleWhileWaiting?: boolean;
  startedAtMs: number;
  delayMs: number;
  durationMs: number;
}

export interface CreateFlyingItemInput {
  id: string;
  uid: string;
  itemId: string;
  variantIndex?: number;
  kind: FlyAnimKind;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startSize: number;
  endSize: number;
  startRotDeg?: number;
  targetSlotIndex?: number;
  orderId?: string;
  visibleWhileWaiting?: boolean;
  startedAtMs: number;
  delayMs?: number;
  durationMs?: number;
}

export interface FlySample {
  phase: 'waiting' | 'flying' | 'done';
  progress: number;
  x: number;
  y: number;
  size: number;
  scale: number;
  rotationDeg: number;
  shadowOffsetY: number;
  shadowAlpha: number;
  opacity: number;
}

export interface SlotBounceSample {
  active: boolean;
  scale: number;
  glowAlpha: number;
}

const DEFAULT_DURATION_MS: Record<FlyAnimKind, number> = {
  to_tray: 460,
  to_order: 480,
  from_tray_to_order: 400,
  undo_to_board: 440,
};

/**
 * Computes a quadratic Bezier control point so flights jump off the board with a natural arc.
 */
export function computeFlyControlPoint(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  kind: FlyAnimKind
): { ctrlX: number; ctrlY: number } {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.hypot(dx, dy);
  const midX = (fromX + toX) * 0.5;
  const midY = (fromY + toY) * 0.5;

  if (kind === 'to_tray') {
    const dir = dx >= 0 ? 1 : -1;
    const lateral = Math.min(48, Math.abs(dx) * 0.14);
    const lift = Math.max(46, Math.min(115, dist * 0.18));
    return {
      ctrlX: midX + dir * lateral,
      ctrlY: Math.min(fromY, midY) - lift,
    };
  }

  const lift = Math.max(70, dist * 0.24);
  return {
    ctrlX: midX - dx * 0.06,
    ctrlY: Math.min(fromY, midY) - lift,
  };
}

/**
 * Creates a parameterized flying animation descriptor usable by DOM RAF and Canvas 2D loops.
 */
export function createFlyingItemAnim(input: CreateFlyingItemInput): FlyingItemAnim {
  const { ctrlX, ctrlY } = computeFlyControlPoint(
    input.fromX,
    input.fromY,
    input.toX,
    input.toY,
    input.kind
  );
  return {
    id: input.id,
    uid: input.uid,
    itemId: input.itemId,
    variantIndex: input.variantIndex ?? 0,
    kind: input.kind,
    fromX: input.fromX,
    fromY: input.fromY,
    toX: input.toX,
    toY: input.toY,
    ctrlX,
    ctrlY,
    startSize: input.startSize,
    endSize: input.endSize,
    startRotDeg: input.startRotDeg ?? 0,
    targetSlotIndex: input.targetSlotIndex ?? 0,
    orderId: input.orderId,
    visibleWhileWaiting: Boolean(input.visibleWhileWaiting),
    startedAtMs: input.startedAtMs,
    delayMs: Math.max(0, input.delayMs ?? 0),
    durationMs: Math.max(120, input.durationMs ?? DEFAULT_DURATION_MS[input.kind]),
  };
}

/**
 * Samples position, scale pulse, rotation, shadow elevation, and phase at `nowMs`.
 */
export function sampleFlyAnim(anim: FlyingItemAnim, nowMs: number): FlySample {
  const elapsed = nowMs - (anim.startedAtMs + anim.delayMs);
  if (elapsed < 0) {
    return {
      phase: 'waiting',
      progress: 0,
      x: anim.fromX,
      y: anim.fromY,
      size: anim.startSize,
      scale: 1,
      rotationDeg: anim.startRotDeg,
      shadowOffsetY: 3,
      shadowAlpha: 0.22,
      opacity: anim.visibleWhileWaiting ? 1 : 0,
    };
  }

  if (elapsed >= anim.durationMs) {
    return {
      phase: 'done',
      progress: 1,
      x: anim.toX,
      y: anim.toY,
      size: anim.endSize,
      scale: 1,
      rotationDeg: 0,
      shadowOffsetY: 2,
      shadowAlpha: 0.2,
      opacity: 1,
    };
  }

  const raw = Math.max(0, Math.min(1, elapsed / anim.durationMs));
  // Gentle S-curve so takeoff is visible in mid-air and landing cushions neatly into the slot.
  const easeInOut = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
  const easeOut = 1 - Math.pow(1 - raw, 2.1);
  const u = easeInOut * 0.72 + easeOut * 0.28;
  const oneMinusU = 1 - u;

  const x = oneMinusU * oneMinusU * anim.fromX + 2 * oneMinusU * u * anim.ctrlX + u * u * anim.toX;
  const y = oneMinusU * oneMinusU * anim.fromY + 2 * oneMinusU * u * anim.ctrlY + u * u * anim.toY;
  const arcBell = Math.sin(Math.PI * raw);

  return {
    phase: 'flying',
    progress: raw,
    x,
    y,
    size: anim.startSize + (anim.endSize - anim.startSize) * u,
    scale: 1 + arcBell * 0.22,
    rotationDeg: anim.startRotDeg * (1 - u) + arcBell * (anim.toX >= anim.fromX ? 8 : -8),
    shadowOffsetY: 4 + arcBell * 18,
    shadowAlpha: 0.22 + arcBell * 0.2,
    opacity: 1,
  };
}

/**
 * Damped pop-and-glow curve played right when a flying item lands in a tray or order slot.
 */
export function sampleSlotBounce(
  landedAtMs: number | undefined,
  nowMs: number,
  durationMs = 260
): SlotBounceSample {
  if (landedAtMs === undefined || nowMs < landedAtMs) {
    return { active: false, scale: 1, glowAlpha: 0 };
  }
  const elapsed = nowMs - landedAtMs;
  if (elapsed >= durationMs) {
    return { active: false, scale: 1, glowAlpha: 0 };
  }
  const t = elapsed / durationMs;
  const wave = Math.sin(t * Math.PI * 1.5) * Math.exp(-3.2 * t);
  return {
    active: true,
    scale: 1 + wave * 0.22,
    glowAlpha: (1 - t) * 0.72,
  };
}

export const ORDER_TRANSITION_TIMING = {
  sealHoldMs: 560,
  exitMs: 320,
  enterMs: 420,
} as const;

export interface OrderSnapshotItem {
  id: string;
  itemId: string;
  requiredCount: number;
}

export interface OrderSlotTransition {
  slotIndex: number;
  completedOrder: OrderSnapshotItem;
  nextOrder: OrderSnapshotItem | null;
  sealStartAtMs: number;
  sealHoldMs: number;
  exitMs: number;
  enterMs: number;
  sealNotified?: boolean;
}

export type OrderSlotTransitionPhase = 'waiting_land' | 'sealed' | 'exiting' | 'entering' | 'done';

export interface OrderSlotVisualSample {
  phase: OrderSlotTransitionPhase;
  displayOrder: OrderSnapshotItem | null;
  forceFullCount: boolean;
  showSealedBadge: boolean;
  offsetY: number;
  scale: number;
  rotationDeg: number;
  opacity: number;
  phaseProgress: number;
}

/**
 * Creates an order-slot completion transition descriptor (wait land -> seal hold -> exit -> enter).
 */
export function createOrderSlotTransition(input: {
  slotIndex: number;
  completedOrder: OrderSnapshotItem;
  nextOrder?: OrderSnapshotItem | null;
  sealStartAtMs: number;
  sealHoldMs?: number;
  exitMs?: number;
  enterMs?: number;
}): OrderSlotTransition {
  return {
    slotIndex: input.slotIndex,
    completedOrder: input.completedOrder,
    nextOrder: input.nextOrder ?? null,
    sealStartAtMs: input.sealStartAtMs,
    sealHoldMs: Math.max(0, input.sealHoldMs ?? ORDER_TRANSITION_TIMING.sealHoldMs),
    exitMs: Math.max(0, input.exitMs ?? ORDER_TRANSITION_TIMING.exitMs),
    enterMs: Math.max(0, input.enterMs ?? ORDER_TRANSITION_TIMING.enterMs),
  };
}

export function getOrderTransitionEnterStartMs(t: OrderSlotTransition): number {
  return t.sealStartAtMs + t.sealHoldMs + t.exitMs;
}

export function getOrderTransitionEndMs(t: OrderSlotTransition): number {
  return t.sealStartAtMs + t.sealHoldMs + t.exitMs + t.enterMs;
}

/**
 * Samples the visual transform and display order for an active order-slot completion transition.
 */
export function sampleOrderSlotTransition(
  t: OrderSlotTransition,
  nowMs: number
): OrderSlotVisualSample {
  if (nowMs < t.sealStartAtMs) {
    return {
      phase: 'waiting_land',
      displayOrder: t.completedOrder,
      forceFullCount: false,
      showSealedBadge: false,
      offsetY: 0,
      scale: 1,
      rotationDeg: 0,
      opacity: 1,
      phaseProgress: 0,
    };
  }

  const sealEndMs = t.sealStartAtMs + t.sealHoldMs;
  if (nowMs < sealEndMs) {
    const p = t.sealHoldMs > 0 ? Math.max(0, Math.min(1, (nowMs - t.sealStartAtMs) / t.sealHoldMs)) : 1;
    const bell = Math.sin(p * Math.PI);
    return {
      phase: 'sealed',
      displayOrder: t.completedOrder,
      forceFullCount: true,
      showSealedBadge: true,
      offsetY: -2 * bell,
      scale: 1 + 0.1 * bell * Math.exp(-2.6 * p) + 0.02,
      rotationDeg: -1.8 * bell,
      opacity: 1,
      phaseProgress: p,
    };
  }

  const enterStartMs = getOrderTransitionEnterStartMs(t);
  if (nowMs < enterStartMs) {
    const p = t.exitMs > 0 ? Math.max(0, Math.min(1, (nowMs - sealEndMs) / t.exitMs)) : 1;
    const u = p * p;
    return {
      phase: 'exiting',
      displayOrder: t.completedOrder,
      forceFullCount: true,
      showSealedBadge: true,
      offsetY: -22 * u,
      scale: 1.02 - 0.18 * u,
      rotationDeg: -3.5 * u,
      opacity: 1 - u,
      phaseProgress: p,
    };
  }

  const endMs = getOrderTransitionEndMs(t);
  if (nowMs < endMs) {
    const p = t.enterMs > 0 ? Math.max(0, Math.min(1, (nowMs - enterStartMs) / t.enterMs)) : 1;
    const e = 1 - Math.pow(1 - p, 3);
    const overshoot = Math.sin(p * Math.PI) * 0.055;
    return {
      phase: 'entering',
      displayOrder: t.nextOrder,
      forceFullCount: false,
      showSealedBadge: false,
      offsetY: 20 * (1 - e),
      scale: 0.86 + 0.14 * e + overshoot,
      rotationDeg: 1.6 * (1 - e),
      opacity: Math.min(1, p * 1.65),
      phaseProgress: p,
    };
  }

  return {
    phase: 'done',
    displayOrder: t.nextOrder,
    forceFullCount: false,
    showSealedBadge: false,
    offsetY: 0,
    scale: 1,
    rotationDeg: 0,
    opacity: 1,
    phaseProgress: 1,
  };
}

/**
 * Prunes finished transitions from the front of `queue` and returns the current active sample.
 */
export function getActiveSlotTransition(
  queue: OrderSlotTransition[] | undefined,
  nowMs: number
): { transition: OrderSlotTransition; sample: OrderSlotVisualSample } | null {
  if (!queue || queue.length === 0) return null;
  while (queue.length > 0 && sampleOrderSlotTransition(queue[0], nowMs).phase === 'done') {
    queue.shift();
  }
  if (queue.length === 0) return null;
  return {
    transition: queue[0],
    sample: sampleOrderSlotTransition(queue[0], nowMs),
  };
}

/**
 * Returns how long an incoming delivery for `orderId` should wait so it enters after the previous box swaps.
 */
export function getQueuedOrderDelayMs(
  queue: OrderSlotTransition[] | undefined,
  orderId: string,
  nowMs: number,
  extraOffsetMs = 180
): number {
  if (!queue || queue.length === 0) return 0;
  let match = queue.find((t) => t.nextOrder?.id === orderId);
  if (!match && orderId && queue.every((t) => t.completedOrder.id !== orderId)) {
    match = queue[queue.length - 1];
  }
  if (!match) return 0;
  return Math.max(0, getOrderTransitionEnterStartMs(match) + extraOffsetMs - nowMs);
}

/**
 * Shortens remaining seal/exit time (keeping >= 120ms exit) when a player manually taps an item for the queued next box.
 */
export function expediteSlotTransitionForDirectTap(
  queue: OrderSlotTransition[] | undefined,
  orderId: string,
  incomingLandAtMs: number,
  nowMs: number
): void {
  if (!queue || queue.length === 0) return;
  const t = queue.find((item) => item.nextOrder?.id === orderId);
  if (!t || nowMs < t.sealStartAtMs) return;

  const desiredEnterStart = incomingLandAtMs - 90;
  if (getOrderTransitionEnterStartMs(t) <= desiredEnterStart) return;

  const minExitMs = 120;
  const sealEndMs = t.sealStartAtMs + t.sealHoldMs;
  if (nowMs < sealEndMs) {
    const sealElapsed = nowMs - t.sealStartAtMs;
    const targetEnterStart = Math.max(nowMs + minExitMs, desiredEnterStart);
    const totalFromSealStart = targetEnterStart - t.sealStartAtMs;
    if (totalFromSealStart >= t.sealHoldMs + minExitMs) {
      t.exitMs = Math.min(t.exitMs, totalFromSealStart - t.sealHoldMs);
    } else {
      t.sealHoldMs = Math.max(sealElapsed, totalFromSealStart - minExitMs);
      t.exitMs = minExitMs;
    }
    return;
  }

  const exitElapsed = nowMs - sealEndMs;
  const targetExit = Math.max(minExitMs, exitElapsed + minExitMs, desiredEnterStart - sealEndMs);
  t.exitMs = Math.min(t.exitMs, targetExit);
}

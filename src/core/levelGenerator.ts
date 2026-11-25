import { ITEM_BY_ID, ITEM_CATALOG, LOOKALIKE_PAIRS, ROOM_CATALOG, ROOM_ORDER } from './catalogs';
import { hashSeed, SeededRng } from './rng';
import type {
  BoardItemInstance,
  CardboardBoxInstance,
  GeneratedLevel,
  ItemDefinition,
  LevelModifierId,
  OrderSpec,
  RoomAnchor,
  RoomThemeId,
  TimeOfDay,
} from './types';

export interface GenerateLevelOptions {
  forceTheme?: RoomThemeId;
  forceTimeOfDay?: TimeOfDay;
  forceBlackout?: boolean;
  salt?: number;
}

const REFERENCE_WIDTH = 720;
const REFERENCE_HEIGHT = 1280;

const WAVE_PROFILE = [
  { name: 'climb', deltaOrders: 1, maxLayer: 4, heavyBoxes: 1, normalBoxes: 2 },
  { name: 'dense', deltaOrders: 3, maxLayer: 4, heavyBoxes: 2, normalBoxes: 1 },
  { name: 'variant', deltaOrders: 2, maxLayer: 4, heavyBoxes: 1, normalBoxes: 2 },
  { name: 'master_peak', deltaOrders: 5, maxLayer: 5, heavyBoxes: 2, normalBoxes: 2 },
  { name: 'breather', deltaOrders: 0, maxLayer: 3, heavyBoxes: 1, normalBoxes: 1 },
] as const;

export const BOX_SPREAD_OFFSETS = [
  { dx: -0.036, dy: 0.012 },
  { dx: 0.036, dy: -0.012 },
  { dx: 0.0, dy: 0.036 },
];

export function distPx(
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = (ax - bx) * REFERENCE_WIDTH;
  const dy = (ay - by) * REFERENCE_HEIGHT;
  return Math.hypot(dx, dy);
}

/**
 * Strict total ordering key ensures blocker graph is always a DAG (acyclic).
 */
function itemOrderKey(item: BoardItemInstance): number {
  return item.layer * 10000 + item.y * 100 + item.x;
}

/**
 * Recomputes `blockedBy` for every item currently `on_board`.
 */
export function recomputeBlockers(
  items: BoardItemInstance[],
  boxes: CardboardBoxInstance[]
): void {
  const boardItems = items.filter((it) => it.state === 'on_board');
  const closedBoxes = boxes.filter((b) => !b.opened);

  for (const item of items) {
    if (item.state !== 'on_board') {
      item.blockedBy = [];
      continue;
    }

    const blockers: string[] = [];
    const itemKey = itemOrderKey(item);

    for (const other of boardItems) {
      if (other.uid === item.uid) continue;
      if (other.anchorId === item.anchorId) {
        if (other.layer > item.layer) {
          blockers.push(other.uid);
        }
        continue;
      }

      const otherKey = itemOrderKey(other);
      if (otherKey > itemKey) {
        const d = distPx(item.x, item.y, other.x, other.y);
        const overlapThreshold = (item.radius + other.radius) * 0.48;
        if (d < overlapThreshold) {
          blockers.push(other.uid);
        }
      }
    }

    for (const box of closedBoxes) {
      if (box.anchorId === item.anchorId) {
        blockers.push(box.uid);
      } else {
        const d = distPx(item.x, item.y, box.x, box.y);
        if (d < (item.radius + box.radius) * 0.54) {
          blockers.push(box.uid);
        }
      }
    }

    item.blockedBy = blockers;
  }
}

interface BoxSpec {
  itemCount: number;
  hits: number;
}

interface OrderPlan {
  orders: OrderSpec[];
  distinctCount: number;
  maxLayer: number;
  boxSpecs: BoxSpec[];
  buryJitter: number;
}

function selectItemPool(
  theme: RoomThemeId,
  count: number,
  rng: SeededRng,
  levelNumber: number
): string[] {
  const chosen = new Set<string>();
  const themeTag = theme === 'living_room' ? 'living' : theme === 'bedroom' ? 'bedroom' : 'kitchen';

  // On Lv.2+, intentionally include lookalike pairs to sharpen observation challenge
  if (levelNumber >= 2) {
    const shuffledPairs = rng.shuffle([...LOOKALIKE_PAIRS]);
    const pairTarget = Math.min(Math.floor(count / 2), 2 + Math.floor(levelNumber / 3));
    for (let i = 0; i < pairTarget && i < shuffledPairs.length; i++) {
      const [a, b] = shuffledPairs[i];
      if (chosen.size + 2 <= count) {
        chosen.add(a);
        chosen.add(b);
      }
    }
  }

  const preferred = rng.shuffle(
    ITEM_CATALOG.filter((it) => it.category === themeTag || it.category === 'general').map((it) => it.id)
  );
  const others = rng.shuffle(
    ITEM_CATALOG.filter((it) => it.category !== themeTag && it.category !== 'general').map((it) => it.id)
  );

  for (const id of [...preferred, ...others]) {
    if (chosen.size >= count) break;
    chosen.add(id);
  }

  return rng.shuffle([...chosen]).slice(0, count);
}

function buildOrderPlan(
  levelNumber: number,
  theme: RoomThemeId,
  rng: SeededRng
): OrderPlan {
  if (levelNumber === 1) {
    // Rich Lv.1: 10 orders (7x3 + 3x4 = 33 items), 8 distinct item types, 1 normal box
    const pool = selectItemPool(theme, 8, rng, 1);
    const counts = [3, 3, 4, 3, 3, 4, 3, 3, 4, 3];
    const orders: OrderSpec[] = counts.map((req, idx) => ({
      id: `ord_1_${idx}`,
      itemId: pool[idx % pool.length],
      requiredCount: req,
    }));
    return {
      orders,
      distinctCount: 8,
      maxLayer: 3,
      boxSpecs: [{ itemCount: 2, hits: 2 }],
      buryJitter: 1.4,
    };
  }

  if (levelNumber === 2) {
    // Lv.2: 14 orders (8x3 + 6x4 = 48 items), 12 distinct item types, 1 heavy 3-hit box + 2 normal boxes
    const pool = selectItemPool(theme, 12, rng, 2);
    const counts = [3, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3];
    const orders: OrderSpec[] = counts.map((req, idx) => ({
      id: `ord_2_${idx}`,
      itemId: pool[idx % pool.length],
      requiredCount: req,
    }));
    return {
      orders,
      distinctCount: 12,
      maxLayer: 4,
      boxSpecs: [
        { itemCount: 3, hits: 3 },
        { itemCount: 2, hits: 2 },
        { itemCount: 2, hits: 2 },
      ],
      buryJitter: 2.6,
    };
  }

  if (levelNumber === 3) {
    // Lv.3: 15 orders (6x3 + 9x4 = 54 items), 14 distinct types, 3 boxes (incl. 3-hit heavy box)
    const pool = selectItemPool(theme, 14, rng, 3);
    const counts = [3, 4, 3, 4, 4, 3, 4, 3, 4, 4, 3, 4, 3, 4, 4];
    const orders: OrderSpec[] = counts.map((req, idx) => ({
      id: `ord_3_${idx}`,
      itemId: pool[idx % pool.length],
      requiredCount: req,
    }));
    return {
      orders,
      distinctCount: 14,
      maxLayer: 4,
      boxSpecs: [
        { itemCount: 3, hits: 3 },
        { itemCount: 2, hits: 2 },
        { itemCount: 2, hits: 2 },
      ],
      buryJitter: 3.0,
    };
  }

  const waveIdx = (levelNumber - 4) % WAVE_PROFILE.length;
  const wave = WAVE_PROFILE[waveIdx];
  const orderCount = Math.min(23, 14 + Math.floor((levelNumber - 2) * 0.55) + wave.deltaOrders);
  const distinctCount = Math.min(26, Math.min(ITEM_CATALOG.length, 13 + Math.floor(levelNumber * 0.65)));
  const pool = selectItemPool(theme, distinctCount, rng, levelNumber);

  const orders: OrderSpec[] = [];
  let runningItems = 0;
  for (let i = 0; i < orderCount; i++) {
    const itemId = pool[i % pool.length];
    let reqCount = 3;
    if (levelNumber >= 5 && i >= 3 && i % 5 === 4 && runningItems + 5 <= 94) {
      reqCount = 5;
    } else if (i % 2 === 1 && runningItems + 4 <= 94) {
      reqCount = 4;
    }
    runningItems += reqCount;
    orders.push({
      id: `ord_${levelNumber}_${i}`,
      itemId,
      requiredCount: reqCount,
    });
  }

  const head = orders.slice(0, 2);
  const tail = rng.shuffle(orders.slice(2));
  const boxSpecs: BoxSpec[] = [];
  for (let h = 0; h < wave.heavyBoxes; h++) {
    boxSpecs.push({ itemCount: 3, hits: 3 });
  }
  for (let n = 0; n < wave.normalBoxes; n++) {
    boxSpecs.push({ itemCount: 2, hits: 2 });
  }

  return {
    orders: [...head, ...tail],
    distinctCount,
    maxLayer: wave.maxLayer,
    boxSpecs: boxSpecs.slice(0, 4),
    buryJitter: Math.min(4.5, 2.8 + levelNumber * 0.12),
  };
}

/**
 * Bounded greedy + 2-hop lookahead solver confirming the level is clearable with
 * 2 active order slots and 5 tray slots (no ads, no boosters).
 */
export function verifyLevelSolvable(level: GeneratedLevel): boolean {
  interface SimItem {
    uid: string;
    itemId: string;
    anchorId: string;
    layer: number;
    x: number;
    y: number;
    radius: number;
    state: 'on_board' | 'hidden_in_box' | 'delivered';
  }
  interface SimBox {
    uid: string;
    anchorId: string;
    x: number;
    y: number;
    radius: number;
    opened: boolean;
    containedItemUids: string[];
  }

  const items: SimItem[] = level.initialItems.map((it) => ({
    uid: it.uid,
    itemId: it.itemId,
    anchorId: it.anchorId,
    layer: it.layer,
    x: it.x,
    y: it.y,
    radius: it.radius,
    state: it.state === 'hidden_in_box' ? 'hidden_in_box' : 'on_board',
  }));
  const boxes: SimBox[] = level.initialBoxes.map((b) => ({
    uid: b.uid,
    anchorId: b.anchorId,
    x: b.x,
    y: b.y,
    radius: b.radius,
    opened: b.opened,
    containedItemUids: [...b.containedItemUids],
  }));

  let nextOrderIdx = 2;
  const activeOrders: Array<{ itemId: string; need: number } | null> = [
    level.orderQueue[0] ? { itemId: level.orderQueue[0].itemId, need: level.orderQueue[0].requiredCount } : null,
    level.orderQueue[1] ? { itemId: level.orderQueue[1].itemId, need: level.orderQueue[1].requiredCount } : null,
  ];
  const tray: string[] = [];
  const maxTray = level.baseTraySlots;

  const isBlocked = (item: SimItem): boolean => {
    if (item.state !== 'on_board') return true;
    const itemKey = item.layer * 10000 + item.y * 100 + item.x;
    for (const box of boxes) {
      if (box.opened) continue;
      if (box.anchorId === item.anchorId) return true;
      if (distPx(item.x, item.y, box.x, box.y) < (item.radius + box.radius) * 0.54) return true;
    }
    for (const other of items) {
      if (other.uid === item.uid || other.state !== 'on_board') continue;
      if (other.anchorId === item.anchorId) {
        if (other.layer > item.layer) return true;
      } else {
        const otherKey = other.layer * 10000 + other.y * 100 + other.x;
        if (otherKey > itemKey && distPx(item.x, item.y, other.x, other.y) < (item.radius + other.radius) * 0.48) {
          return true;
        }
      }
    }
    return false;
  };

  const matchSlotIndex = (itemId: string): number =>
    activeOrders.findIndex((s) => s !== null && s.itemId === itemId && s.need > 0);

  const deliverToSlot = (slotIdx: number): void => {
    const slot = activeOrders[slotIdx];
    if (!slot) return;
    slot.need -= 1;
    if (slot.need <= 0) {
      if (nextOrderIdx < level.orderQueue.length) {
        const next = level.orderQueue[nextOrderIdx++];
        activeOrders[slotIdx] = { itemId: next.itemId, need: next.requiredCount };
      } else {
        activeOrders[slotIdx] = null;
      }
    }
  };

  const drainTray = (): void => {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < tray.length; i++) {
        const idx = matchSlotIndex(tray[i]);
        if (idx !== -1) {
          tray.splice(i, 1);
          deliverToSlot(idx);
          changed = true;
          break;
        }
      }
    }
  };

  const totalStepsLimit = items.length * 4 + 30;
  for (let step = 0; step < totalStepsLimit; step++) {
    if (items.every((it) => it.state === 'delivered') && tray.length === 0) {
      return true;
    }

    const closedBox = boxes.find((b) => !b.opened);
    if (closedBox) {
      closedBox.opened = true;
      let maxLayer = 0;
      for (const it of items) {
        if (it.state === 'on_board' && it.anchorId === closedBox.anchorId) {
          maxLayer = Math.max(maxLayer, it.layer + 1);
        }
      }
      closedBox.containedItemUids.forEach((uid, idx) => {
        const it = items.find((x) => x.uid === uid);
        if (it) {
          const off = BOX_SPREAD_OFFSETS[idx % BOX_SPREAD_OFFSETS.length];
          it.state = 'on_board';
          it.anchorId = closedBox.anchorId;
          it.layer = maxLayer + idx;
          it.x = Math.min(0.91, Math.max(0.09, closedBox.x + off.dx));
          it.y = Math.min(0.76, Math.max(0.40, closedBox.y + off.dy));
        }
      });
      continue;
    }

    const unblocked = items.filter((it) => it.state === 'on_board' && !isBlocked(it));
    const directMatch = unblocked.find((it) => matchSlotIndex(it.itemId) !== -1);
    if (directMatch) {
      directMatch.state = 'delivered';
      deliverToSlot(matchSlotIndex(directMatch.itemId));
      drainTray();
      continue;
    }

    if (tray.length >= maxTray || unblocked.length === 0) {
      return false;
    }

    const nextOrderIds = new Set(
      level.orderQueue.slice(nextOrderIdx, nextOrderIdx + 3).map((o) => o.itemId)
    );
    const activeIds = new Set(
      activeOrders.filter((o): o is { itemId: string; need: number } => o !== null).map((o) => o.itemId)
    );

    let bestItem = unblocked[0];
    let bestScore = -9999;

    for (const cand of unblocked) {
      let score = 0;
      cand.state = 'delivered';
      const newlyUnblocked = items.filter(
        (it) => it.state === 'on_board' && !isBlocked(it) && !unblocked.some((u) => u.uid === it.uid)
      );

      for (const rev of newlyUnblocked) {
        if (activeIds.has(rev.itemId)) score += 240;
        else if (nextOrderIds.has(rev.itemId)) score += 60;
        else score += 12;

        // 2-hop lookahead: check if removing rev would expose an active item!
        rev.state = 'delivered';
        const hop2 = items.some(
          (it) =>
            it.state === 'on_board' &&
            activeIds.has(it.itemId) &&
            !isBlocked(it) &&
            !unblocked.some((u) => u.uid === it.uid) &&
            !newlyUnblocked.some((u) => u.uid === it.uid)
        );
        rev.state = 'on_board';
        if (hop2) score += 95;
      }
      cand.state = 'on_board';

      // Prefer picking items underneath whose anchor also contains an active target
      const sharesAnchorWithActive = items.some(
        (it) => it.state === 'on_board' && it.anchorId === cand.anchorId && it.layer < cand.layer && activeIds.has(it.itemId)
      );
      if (sharesAnchorWithActive) score += 80;
      if (nextOrderIds.has(cand.itemId)) score += 42;

      if (score > bestScore) {
        bestScore = score;
        bestItem = cand;
      }
    }

    bestItem.state = 'delivered';
    tray.push(bestItem.itemId);
    drainTray();
  }

  return items.every((it) => it.state === 'delivered') && tray.length === 0;
}

export function generateLevel(
  levelNumber: number,
  options: GenerateLevelOptions = {}
): GeneratedLevel {
  const safeLevel = Math.max(1, Math.floor(levelNumber));
  const themeIndex = (safeLevel - 1) % ROOM_ORDER.length;
  const loopIndex = Math.floor((safeLevel - 1) / ROOM_ORDER.length);
  const theme: RoomThemeId = options.forceTheme ?? ROOM_ORDER[themeIndex];
  const room = ROOM_CATALOG[theme];

  const times: TimeOfDay[] = ['morning', 'sunset', 'night'];
  const defaultTime: TimeOfDay =
    safeLevel === 3 ? 'night' : times[loopIndex % times.length];
  const timeOfDay: TimeOfDay = options.forceTimeOfDay ?? defaultTime;

  const isVariantWave = safeLevel >= 4 && (safeLevel - 4) % WAVE_PROFILE.length === 2;
  const blackout =
    options.forceBlackout ?? (safeLevel === 3 || (isVariantWave && loopIndex % 2 === 0));
  const modifiers: LevelModifierId[] = blackout ? ['blackout_flashlight'] : ['none'];

  const baseSeed = hashSeed(safeLevel, options.salt ?? 0);

  for (let attempt = 0; attempt < 20; attempt++) {
    const attemptSeed = hashSeed(safeLevel, (options.salt ?? 0) + attempt * 131);
    const rng = new SeededRng(attemptSeed);
    const plan = buildOrderPlan(safeLevel, theme, rng);

    const effectiveJitter =
      attempt < 10 ? plan.buryJitter : attempt < 16 ? plan.buryJitter * 0.45 : 0.25;

    interface DealToken {
      itemId: string;
      orderIndex: number;
      dealScore: number;
    }
    const tokens: DealToken[] = [];
    plan.orders.forEach((order, orderIndex) => {
      for (let c = 0; c < order.requiredCount; c++) {
        tokens.push({
          itemId: order.itemId,
          orderIndex,
          dealScore: orderIndex + rng.float(-effectiveJitter, effectiveJitter),
        });
      }
    });

    const minBoxOrderIdx = safeLevel === 1 ? 2 : 1;
    const boxCandidateIndices: number[] = [];
    tokens.forEach((t, idx) => {
      if (t.orderIndex >= minBoxOrderIdx) boxCandidateIndices.push(idx);
    });
    rng.shuffle(boxCandidateIndices);

    const reservedForBox = new Set<number>();
    const boxItemBuckets: Array<{ spec: BoxSpec; items: DealToken[] }> = [];
    for (const spec of plan.boxSpecs) {
      const bucket: DealToken[] = [];
      for (let k = 0; k < spec.itemCount && boxCandidateIndices.length > 0; k++) {
        const tokIdx = boxCandidateIndices.pop()!;
        reservedForBox.add(tokIdx);
        bucket.push(tokens[tokIdx]);
      }
      if (bucket.length > 0) {
        boxItemBuckets.push({ spec, items: bucket });
      }
    }

    const boardTokens = tokens.filter((_, idx) => !reservedForBox.has(idx));
    // Descending by semi-buried score: late & jittered tokens sink into deep layers, burying parts of early orders
    boardTokens.sort((a, b) => b.dealScore - a.dealScore);

    const anchors = rng.shuffle([...room.anchors]);
    const anchorDepth = new Map<string, number>();
    anchors.forEach((a) => anchorDepth.set(a.id, 0));

    const boxAnchors = new Set<string>();
    const boxes: CardboardBoxInstance[] = [];
    const usableBoxAnchors = anchors.filter((a) => a.y >= 0.48 && a.y <= 0.73);
    for (let b = 0; b < boxItemBuckets.length; b++) {
      const { spec } = boxItemBuckets[b];
      const anchor = usableBoxAnchors.find(
        (cand) =>
          !boxAnchors.has(cand.id) &&
          boxes.every((existing) => distPx(cand.x, cand.y, existing.x, existing.y) > 125)
      ) ?? anchors[b];
      boxAnchors.add(anchor.id);
      boxes.push({
        uid: `box_${safeLevel}_${b}`,
        anchorId: anchor.id,
        x: anchor.x,
        y: anchor.y,
        scale: anchor.scale * (spec.hits >= 3 ? 1.12 : 1.04),
        radius: (spec.hits >= 3 ? 52 : 47) * anchor.scale,
        hitsLeft: spec.hits,
        maxHits: spec.hits,
        opened: false,
        containedItemUids: [],
      });
    }

    const items: BoardItemInstance[] = [];
    const placementAnchors = anchors.filter((a) => !boxAnchors.has(a.id));
    let itemUidCounter = 0;

    let cursor = 0;
    const totalBoard = boardTokens.length;
    const minNeededAnchors = Math.min(
      placementAnchors.length,
      Math.max(12, Math.ceil(totalBoard / Math.max(1, plan.maxLayer - 0.25)))
    );
    const activeAnchorPool = [...placementAnchors.slice(0, minNeededAnchors)];
    let poolCap = activeAnchorPool.reduce((sum, a) => sum + a.capacity, 0);
    for (let idx = minNeededAnchors; idx < placementAnchors.length && poolCap < totalBoard; idx++) {
      activeAnchorPool.push(placementAnchors[idx]);
      poolCap += placementAnchors[idx].capacity;
    }

    let maxObservedLayer = 0;

    for (let layer = 0; layer < plan.maxLayer + 5 && cursor < totalBoard; layer++) {
      const layerAnchors = rng.shuffle([...activeAnchorPool]);
      for (const anchor of layerAnchors) {
        if (cursor >= totalBoard) break;
        const curDepth = anchorDepth.get(anchor.id) ?? 0;
        if (curDepth !== layer) continue;
        if (curDepth >= anchor.capacity && poolCap >= totalBoard) continue;

        const tok = boardTokens[cursor++];
        const def: ItemDefinition = ITEM_BY_ID[tok.itemId];
        const jitterX = layer === 0 ? rng.float(-0.014, 0.014) : rng.float(-0.022, 0.022);
        const jitterY = layer === 0 ? rng.float(-0.01, 0.01) : rng.float(-0.015, 0.015);
        const uid = `item_${safeLevel}_${itemUidCounter++}`;
        maxObservedLayer = Math.max(maxObservedLayer, layer);
        items.push({
          uid,
          itemId: tok.itemId,
          anchorId: anchor.id,
          layer,
          x: Math.min(0.91, Math.max(0.09, anchor.x + jitterX)),
          y: Math.min(0.76, Math.max(0.40, anchor.y + jitterY - layer * 0.009)),
          rotation: rng.float(-18, 18),
          scale: anchor.scale,
          radius: def.radius * anchor.scale,
          state: 'on_board',
          hiddenByBoxId: null,
          blockedBy: [],
        });
        anchorDepth.set(anchor.id, curDepth + 1);
      }
    }

    while (cursor < totalBoard) {
      const anchor = [...placementAnchors].sort(
        (a, b) => (anchorDepth.get(a.id) ?? 0) - (anchorDepth.get(b.id) ?? 0)
      )[0];
      const layer = anchorDepth.get(anchor.id) ?? 0;
      const tok = boardTokens[cursor++];
      const def: ItemDefinition = ITEM_BY_ID[tok.itemId];
      const uid = `item_${safeLevel}_${itemUidCounter++}`;
      maxObservedLayer = Math.max(maxObservedLayer, layer);
      items.push({
        uid,
        itemId: tok.itemId,
        anchorId: anchor.id,
        layer,
        x: Math.min(0.91, Math.max(0.09, anchor.x + rng.float(-0.02, 0.02))),
        y: Math.min(0.76, Math.max(0.40, anchor.y + rng.float(-0.012, 0.012) - layer * 0.009)),
        rotation: rng.float(-18, 18),
        scale: anchor.scale,
        radius: def.radius * anchor.scale,
        state: 'on_board',
        hiddenByBoxId: null,
        blockedBy: [],
      });
      anchorDepth.set(anchor.id, layer + 1);
    }

    boxes.forEach((box, boxIdx) => {
      const bucket = boxItemBuckets[boxIdx]?.items ?? [];
      bucket.forEach((tok) => {
        const def = ITEM_BY_ID[tok.itemId];
        const uid = `item_${safeLevel}_${itemUidCounter++}`;
        box.containedItemUids.push(uid);
        items.push({
          uid,
          itemId: tok.itemId,
          anchorId: box.anchorId,
          layer: 0,
          x: box.x,
          y: box.y,
          rotation: rng.float(-12, 12),
          scale: box.scale,
          radius: def.radius * box.scale,
          state: 'hidden_in_box',
          hiddenByBoxId: box.uid,
          blockedBy: [],
        });
      });
    });

    recomputeBlockers(items, boxes);

    const timeMeta = room.paletteTint[timeOfDay];
    const hostOpening = room.host.openings[(safeLevel - 1) % room.host.openings.length];
    const hostVictory = room.host.victories[(safeLevel - 1) % room.host.victories.length];
    const tutorialHint =
      safeLevel === 1
        ? '点击发光目标直飞订单箱！压住它的杂物先入槽，记得拆开快递箱'
        : safeLevel === 2
          ? '挑战升级：48件深堆 + 3击加固大箱！调皮橘猫每天可免费撸或闯关领猫条'
          : blackout
            ? '停电深堆挑战！滑动屏幕用暖光手电筒探照，注意相似物品分辨'
            : null;

    const distinctItemTypes = new Set(items.map((it) => it.itemId)).size;

    const generated: GeneratedLevel = {
      levelNumber: safeLevel,
      loopIndex,
      seed: baseSeed,
      theme,
      timeOfDay,
      modifiers,
      hostTitle: `${room.host.role} · ${timeMeta.label}`,
      hostOpening,
      hostVictory,
      tutorialHint,
      totalItems: items.length,
      distinctItemTypes,
      maxStackDepth: maxObservedLayer + 1,
      orderQueue: plan.orders,
      initialItems: items,
      initialBoxes: boxes,
      petEnabled: safeLevel >= 2,
      petCooldownSec: safeLevel === 2 ? 18 : Math.max(15, 22 - Math.floor(safeLevel / 4)),
      baseTraySlots: 5,
      maxTraySlots: 7,
    };

    if (verifyLevelSolvable(generated) || attempt === 19) {
      return generated;
    }
  }

  throw new Error(`Failed to generate level ${safeLevel}`);
}

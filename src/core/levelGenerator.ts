import { getItemSprite, getItemSpritePool, ITEM_BY_ID, ITEM_CATALOG, LOOKALIKE_PAIRS, ROOM_CATALOG, ROOM_ORDER } from './catalogs';
import { hashSeed, SeededRng } from './rng';
import type {
  BoardItemInstance,
  CardboardBoxInstance,
  GeneratedLevel,
  ItemDefinition,
  ItemPose,
  LevelModifierId,
  OrderSpec,
  RoomAnchor,
  RoomThemeId,
  TimeOfDay,
} from './types';
import { computeAspectDimensions } from './visualDepth';

export interface GenerateLevelOptions {
  forceTheme?: RoomThemeId;
  forceTimeOfDay?: TimeOfDay;
  forceBlackout?: boolean;
  salt?: number;
}

const REFERENCE_WIDTH = 720;
const REFERENCE_HEIGHT = 1280;

export const REF_ITEM_BASE_SIZE = 108;
export const REF_BOX_BASE_SIZE = 114;
const LAYER_LIFT_REF_STEP = 4.5;
const ITEM_OVERLAP_RATIO = 0.78;
const ITEM_OVERLAP_AREA_RATIO = 0.16;
const BOX_OVERLAP_RATIO = 0.8;
const BOX_OVERLAP_AREA_RATIO = 0.14;

const WAVE_PROFILE = [
  { name: 'climb', deltaOrders: 2, maxLayer: 5, heavyBoxes: 1, normalBoxes: 2 },
  { name: 'dense', deltaOrders: 5, maxLayer: 6, heavyBoxes: 2, normalBoxes: 2 },
  { name: 'variant', deltaOrders: 4, maxLayer: 6, heavyBoxes: 2, normalBoxes: 2 },
  { name: 'master_peak', deltaOrders: 7, maxLayer: 7, heavyBoxes: 2, normalBoxes: 2 },
  { name: 'breather', deltaOrders: 1, maxLayer: 5, heavyBoxes: 1, normalBoxes: 2 },
] as const;

const THEME_CATEGORY: Record<RoomThemeId, ItemDefinition['category']> = {
  living_room: 'living',
  bathroom: 'bathroom',
  study: 'study',
  cafe: 'cafe',
  kitchen: 'kitchen',
  bedroom: 'bedroom',
};

const COHESIVE_FALLBACK_ORDER: Record<RoomThemeId, ItemDefinition['category'][]> = {
  living_room: ['general', 'study', 'bedroom', 'cafe', 'kitchen', 'bathroom'],
  bathroom: ['general', 'bedroom', 'living', 'study', 'cafe', 'kitchen'],
  study: ['general', 'living', 'bedroom', 'cafe', 'bathroom', 'kitchen'],
  cafe: ['kitchen', 'general', 'living', 'bedroom', 'study', 'bathroom'],
  kitchen: ['cafe', 'general', 'living', 'study', 'bedroom', 'bathroom'],
  bedroom: ['general', 'living', 'study', 'bathroom', 'cafe', 'kitchen'],
};

export const BOX_SPREAD_OFFSETS = [
  { dx: -0.046, dy: 0.015 },
  { dx: 0.046, dy: -0.015 },
  { dx: 0.0, dy: 0.044 },
];

function normalizeAnchorScale(rawScale: number): number {
  const t = Math.min(1, Math.max(0, (rawScale - 0.76) / 0.26));
  return Number((0.88 + t * 0.16).toFixed(3));
}

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
 * Strict total ordering key ensures draw order and blocker DAG are identical.
 */
export function compareBoardItemOrder(
  a: Pick<BoardItemInstance, 'layer' | 'y' | 'x' | 'uid'>,
  b: Pick<BoardItemInstance, 'layer' | 'y' | 'x' | 'uid'>
): number {
  if (a.layer !== b.layer) return a.layer - b.layer;
  if (a.y !== b.y) return a.y - b.y;
  if (a.x !== b.x) return a.x - b.x;
  return a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0;
}

export function getItemHalfExtentsRef(
  item: Pick<BoardItemInstance, 'itemId' | 'scale' | 'layer' | 'aspectRatio'> & { rotation?: number }
): { rx: number; ry: number } {
  const visualScale = ITEM_BY_ID[item.itemId]?.visualScale ?? 1;
  const layerScale = 0.95 + Math.min(1, Math.max(0, item.layer) / 4) * 0.14;
  const aspect = item.aspectRatio ?? ITEM_BY_ID[item.itemId]?.aspectRatio ?? 1;
  const { width, height } = computeAspectDimensions(
    REF_ITEM_BASE_SIZE * item.scale * visualScale * layerScale,
    aspect
  );
  const rad = ((item.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const rotW = width * cos + height * sin;
  const rotH = width * sin + height * cos;
  return { rx: rotW * 0.42, ry: rotH * 0.42 };
}

export function getItemVisualRadiusRef(
  item: Pick<BoardItemInstance, 'itemId' | 'scale' | 'layer'>
): number {
  const visualScale = ITEM_BY_ID[item.itemId]?.visualScale ?? 1;
  const layerScale = 0.95 + Math.min(1, Math.max(0, item.layer) / 4) * 0.14;
  return REF_ITEM_BASE_SIZE * item.scale * visualScale * layerScale * 0.42;
}

export function getBoxVisualRadiusRef(
  box: Pick<CardboardBoxInstance, 'scale'>
): number {
  return REF_BOX_BASE_SIZE * box.scale * 0.44;
}

const MAX_OVERLAP_DX_NORM = 0.28;
const MAX_OVERLAP_DY_NORM = 0.2;

function visualDistSqPx(
  ax: number,
  ay: number,
  aLayer: number,
  bx: number,
  by: number,
  bLayer: number
): number {
  const dx = (ax - bx) * REFERENCE_WIDTH;
  const dy = (ay - by) * REFERENCE_HEIGHT - (aLayer - bLayer) * LAYER_LIFT_REF_STEP;
  return dx * dx + dy * dy;
}

function doesItemBlockItemWithExtents(
  lower: Pick<BoardItemInstance, 'uid' | 'anchorId' | 'layer' | 'x' | 'y'>,
  upper: Pick<BoardItemInstance, 'uid' | 'anchorId' | 'layer' | 'x' | 'y'>,
  lowerExt: { rx: number; ry: number },
  upperExt: { rx: number; ry: number }
): boolean {
  if (lower.uid === upper.uid) return false;
  if (upper.anchorId === lower.anchorId) {
    return upper.layer > lower.layer;
  }
  if (compareBoardItemOrder(upper, lower) <= 0) return false;
  if (
    Math.abs(lower.x - upper.x) > MAX_OVERLAP_DX_NORM ||
    Math.abs(lower.y - upper.y) > MAX_OVERLAP_DY_NORM
  ) {
    return false;
  }
  const dx = (lower.x - upper.x) * REFERENCE_WIDTH;
  const dy = (lower.y - upper.y) * REFERENCE_HEIGHT - (lower.layer - upper.layer) * LAYER_LIFT_REF_STEP;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // 1) Coverage ratio: catches small lower items partially buried under the edge of a large/rotated upper item
  const overlapW = lowerExt.rx + upperExt.rx - absDx;
  const overlapH = lowerExt.ry + upperExt.ry - absDy;
  if (overlapW > 0 && overlapH > 0) {
    const lowerArea = Math.max(1, 4 * lowerExt.rx * lowerExt.ry);
    if ((overlapW * overlapH) / lowerArea >= ITEM_OVERLAP_AREA_RATIO) {
      return true;
    }
  }

  // 2) Center-proximity ellipse: catches overlapping same-size silhouettes cleanly
  const rxThr = Math.max(24, (lowerExt.rx + upperExt.rx) * ITEM_OVERLAP_RATIO);
  const ryThr = Math.max(24, (lowerExt.ry + upperExt.ry) * ITEM_OVERLAP_RATIO);
  const nx = dx / rxThr;
  const ny = dy / ryThr;
  return nx * nx + ny * ny < 1;
}

export function doesItemBlockItem(
  lower: Pick<BoardItemInstance, 'uid' | 'itemId' | 'anchorId' | 'layer' | 'x' | 'y' | 'scale' | 'aspectRatio'> & {
    rotation?: number;
  },
  upper: Pick<BoardItemInstance, 'uid' | 'itemId' | 'anchorId' | 'layer' | 'x' | 'y' | 'scale' | 'aspectRatio'> & {
    rotation?: number;
  }
): boolean {
  if (lower.uid === upper.uid) return false;
  if (upper.anchorId === lower.anchorId) {
    return upper.layer > lower.layer;
  }
  if (compareBoardItemOrder(upper, lower) <= 0) return false;
  if (
    Math.abs(lower.x - upper.x) > MAX_OVERLAP_DX_NORM ||
    Math.abs(lower.y - upper.y) > MAX_OVERLAP_DY_NORM
  ) {
    return false;
  }
  return doesItemBlockItemWithExtents(
    lower,
    upper,
    getItemHalfExtentsRef(lower),
    getItemHalfExtentsRef(upper)
  );
}

function doesBoxBlockItemWithExtent(
  item: Pick<BoardItemInstance, 'anchorId' | 'layer' | 'x' | 'y'>,
  itemExt: { rx: number; ry: number },
  box: Pick<CardboardBoxInstance, 'anchorId' | 'x' | 'y'>,
  boxR: number
): boolean {
  if (box.anchorId === item.anchorId) return true;
  if (
    Math.abs(item.x - box.x) > MAX_OVERLAP_DX_NORM * 1.2 ||
    Math.abs(item.y - box.y) > MAX_OVERLAP_DY_NORM * 1.2
  ) {
    return false;
  }
  const dx = (item.x - box.x) * REFERENCE_WIDTH;
  const dy = (item.y - box.y) * REFERENCE_HEIGHT - item.layer * LAYER_LIFT_REF_STEP;
  const overlapW = itemExt.rx + boxR - Math.abs(dx);
  const overlapH = itemExt.ry + boxR - Math.abs(dy);
  if (overlapW > 0 && overlapH > 0) {
    const itemArea = Math.max(1, 4 * itemExt.rx * itemExt.ry);
    if ((overlapW * overlapH) / itemArea >= BOX_OVERLAP_AREA_RATIO) {
      return true;
    }
  }
  const rxThr = (itemExt.rx + boxR) * BOX_OVERLAP_RATIO;
  const ryThr = (itemExt.ry + boxR) * BOX_OVERLAP_RATIO;
  const nx = dx / rxThr;
  const ny = dy / ryThr;
  return nx * nx + ny * ny < 1;
}

export function doesBoxBlockItem(
  item: Pick<BoardItemInstance, 'itemId' | 'anchorId' | 'layer' | 'x' | 'y' | 'scale' | 'aspectRatio'> & {
    rotation?: number;
  },
  box: Pick<CardboardBoxInstance, 'anchorId' | 'x' | 'y' | 'scale'>
): boolean {
  if (box.anchorId === item.anchorId) return true;
  if (
    Math.abs(item.x - box.x) > MAX_OVERLAP_DX_NORM * 1.2 ||
    Math.abs(item.y - box.y) > MAX_OVERLAP_DY_NORM * 1.2
  ) {
    return false;
  }
  return doesBoxBlockItemWithExtent(item, getItemHalfExtentsRef(item), box, getBoxVisualRadiusRef(box));
}

/**
 * Recomputes `blockedBy` for every item currently `on_board`.
 */
export function recomputeBlockers(
  items: BoardItemInstance[],
  boxes: CardboardBoxInstance[]
): void {
  const boardItems = items.filter((it) => it.state === 'on_board');
  const boardExtents = boardItems.map((it) => getItemHalfExtentsRef(it));
  const closedBoxes = boxes.filter((b) => !b.opened);
  const boxRadii = closedBoxes.map((b) => getBoxVisualRadiusRef(b));

  for (const item of items) {
    if (item.state !== 'on_board') {
      item.blockedBy = [];
    }
  }

  for (let i = 0; i < boardItems.length; i++) {
    const item = boardItems[i];
    const itemExt = boardExtents[i];
    const blockers: string[] = [];

    for (let j = 0; j < boardItems.length; j++) {
      if (i === j) continue;
      if (doesItemBlockItemWithExtents(item, boardItems[j], itemExt, boardExtents[j])) {
        blockers.push(boardItems[j].uid);
      }
    }

    for (let b = 0; b < closedBoxes.length; b++) {
      if (doesBoxBlockItemWithExtent(item, itemExt, closedBoxes[b], boxRadii[b])) {
        blockers.push(closedBoxes[b].uid);
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

const LIVING_HERO_CAST = [
  'sweater',
  'ukulele',
  'handbag',
  'book',
  'thermos',
  'keychain',
  'sunglasses',
  'cat_can',
  'towel_roll',
] as const;

function selectItemPool(
  theme: RoomThemeId,
  count: number,
  rng: SeededRng,
  levelNumber: number
): string[] {
  const chosen = new Set<string>();
  const themeTag = THEME_CATEGORY[theme];
  const loopIndex = Math.floor((levelNumber - 1) / ROOM_ORDER.length);

  // For Living Room levels, prioritize everyday clutter hero props so sofa drapes,
  // leaning guitars, open books, and corner-tucked cans/keys appear naturally.
  if (theme === 'living_room') {
    const heroSlice = loopIndex === 0 ? LIVING_HERO_CAST.slice(0, 7) : LIVING_HERO_CAST;
    for (const id of heroSlice) {
      if (chosen.size >= count) break;
      if (ITEM_BY_ID[id]) chosen.add(id);
    }
  }

  // 1. Prioritize room-exclusive items first so every room theme has a distinct visual cast
  const roomPrimaryRaw = rng.shuffle(
    ITEM_CATALOG.filter((it) => it.category === themeTag).map((it) => it.id)
  );
  const rotateOffset = roomPrimaryRaw.length > 0 ? (loopIndex * 3) % roomPrimaryRaw.length : 0;
  const roomPrimary = [
    ...roomPrimaryRaw.slice(rotateOffset),
    ...roomPrimaryRaw.slice(0, rotateOffset),
  ];

  // 2. On Lv.2+, weave in lookalike pairs to boost sorting challenge (keep Lv.2 intra-theme for high theme purity)
  if (levelNumber >= 2) {
    const roomPairs = LOOKALIKE_PAIRS.filter(([a, b]) => {
      const ca = ITEM_BY_ID[a]?.category;
      const cb = ITEM_BY_ID[b]?.category;
      return levelNumber === 2 ? ca === themeTag && cb === themeTag : ca === themeTag || cb === themeTag;
    });
    const shuffledPairs = rng.shuffle([...roomPairs]);
    const pairTarget = levelNumber === 2 ? 2 : Math.min(5, Math.floor(count / 3));
    for (let i = 0; i < pairTarget && i < shuffledPairs.length; i++) {
      const [a, b] = shuffledPairs[i];
      if (chosen.size + 2 <= count) {
        chosen.add(a);
        chosen.add(b);
      }
    }
  }

  for (const id of roomPrimary) {
    if (chosen.size >= count) break;
    chosen.add(id);
  }

  // 3. Top up with cohesive secondary categories only if count exceeds room's exclusive pool
  const fallbackOrder = COHESIVE_FALLBACK_ORDER[theme];
  for (const cat of fallbackOrder) {
    if (chosen.size >= count) break;
    const batch = rng.shuffle(
      ITEM_CATALOG.filter((it) => it.category === cat).map((it) => it.id)
    );
    for (const id of batch) {
      if (chosen.size >= count) break;
      chosen.add(id);
    }
  }

  return rng.shuffle([...chosen]).slice(0, count);
}

function buildOrderPlan(
  levelNumber: number,
  theme: RoomThemeId,
  rng: SeededRng
): OrderPlan {
  if (levelNumber === 1) {
    // Gentle Lv.1: 14 orders (52 items), 10 distinct living-room items, shallow stacks, 1 normal box
    const pool = selectItemPool(theme, 10, rng, 1);
    const counts = [3, 4, 4, 3, 4, 4, 4, 3, 4, 4, 4, 3, 4, 4];
    const orders: OrderSpec[] = counts.map((req, idx) => ({
      id: `ord_1_${idx}`,
      itemId: pool[idx % pool.length],
      requiredCount: req,
    }));
    return {
      orders,
      distinctCount: 10,
      maxLayer: 3,
      boxSpecs: [{ itemCount: 2, hits: 2 }],
      buryJitter: 1.8,
    };
  }

  if (levelNumber === 2) {
    // Lv.2 (Bathroom): 24 orders (96 items), all 13 bathroom items, 5 layers, 1 heavy 3-hit + 2 normal boxes
    const pool = selectItemPool(theme, 13, rng, 2);
    const counts = [3, 4, 4, 5, 4, 4, 3, 4, 5, 4, 4, 4, 3, 4, 5, 4, 4, 4, 3, 4, 5, 4, 4, 4];
    const orders: OrderSpec[] = counts.map((req, idx) => ({
      id: `ord_2_${idx}`,
      itemId: pool[idx % pool.length],
      requiredCount: req,
    }));
    return {
      orders,
      distinctCount: 13,
      maxLayer: 5,
      boxSpecs: [
        { itemCount: 3, hits: 3 },
        { itemCount: 3, hits: 2 },
        { itemCount: 3, hits: 2 },
      ],
      buryJitter: 4.0,
    };
  }

  if (levelNumber === 3) {
    // Lv.3 (Forest Study): 27 orders (112 items), 18 distinct study items, 6 layers, 3 boxes
    const pool = selectItemPool(theme, 18, rng, 3);
    const counts = [4, 4, 4, 5, 4, 4, 4, 4, 5, 3, 4, 4, 5, 4, 4, 4, 4, 5, 3, 4, 4, 5, 4, 4, 4, 4, 4];
    const orders: OrderSpec[] = counts.map((req, idx) => ({
      id: `ord_3_${idx}`,
      itemId: pool[idx % pool.length],
      requiredCount: req,
    }));
    return {
      orders,
      distinctCount: 18,
      maxLayer: 6,
      boxSpecs: [
        { itemCount: 3, hits: 3 },
        { itemCount: 3, hits: 2 },
        { itemCount: 3, hits: 2 },
      ],
      buryJitter: 4.5,
    };
  }

  const waveIdx = (levelNumber - 4) % WAVE_PROFILE.length;
  const wave = WAVE_PROFILE[waveIdx];
  const orderCount = Math.min(40, 26 + Math.floor((levelNumber - 3) * 0.75) + wave.deltaOrders);
  const distinctCount = Math.min(36, Math.min(ITEM_CATALOG.length, 18 + Math.floor(levelNumber * 0.85)));
  const pool = selectItemPool(theme, distinctCount, rng, levelNumber);

  const orders: OrderSpec[] = [];
  let runningItems = 0;
  for (let i = 0; i < orderCount; i++) {
    const itemId = pool[i % pool.length];
    let reqCount = 3;
    if (levelNumber >= 4 && i >= 2 && i % 3 === 2 && runningItems + 5 <= 176) {
      reqCount = 5;
    } else if (runningItems + 4 <= 176) {
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
    boxSpecs.push({ itemCount: 3, hits: 2 });
  }

  return {
    orders: [...head, ...tail],
    distinctCount,
    maxLayer: wave.maxLayer,
    boxSpecs: boxSpecs.slice(0, 4),
    buryJitter: Math.min(6.2, 4.0 + levelNumber * 0.16),
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
    rotation: number;
    scale: number;
    aspectRatio?: number;
    radius: number;
    state: 'on_board' | 'hidden_in_box' | 'delivered';
  }
  interface SimBox {
    uid: string;
    anchorId: string;
    x: number;
    y: number;
    scale: number;
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
    rotation: it.rotation,
    scale: it.scale,
    aspectRatio: it.aspectRatio,
    radius: it.radius,
    state: it.state === 'hidden_in_box' ? 'hidden_in_box' : 'on_board',
  }));
  const boxes: SimBox[] = level.initialBoxes.map((b) => ({
    uid: b.uid,
    anchorId: b.anchorId,
    x: b.x,
    y: b.y,
    scale: b.scale,
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
  const n = items.length;
  let blockersBuilt = false;
  const blockersOf: number[][] = Array.from({ length: n }, () => []);
  const dependentsOf: number[][] = Array.from({ length: n }, () => []);
  const anchorBelowByAnchor = new Map<string, number[]>();

  const buildStaticGraph = (): void => {
    blockersBuilt = true;
    const extents = items.map((it) => getItemHalfExtentsRef(it));
    for (let a = 0; a < n; a++) {
      const itA = items[a];
      const extA = extents[a];
      for (let b = 0; b < n; b++) {
        if (a === b) continue;
        const itB = items[b];
        if (doesItemBlockItemWithExtents(itA, itB, extA, extents[b])) {
          blockersOf[a].push(b);
          dependentsOf[b].push(a);
        }
      }
      if (!anchorBelowByAnchor.has(itA.anchorId)) anchorBelowByAnchor.set(itA.anchorId, []);
      anchorBelowByAnchor.get(itA.anchorId)!.push(a);
    }
  };

  const isBlockedIdx = (idx: number): boolean => {
    if (items[idx].state !== 'on_board') return true;
    const list = blockersOf[idx];
    for (let k = 0; k < list.length; k++) {
      if (items[list[k]].state === 'on_board') return true;
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
    let remainingOnBoardOrBox = false;
    for (let i = 0; i < n; i++) {
      if (items[i].state !== 'delivered') {
        remainingOnBoardOrBox = true;
        break;
      }
    }
    if (!remainingOnBoardOrBox && tray.length === 0) {
      return true;
    }

    const closedBox = boxes.find((b) => !b.opened);
    if (closedBox) {
      closedBox.opened = true;
      let maxLayer = 0;
      for (const it of items) {
        if (
          it.state === 'on_board' &&
          (it.anchorId === closedBox.anchorId || distPx(it.x, it.y, closedBox.x, closedBox.y) < 100)
        ) {
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

    if (!blockersBuilt) {
      buildStaticGraph();
    }

    const unblockedIndices: number[] = [];
    for (let i = 0; i < n; i++) {
      if (!isBlockedIdx(i)) unblockedIndices.push(i);
    }

    let directIdx = -1;
    for (let k = 0; k < unblockedIndices.length; k++) {
      const i = unblockedIndices[k];
      if (matchSlotIndex(items[i].itemId) !== -1) {
        directIdx = i;
        break;
      }
    }
    if (directIdx !== -1) {
      const directMatch = items[directIdx];
      directMatch.state = 'delivered';
      deliverToSlot(matchSlotIndex(directMatch.itemId));
      drainTray();
      continue;
    }

    if (tray.length >= maxTray || unblockedIndices.length === 0) {
      return false;
    }

    const nextOrderIds = new Set(
      level.orderQueue.slice(nextOrderIdx, nextOrderIdx + 3).map((o) => o.itemId)
    );
    const activeIds = new Set(
      activeOrders.filter((o): o is { itemId: string; need: number } => o !== null).map((o) => o.itemId)
    );

    let bestIdx = unblockedIndices[0];
    let bestScore = -9999;

    for (let k = 0; k < unblockedIndices.length; k++) {
      const candIdx = unblockedIndices[k];
      const cand = items[candIdx];
      let score = 0;
      cand.state = 'delivered';
      const deps = dependentsOf[candIdx];

      for (let d = 0; d < deps.length; d++) {
        const revIdx = deps[d];
        const rev = items[revIdx];
        if (isBlockedIdx(revIdx)) continue;
        if (activeIds.has(rev.itemId)) score += 240;
        else if (nextOrderIds.has(rev.itemId)) score += 60;
        else score += 12;

        // 2-hop lookahead: check if removing rev would expose an active item!
        rev.state = 'delivered';
        const deps2 = dependentsOf[revIdx];
        let hop2 = false;
        for (let d2 = 0; d2 < deps2.length; d2++) {
          const hopIdx = deps2[d2];
          if (activeIds.has(items[hopIdx].itemId) && !isBlockedIdx(hopIdx)) {
            hop2 = true;
            break;
          }
        }
        rev.state = 'on_board';
        if (hop2) score += 95;
      }
      cand.state = 'on_board';

      // Prefer picking items underneath whose anchor also contains an active target
      const anchorList = anchorBelowByAnchor.get(cand.anchorId) ?? [];
      let sharesAnchorWithActive = false;
      for (let a = 0; a < anchorList.length; a++) {
        const it = items[anchorList[a]];
        if (it.state === 'on_board' && it.layer < cand.layer && activeIds.has(it.itemId)) {
          sharesAnchorWithActive = true;
          break;
        }
      }
      if (sharesAnchorWithActive) score += 80;
      if (nextOrderIds.has(cand.itemId)) score += 42;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = candIdx;
      }
    }

    const bestItem = items[bestIdx];
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
  const defaultTime: TimeOfDay = times[loopIndex % times.length];
  const timeOfDay: TimeOfDay = options.forceTimeOfDay ?? defaultTime;

  const isMilestoneLevel = safeLevel % 5 === 0;
  const isGoldRush = !isMilestoneLevel && safeLevel >= 4 && safeLevel % 5 === 4;
  const blackout = options.forceBlackout ?? false;

  const modifiers: LevelModifierId[] = [];
  if (blackout) modifiers.push('blackout_flashlight');
  if (isGoldRush) modifiers.push('gold_rush');
  if (isMilestoneLevel) modifiers.push('milestone_challenge');
  if (modifiers.length === 0) modifiers.push('none');

  const coinMultiplier = isGoldRush ? 2 : 1;
  const levelBadge = isMilestoneLevel
    ? '里程碑挑战 · 首通送猫条+60金币'
    : isGoldRush
      ? '幸运双倍金币关'
      : blackout
        ? '停电探照挑战'
        : null;

  const baseSeed = hashSeed(safeLevel, options.salt ?? 0);

  for (let attempt = 0; attempt < 10; attempt++) {
    const attemptSeed = hashSeed(safeLevel, (options.salt ?? 0) + attempt * 131);
    const rng = new SeededRng(attemptSeed);
    const plan = buildOrderPlan(safeLevel, theme, rng);

    const effectiveJitter =
      attempt === 0
        ? Math.min(1.6, plan.buryJitter * 0.45)
        : attempt === 1
          ? 1.0
          : attempt === 2
            ? 0.65
            : attempt === 3
              ? 0.35
              : 0;

    interface DealToken {
      itemId: string;
      variantIndex: number;
      orderIndex: number;
      dealScore: number;
    }
    const tokens: DealToken[] = [];
    const variantOffsets = new Map<string, number>();
    plan.orders.forEach((order, orderIndex) => {
      const def = ITEM_BY_ID[order.itemId];
      const variantCount = 1 + (def.variants?.length ?? 0);
      let variantOffset = variantOffsets.get(order.itemId);
      if (variantOffset === undefined) {
        variantOffset = variantCount > 1 ? rng.int(0, variantCount - 1) : 0;
      }
      for (let c = 0; c < order.requiredCount; c++) {
        tokens.push({
          itemId: order.itemId,
          variantIndex: variantCount > 1 ? (variantOffset + c) % variantCount : 0,
          orderIndex,
          dealScore: orderIndex + rng.float(-effectiveJitter, effectiveJitter),
        });
      }
      variantOffsets.set(order.itemId, variantOffset + order.requiredCount);
    });

    const minBoxOrderIdx = 2;
    const boxCandidateIndices: number[] = [];
    tokens.forEach((t, idx) => {
      if (t.orderIndex >= minBoxOrderIdx) boxCandidateIndices.push(idx);
    });
    if (attempt >= 4) {
      boxCandidateIndices.sort((a, b) => tokens[b].orderIndex - tokens[a].orderIndex);
    } else {
      rng.shuffle(boxCandidateIndices);
    }

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
    boardTokens.sort((a, b) => a.dealScore - b.dealScore);

    const anchors = rng.shuffle([...room.anchors]);
    const anchorDepth = new Map<string, number>();
    anchors.forEach((a) => anchorDepth.set(a.id, 0));

    const boxAnchors = new Set<string>();
    const boxes: CardboardBoxInstance[] = [];
    const usableBoxAnchors = anchors.filter(
      (a) =>
        a.y >= 0.48 &&
        a.y <= 0.72 &&
        a.preferredPose !== 'drape_sofa_back' &&
        a.preferredPose !== 'lean_upright' &&
        !(a.x > 0.77 && a.y >= 0.43 && a.y <= 0.64) &&
        distPx(a.x, a.y, 0.78, 0.73) > 105
    );
    for (let b = 0; b < boxItemBuckets.length; b++) {
      const { spec } = boxItemBuckets[b];
      const anchor = usableBoxAnchors.find(
        (cand) =>
          !boxAnchors.has(cand.id) &&
          boxes.every((existing) => distPx(cand.x, cand.y, existing.x, existing.y) > 135)
      ) ?? anchors.find((cand) => !boxAnchors.has(cand.id)) ?? anchors[b];
      boxAnchors.add(anchor.id);
      const boxScale = normalizeAnchorScale(anchor.scale);
      boxes.push({
        uid: `box_${safeLevel}_${b}`,
        anchorId: anchor.id,
        x: Math.min(0.86, Math.max(0.12, anchor.x)),
        y: Math.min(0.72, Math.max(0.42, anchor.y)),
        scale: boxScale * (spec.hits >= 3 ? 1.1 : 1.02),
        radius: (spec.hits >= 3 ? 56 : 51) * boxScale,
        hitsLeft: spec.hits,
        maxHits: spec.hits,
        opened: false,
        containedItemUids: [],
      });
    }

    const placementAnchors = anchors.filter((a) => !boxAnchors.has(a.id));
    const anchorsByZone = new Map<string, RoomAnchor[]>();
    for (const anchor of placementAnchors) {
      const bucket = anchorsByZone.get(anchor.zone);
      if (bucket) bucket.push(anchor);
      else anchorsByZone.set(anchor.zone, [anchor]);
    }
    const zoneOrder = rng.shuffle(Array.from(anchorsByZone.keys()));
    const spreadAnchors: RoomAnchor[] = [];
    let addedInRound = true;
    while (addedInRound) {
      addedInRound = false;
      for (const zone of zoneOrder) {
        const list = anchorsByZone.get(zone)!;
        const next = list.pop();
        if (next) {
          spreadAnchors.push(next);
          addedInRound = true;
        }
      }
    }

    const totalBoard = boardTokens.length;
    const minNeededAnchors = Math.min(
      spreadAnchors.length,
      Math.max(22, Math.ceil(totalBoard / Math.max(1, plan.maxLayer - 1)))
    );
    const activeAnchorPool = [...spreadAnchors.slice(0, minNeededAnchors)];
    let poolCap = activeAnchorPool.reduce((sum, a) => sum + a.capacity, 0);
    for (let idx = minNeededAnchors; idx < spreadAnchors.length && poolCap < totalBoard; idx++) {
      activeAnchorPool.push(spreadAnchors[idx]);
      poolCap += spreadAnchors[idx].capacity;
    }

    const anchorById = new Map(room.anchors.map((a) => [a.id, a]));
    const computeSlotRotation = (anchor: RoomAnchor): number => {
      const base = anchor.fixedRotation ?? 0;
      const jitter = anchor.rotationJitter ?? (anchor.preferredPose && anchor.preferredPose !== 'flat' ? 6 : 16);
      return base + rng.float(-jitter, jitter);
    };
    const computeSlotSpread = (anchor: RoomAnchor, layer: number): { dx: number; dy: number } => {
      const rx = anchor.spreadRadius ?? (layer === 0 ? 0.014 : 0.021);
      const ry = Math.min(rx * 0.75, layer === 0 ? 0.01 : 0.015);
      return { dx: rng.float(-rx, rx), dy: rng.float(-ry, ry) };
    };

    interface SlotCoord {
      uid: string;
      anchorId: string;
      layer: number;
      x: number;
      y: number;
      rotation: number;
      scale: number;
    }
    const slots: SlotCoord[] = [];
    let maxObservedLayer = 0;

    for (let layer = 0; layer < plan.maxLayer + 6 && slots.length < totalBoard; layer++) {
      const layerAnchors = rng.shuffle([...activeAnchorPool]);
      for (const anchor of layerAnchors) {
        if (slots.length >= totalBoard) break;
        const curDepth = anchorDepth.get(anchor.id) ?? 0;
        if (curDepth !== layer) continue;
        if (curDepth >= anchor.capacity && poolCap >= totalBoard) continue;

        const { dx: jitterX, dy: jitterY } = computeSlotSpread(anchor, layer);
        maxObservedLayer = Math.max(maxObservedLayer, layer);
        slots.push({
          uid: `item_${safeLevel}_${slots.length}`,
          anchorId: anchor.id,
          layer,
          x: Math.min(0.885, Math.max(0.11, anchor.x + jitterX)),
          y: Math.min(0.745, Math.max(0.39, anchor.y + jitterY - layer * 0.009)),
          rotation: computeSlotRotation(anchor),
          scale: normalizeAnchorScale(anchor.scale),
        });
        anchorDepth.set(anchor.id, curDepth + 1);
      }
    }

    while (slots.length < totalBoard) {
      const anchor = [...placementAnchors].sort(
        (a, b) => (anchorDepth.get(a.id) ?? 0) - (anchorDepth.get(b.id) ?? 0)
      )[0];
      const layer = anchorDepth.get(anchor.id) ?? 0;
      maxObservedLayer = Math.max(maxObservedLayer, layer);
      const { dx: jitterX, dy: jitterY } = computeSlotSpread(anchor, layer);
      slots.push({
        uid: `item_${safeLevel}_${slots.length}`,
        anchorId: anchor.id,
        layer,
        x: Math.min(0.885, Math.max(0.11, anchor.x + jitterX)),
        y: Math.min(0.745, Math.max(0.39, anchor.y + jitterY - layer * 0.009)),
        rotation: computeSlotRotation(anchor),
        scale: normalizeAnchorScale(anchor.scale),
      });
      anchorDepth.set(anchor.id, layer + 1);
    }

    // Build conservative upper-bound slot DAG across varied scales & aspect ratios and peel top-down
    const MAX_VISUAL_SCALE = 1.38;
    const MAX_ASPECT_ROOT = 1.48;
    const slotCount = slots.length;
    const inDegree = new Int32Array(slotCount);
    const slotDependents: number[][] = Array.from({ length: slotCount }, () => []);
    const conservativeSpan = slots.map(
      (s) =>
        REF_ITEM_BASE_SIZE *
        s.scale *
        MAX_VISUAL_SCALE *
        MAX_ASPECT_ROOT *
        (0.95 + Math.min(1, s.layer / 4) * 0.14) *
        0.42
    );
    for (let lowerIdx = 0; lowerIdx < slotCount; lowerIdx++) {
      const lower = slots[lowerIdx];
      for (let upperIdx = 0; upperIdx < slotCount; upperIdx++) {
        if (lowerIdx === upperIdx) continue;
        const upper = slots[upperIdx];
        let blocks = false;
        if (upper.anchorId === lower.anchorId) {
          blocks = upper.layer > lower.layer;
        } else if (compareBoardItemOrder(upper, lower) > 0) {
          if (
            Math.abs(lower.x - upper.x) <= MAX_OVERLAP_DX_NORM &&
            Math.abs(lower.y - upper.y) <= MAX_OVERLAP_DY_NORM
          ) {
            const dSq = visualDistSqPx(lower.x, lower.y, lower.layer, upper.x, upper.y, upper.layer);
            const thr = (conservativeSpan[lowerIdx] + conservativeSpan[upperIdx]) * ITEM_OVERLAP_RATIO;
            blocks = dSq < thr * thr;
          }
        }
        if (blocks) {
          inDegree[lowerIdx] += 1;
          slotDependents[upperIdx].push(lowerIdx);
        }
      }
    }

    const frontier: number[] = [];
    for (let i = 0; i < slotCount; i++) {
      if (inDegree[i] === 0) frontier.push(i);
    }
    const peelOrder: number[] = [];
    while (frontier.length > 0) {
      const tokenForStep = boardTokens[peelOrder.length];
      let pickPos = rng.int(0, frontier.length - 1);
      if (tokenForStep) {
        const def = ITEM_BY_ID[tokenForStep.itemId];
        const pool = getItemSpritePool(tokenForStep.itemId);
        let bestScore = -Infinity;
        for (let f = 0; f < frontier.length; f++) {
          const candSlot = slots[frontier[f]];
          const candAnchor = anchorById.get(candSlot.anchorId);
          let score = rng.float(0, 12);
          if (candAnchor) {
            if (candAnchor.allowedItemIds?.includes(tokenForStep.itemId)) score += 110;
            else if (def && candAnchor.allowedCategories?.includes(def.category)) score += 32;
            const prefPose = candAnchor.preferredPose;
            if (prefPose && prefPose !== 'flat') {
              const hasPose = pool.some((entry) => entry.pose === prefPose);
              score += hasPose ? 85 : -40;
            }
          }
          if (score > bestScore) {
            bestScore = score;
            pickPos = f;
          }
        }
      }
      const picked = frontier[pickPos];
      frontier[pickPos] = frontier[frontier.length - 1];
      frontier.pop();
      peelOrder.push(picked);
      const deps = slotDependents[picked];
      for (let d = 0; d < deps.length; d++) {
        const dep = deps[d];
        inDegree[dep] -= 1;
        if (inDegree[dep] === 0) {
          frontier.push(dep);
        }
      }
    }

    const resolveSemanticVariant = (
      itemId: string,
      anchor: RoomAnchor | undefined,
      baseVariantIndex: number,
      occurrence: number
    ): { variantIndex: number; pose: ItemPose; aspectRatio: number } => {
      const pool = getItemSpritePool(itemId);
      const prefPose = anchor?.preferredPose;
      if (prefPose) {
        const poseIndices: number[] = [];
        pool.forEach((entry, idx) => {
          if (entry.pose === prefPose) poseIndices.push(idx);
        });
        if (poseIndices.length > 0) {
          const pickedIdx = poseIndices[(baseVariantIndex + occurrence) % poseIndices.length];
          return { variantIndex: pickedIdx, ...pool[pickedIdx] };
        }
      }
      // When no special furniture pose applies (or anchor wants generic items), stick to non-draping flat poses
      const flatIndices: number[] = [];
      pool.forEach((entry, idx) => {
        if (entry.pose === 'flat' || entry.pose === 'tuck_corner') flatIndices.push(idx);
      });
      if (flatIndices.length > 0) {
        const pickedIdx = flatIndices[(baseVariantIndex + occurrence) % flatIndices.length];
        return { variantIndex: pickedIdx, ...pool[pickedIdx] };
      }
      const fallbackIdx = pool.length > 1 ? (baseVariantIndex + occurrence) % pool.length : 0;
      return { variantIndex: fallbackIdx, ...pool[fallbackIdx] };
    };

    const anchorItemSeen = new Map<string, Map<string, number>>();
    const buildLevelItems = (): BoardItemInstance[] => {
      const built: BoardItemInstance[] = [];
      let itemUidCounter = slots.length;
      for (let i = 0; i < totalBoard; i++) {
        const slot = slots[peelOrder[i]];
        const tok = boardTokens[i];
        const def: ItemDefinition = ITEM_BY_ID[tok.itemId];
        const anchor = anchorById.get(slot.anchorId);
        let seen = anchorItemSeen.get(slot.anchorId);
        if (!seen) {
          seen = new Map();
          anchorItemSeen.set(slot.anchorId, seen);
        }
        const occurrence = seen.get(tok.itemId) ?? 0;
        seen.set(tok.itemId, occurrence + 1);
        const resolved = resolveSemanticVariant(tok.itemId, anchor, tok.variantIndex, occurrence);
        const alignedRotation =
          resolved.pose === 'drape_sofa_back' ||
          resolved.pose === 'drape_sofa_edge' ||
          resolved.pose === 'drape_table_edge' ||
          resolved.pose === 'lean_upright'
            ? (anchor?.fixedRotation ?? 0) + rng.float(-4.5, 4.5)
            : slot.rotation;
        built.push({
          uid: slot.uid,
          itemId: tok.itemId,
          variantIndex: resolved.variantIndex,
          pose: resolved.pose,
          aspectRatio: resolved.aspectRatio,
          anchorId: slot.anchorId,
          layer: slot.layer,
          x: slot.x,
          y: slot.y,
          rotation: alignedRotation,
          scale: slot.scale,
          radius: def.radius * slot.scale,
          state: 'on_board',
          hiddenByBoxId: null,
          blockedBy: [],
        });
      }
      const goldenTargetCount = isGoldRush ? 4 : isMilestoneLevel ? 3 : 2;
      const goldenCandidates = rng.shuffle(built.filter((it) => it.state === 'on_board'));
      for (let g = 0; g < Math.min(goldenTargetCount, goldenCandidates.length); g++) {
        goldenCandidates[g].isGolden = true;
      }
      boxes.forEach((box, boxIdx) => {
        const bucket = boxItemBuckets[boxIdx]?.items ?? [];
        bucket.forEach((tok) => {
          const def = ITEM_BY_ID[tok.itemId];
          const uid = `item_${safeLevel}_${itemUidCounter++}`;
          box.containedItemUids.push(uid);
          const resolved = resolveSemanticVariant(tok.itemId, anchorById.get(box.anchorId), tok.variantIndex, 0);
          built.push({
            uid,
            itemId: tok.itemId,
            variantIndex: resolved.variantIndex,
            pose: resolved.pose,
            aspectRatio: resolved.aspectRatio,
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
      recomputeBlockers(built, boxes);
      return built;
    };

    const timeMeta = room.paletteTint[timeOfDay];
    const hostOpening = room.host.openings[(safeLevel - 1) % room.host.openings.length];
    const hostVictory = room.host.victories[(safeLevel - 1) % room.host.victories.length];
    const tutorialHint =
      safeLevel === 1
        ? '点击闪光金边物赚额外金币！双指或点右侧「+」可放大查看，摸橘猫可替你寻物'
        : safeLevel === 2
          ? '新主题「泡沫浴室」已解锁！收集金币买猫条，橘猫还能帮你找藏在底层的目标'
          : safeLevel === 3 && !blackout
            ? '新主题「森林画室」已解锁！文具画材种类更多，善用放大镜和橘猫寻物吧～'
            : blackout
              ? '「森林画室」停电探照！滑动暖光手电筒探照房间，可用右侧放大镜精细查找'
              : isGoldRush
                ? '幸运双倍金币关！打包订单与金色物品金币翻倍，快攒金币囤猫条！'
                : isMilestoneLevel
                  ? `第 ${safeLevel} 关里程碑挑战！首次通关额外赠送 +1 猫条 & +60 金币！`
                  : null;

    const items = buildLevelItems();
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
      distinctItemTypes: new Set(items.map((it) => it.itemId)).size,
      maxStackDepth: maxObservedLayer + 1,
      orderQueue: plan.orders,
      initialItems: items,
      initialBoxes: boxes,
      petEnabled: true,
      catMischiefEnabled: safeLevel >= 2,
      petCooldownSec:
        safeLevel === 1 ? 20 : safeLevel === 2 ? 18 : Math.max(14, 21 - Math.floor(safeLevel / 4)),
      coinMultiplier,
      isMilestoneLevel,
      levelBadge,
      baseTraySlots: 5,
      maxTraySlots: 7,
    };

    if (verifyLevelSolvable(generated) || attempt === 9) {
      return generated;
    }
  }

  throw new Error(`Failed to generate level ${safeLevel}`);
}

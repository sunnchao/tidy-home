import { describe, expect, it } from 'vitest';
import { ITEM_BY_ID, ITEM_CATALOG, ROOM_CATALOG } from '@core/catalogs';
import { GameSession } from '@core/gameSession';
import { generateLevel, verifyLevelSolvable } from '@core/levelGenerator';
import type { GeneratedLevel } from '@core/types';
import {
  buyCatTreats,
  buyLifeWithCoins,
  canClaimDailyAdBonus,
  canClaimDailyFree,
  CAT_TREAT_PACK3_PRICE,
  CAT_TREAT_PRICE,
  claimDailyAdBonus,
  claimDailyFree,
  consumeLife,
  DAILY_FREE_COINS,
  getButlerRank,
  grantLife,
  INITIAL_COINS,
  LIFE_COIN_PRICE,
  LIFE_REGEN_MS,
  MAX_LIVES,
  recordLevelVictory,
  resetWinStreak,
  syncDailyReset,
  syncLives,
  updateNickname,
} from '@core/userProfile';
import { createDefaultSaveData, normalizeSaveData } from '@platform/IPlatformAdapter';

describe('Infinite Level Generator & Solvability', () => {
  it('generates deterministic, zero-orphan, 5-tray-solvable levels for Lv.1..100', () => {
    for (let lv = 1; lv <= 100; lv++) {
      const a = generateLevel(lv);
      const b = generateLevel(lv);
      expect(a.seed).toBe(b.seed);
      expect(a.totalItems).toBe(b.totalItems);
      expect(a.initialItems.length).toBe(a.totalItems);

      const demandByItem = new Map<string, number>();
      for (const ord of a.orderQueue) {
        demandByItem.set(ord.itemId, (demandByItem.get(ord.itemId) ?? 0) + ord.requiredCount);
      }
      const supplyByItem = new Map<string, number>();
      for (const it of a.initialItems) {
        supplyByItem.set(it.itemId, (supplyByItem.get(it.itemId) ?? 0) + 1);
      }
      expect(supplyByItem).toEqual(demandByItem);

      expect(verifyLevelSolvable(a), `Level ${lv} should be solvable`).toBe(true);
      expect(a.modifiers).not.toContain('blackout_flashlight');
    }
  });

  it('cycles across 6 visually distinct rooms with cohesive item casts & varied modifiers', () => {
    const lv1 = generateLevel(1);
    expect(lv1.theme).toBe('living_room');
    expect(lv1.timeOfDay).toBe('morning');
    expect(lv1.totalItems).toBeGreaterThanOrEqual(48);
    expect(lv1.totalItems).toBeLessThanOrEqual(56);
    expect(lv1.distinctItemTypes).toBeGreaterThanOrEqual(10);
    expect(lv1.initialBoxes.length).toBe(1);
    expect(lv1.petEnabled).toBe(true);
    expect(lv1.catMischiefEnabled).toBe(false);
    expect(lv1.initialItems.some((it) => it.isGolden)).toBe(true);
    expect(lv1.tutorialHint).toBeTruthy();

    const lv2 = generateLevel(2);
    expect(lv2.theme).toBe('bathroom');
    expect(lv2.totalItems).toBeGreaterThanOrEqual(90);
    expect(lv2.totalItems).toBeGreaterThan(lv1.totalItems);
    expect(lv2.distinctItemTypes).toBeGreaterThanOrEqual(13);
    expect(lv2.initialBoxes.length).toBe(3);
    expect(lv2.initialBoxes.some((b) => b.maxHits === 3)).toBe(true);
    expect(lv2.petEnabled).toBe(true);
    expect(lv2.catMischiefEnabled).toBe(true);
    const lv2BathroomCount = lv2.initialItems.filter((it) => ITEM_BY_ID[it.itemId].category === 'bathroom').length;
    expect(lv2BathroomCount / lv2.totalItems).toBeGreaterThan(0.7);

    const lv3 = generateLevel(3);
    expect(lv3.theme).toBe('study');
    expect(lv3.totalItems).toBeGreaterThanOrEqual(105);
    expect(lv3.distinctItemTypes).toBeGreaterThanOrEqual(18);
    expect(lv3.timeOfDay).toBe('morning');
    expect(lv3.modifiers).not.toContain('blackout_flashlight');

    const lv4 = generateLevel(4);
    expect(lv4.theme).toBe('cafe');
    expect(lv4.modifiers).toContain('gold_rush');
    expect(lv4.coinMultiplier).toBe(2);

    const lv5 = generateLevel(5);
    expect(lv5.theme).toBe('kitchen');
    expect(lv5.modifiers).toContain('milestone_challenge');
    expect(lv5.isMilestoneLevel).toBe(true);

    const lv6 = generateLevel(6);
    expect(lv6.theme).toBe('bedroom');

    const lv7 = generateLevel(7);
    expect(lv7.theme).toBe('living_room');
    expect(lv7.loopIndex).toBe(1);
    expect(lv7.timeOfDay).toBe('sunset');

    const lv20 = generateLevel(20);
    expect(lv20.totalItems).toBeGreaterThanOrEqual(140);
    expect(lv20.distinctItemTypes).toBeGreaterThanOrEqual(24);
  });

  it('has valid catalog definitions for all 6 rooms (42+ anchors) and 72 items', () => {
    expect(ITEM_CATALOG.length).toBe(72);
    expect(Object.keys(ROOM_CATALOG).length).toBe(6);
    for (const room of Object.values(ROOM_CATALOG)) {
      expect(room.anchors.length).toBeGreaterThanOrEqual(42);
      expect(room.accentColor).toMatch(/^#[0-9A-F]{6}$/i);
      for (const anchor of room.anchors) {
        expect(anchor.x).toBeGreaterThan(0.05);
        expect(anchor.x).toBeLessThan(0.95);
        expect(anchor.y).toBeGreaterThanOrEqual(0.39);
        expect(anchor.y).toBeLessThanOrEqual(0.77);
      }
    }
  });
});

function createControlledLevel(): GeneratedLevel {
  return {
    levelNumber: 2,
    loopIndex: 0,
    seed: 12345,
    theme: 'living_room',
    timeOfDay: 'morning',
    modifiers: ['none'],
    hostTitle: '测试客厅',
    hostOpening: 'test',
    hostVictory: 'done',
    tutorialHint: null,
    totalItems: 9,
    distinctItemTypes: 3,
    maxStackDepth: 2,
    orderQueue: [
      { id: 'o0', itemId: 'handbag', requiredCount: 3 },
      { id: 'o1', itemId: 'thermos', requiredCount: 3 },
      { id: 'o2', itemId: 'teddy', requiredCount: 3 },
    ],
    initialItems: [
      {
        uid: 'bottom_handbag',
        itemId: 'handbag',
        anchorId: 'lr_sofa_1',
        layer: 0,
        x: 0.37,
        y: 0.5,
        rotation: 0,
        scale: 0.9,
        radius: 42,
        state: 'on_board',
        hiddenByBoxId: null,
        blockedBy: [],
        isGolden: true,
      },
      {
        uid: 'top_thermos',
        itemId: 'thermos',
        anchorId: 'lr_sofa_1',
        layer: 1,
        x: 0.37,
        y: 0.5,
        rotation: 0,
        scale: 0.9,
        radius: 37,
        state: 'on_board',
        hiddenByBoxId: null,
        blockedBy: [],
      },
      {
        uid: 'h2',
        itemId: 'handbag',
        anchorId: 'lr_sofa_2',
        layer: 0,
        x: 0.49,
        y: 0.51,
        rotation: 0,
        scale: 0.9,
        radius: 42,
        state: 'on_board',
        hiddenByBoxId: null,
        blockedBy: [],
      },
      {
        uid: 'h3',
        itemId: 'handbag',
        anchorId: 'lr_sofa_3',
        layer: 0,
        x: 0.62,
        y: 0.52,
        rotation: 0,
        scale: 0.9,
        radius: 42,
        state: 'on_board',
        hiddenByBoxId: null,
        blockedBy: [],
      },
      {
        uid: 't2',
        itemId: 'thermos',
        anchorId: 'lr_table_1',
        layer: 0,
        x: 0.31,
        y: 0.63,
        rotation: 0,
        scale: 0.92,
        radius: 37,
        state: 'on_board',
        hiddenByBoxId: null,
        blockedBy: [],
      },
      {
        uid: 't3',
        itemId: 'thermos',
        anchorId: 'lr_table_2',
        layer: 0,
        x: 0.41,
        y: 0.62,
        rotation: 0,
        scale: 0.92,
        radius: 37,
        state: 'on_board',
        hiddenByBoxId: null,
        blockedBy: [],
      },
      {
        uid: 'd1',
        itemId: 'teddy',
        anchorId: 'lr_rug_1',
        layer: 0,
        x: 0.15,
        y: 0.67,
        rotation: 0,
        scale: 0.94,
        radius: 46,
        state: 'on_board',
        hiddenByBoxId: null,
        blockedBy: [],
      },
      {
        uid: 'd2',
        itemId: 'teddy',
        anchorId: 'lr_rug_5',
        layer: 0,
        x: 0.8,
        y: 0.68,
        rotation: 0,
        scale: 0.94,
        radius: 46,
        state: 'on_board',
        hiddenByBoxId: null,
        blockedBy: [],
      },
      {
        uid: 'd3_in_box',
        itemId: 'teddy',
        anchorId: 'lr_rug_7',
        layer: 0,
        x: 0.61,
        y: 0.73,
        rotation: 0,
        scale: 1,
        radius: 46,
        state: 'hidden_in_box',
        hiddenByBoxId: 'box_0',
        blockedBy: [],
      },
    ],
    initialBoxes: [
      {
        uid: 'box_0',
        anchorId: 'lr_rug_7',
        x: 0.61,
        y: 0.73,
        scale: 1,
        radius: 48,
        hitsLeft: 2,
        maxHits: 2,
        opened: false,
        containedItemUids: ['d3_in_box'],
      },
    ],
    petEnabled: true,
    catMischiefEnabled: true,
    petCooldownSec: 18,
    coinMultiplier: 1,
    isMilestoneLevel: false,
    levelBadge: null,
    baseTraySlots: 5,
    maxTraySlots: 7,
  };
}

describe('GameSession Core Mechanics, Golden Coins & Cat Helper', () => {
  it('blocks occluded taps, delivers direct matches, awards golden/order coins, and opens boxes', () => {
    const session = new GameSession(createControlledLevel());
    const events: string[] = [];
    let coinsEarned = 0;
    session.onEvent((e) => {
      events.push(e.type);
      if (e.type === 'coin_earned') {
        coinsEarned += Number(e.payload?.amount ?? 0);
      }
    });

    const blockedRes = session.tapItem('bottom_handbag');
    expect(blockedRes.accepted).toBe(false);
    expect(blockedRes.reason).toBe('blocked');
    expect(events).toContain('item_blocked');

    expect(session.tapItem('d1').accepted).toBe(true);
    expect(session.tapItem('d2').accepted).toBe(true);
    expect(session.getSnapshot().tray.length).toBe(2);

    expect(session.tapItem('top_thermos').accepted).toBe(true);
    expect(session.tapItem('bottom_handbag').accepted).toBe(true);
    expect(session.tapItem('h2').accepted).toBe(true);
    expect(session.tapItem('h3').accepted).toBe(true);

    const afterHandbag = session.getSnapshot();
    expect(afterHandbag.ordersCompleted).toBe(1);
    expect(afterHandbag.orderSlots[0].order?.itemId).toBe('teddy');
    expect(afterHandbag.orderSlots[0].collectedCount).toBe(2);
    expect(afterHandbag.tray.length).toBe(0);
    // 10 coins for golden bottom_handbag + 5 coins for completing handbag order
    expect(coinsEarned).toBe(15);
    expect(afterHandbag.coinsEarnedInSession).toBe(15);

    const hit1 = session.tapBox('box_0');
    expect(hit1.accepted).toBe(true);
    expect(hit1.opened).toBe(false);
    const hit2 = session.tapBox('box_0');
    expect(hit2.accepted).toBe(true);
    expect(hit2.opened).toBe(true);

    expect(session.tapItem('d3_in_box').accepted).toBe(true);
    expect(session.getSnapshot().feverActive).toBe(true);
    // Fever does NOT auto-pull remaining board items into slots
    const remaining = session.getSnapshot().items.filter((it) => it.state === 'on_board');
    expect(remaining.length).toBe(2);
    for (const rem of remaining) {
      expect(session.tapItem(rem.uid).accepted).toBe(true);
    }

    const finalSnap = session.getSnapshot();
    expect(finalSnap.status).toBe('won');
    expect(finalSnap.progressDone).toBe(9);
    expect(finalSnap.starsEarned).toBe(3);
  });

  it('supports up to 5 treat-based cat item findings per level + 1 ad gift + smart occluded targeting', () => {
    const level = createControlledLevel();
    const session = new GameSession(level);

    // Zero treats blocks free petting and requests ad/purchase
    const noTreats = session.petCat(0);
    expect(noTreats.status).toBe('need_ad_no_treats');
    expect(noTreats.treatsSpent).toBe(0);

    // First pet on cat targets the occluded active order item (`bottom_handbag`) directly!
    expect(session.petCat(5).status).toBe('petted');
    const gift1 = session.petCat(5);
    expect(gift1.status).toBe('gifted');
    expect(gift1.treatsSpent).toBe(1);
    expect(gift1.itemUid).toBe('bottom_handbag');

    // Use remaining 4 treat gifts (up to maxFreeGiftsPerLevel = 5)
    for (let i = 0; i < 4; i++) {
      expect(session.petCat(5).status).toBe('petted');
      expect(session.petCat(5).status).toBe('gifted');
    }
    expect(session.getSnapshot().pet.freeGiftsUsedInLevel).toBe(5);

    // 6th treat attempt hits level cap -> offers ad
    expect(session.petCat(5).status).toBe('need_ad_level_cap');

    // Grant 1 ad cat gift -> reaches absolute limit
    const adGift = session.grantAdCatGift();
    expect(adGift.gifted).toBe(true);
    expect(session.getSnapshot().pet.adGiftsUsedInLevel).toBe(1);
    expect(session.petCat(5).status).toBe('level_limit_reached');
    expect(session.grantAdCatGift().gifted).toBe(false);
  });

  it('allows dragging the cat to a clamped playable spot without spending treats', () => {
    const level = createControlledLevel();
    const session = new GameSession(level);
    const events: string[] = [];
    session.onEvent((ev) => events.push(ev.type));

    const moved = session.movePetTo(0.72, 0.55);
    expect(moved).toEqual({ x: 0.72, y: 0.55 });
    expect(session.getSnapshot().pet.x).toBe(0.72);
    expect(session.getSnapshot().pet.y).toBe(0.55);
    expect(events).toContain('cat_moved');

    // Out-of-bounds targets clamp cleanly inside [0.10, 0.90] x [0.38, 0.78]
    expect(session.movePetTo(0.01, 0.1)).toEqual({ x: 0.1, y: 0.38 });
    expect(session.movePetTo(0.99, 0.95)).toEqual({ x: 0.9, y: 0.78 });
    expect(session.getSnapshot().pet.petsReceived).toBe(0);
    expect(session.getSnapshot().pet.freeGiftsUsedInLevel).toBe(0);
  });

  it('handles tray full failure, revive, ad unlocks, undo, hint, shuffle, and magnet', () => {
    const level = createControlledLevel();
    level.baseTraySlots = 2;
    const session = new GameSession(level);

    session.tapItem('d1');
    session.tapItem('d2');
    expect(session.getSnapshot().status).toBe('failed_tray_full');

    expect(session.unlockAdTraySlot()).toBe(true);
    expect(session.getSnapshot().status).toBe('playing');
    expect(session.getSnapshot().trayUnlockedSlots).toBe(3);

    expect(session.useBooster('undo').ok).toBe(true);
    expect(session.getSnapshot().tray.length).toBe(1);

    expect(session.useBooster('hint').ok).toBe(true);
    expect(session.getSnapshot().highlightedItemUid).toBeTruthy();

    expect(session.useBooster('shuffle').ok).toBe(true);

    expect(session.useBooster('magnet').ok).toBe(true);
    expect(session.getSnapshot().progressDone).toBe(2);

    expect(session.unlockAdOrderSlot()).toBe(true);
    expect(session.getSnapshot().orderSlots[2].unlocked).toBe(true);
  });

  it('triggers Fever mode on 5 consecutive direct deliveries without pulling extra board items', () => {
    const session = new GameSession(generateLevel(1));
    let feverCount = 0;
    let deliveredCount = 0;
    session.onEvent((ev) => {
      if (ev.type === 'fever_started') feverCount += 1;
      if (ev.type === 'item_delivered') deliveredCount += 1;
    });

    let hits = 0;
    for (let guard = 0; guard < 15 && hits < 5; guard++) {
      const snap = session.getSnapshot();
      const activeIds = new Set(
        snap.orderSlots.filter((s) => s.unlocked && s.order).map((s) => s.order!.itemId)
      );
      const item = snap.items.find(
        (it) => it.state === 'on_board' && it.blockedBy.length === 0 && activeIds.has(it.itemId)
      );
      if (!item) break;
      session.tapItem(item.uid);
      hits += 1;
    }

    expect(hits).toBe(5);
    expect(feverCount).toBe(1);
    expect(deliveredCount).toBe(5);
    expect(session.getSnapshot().feverActive).toBe(true);
    expect(session.getSnapshot().progressDone).toBe(5);
  });

  it('blocks clicks on adjacent lower items whose rendered sprite visibly overlaps an upper item', () => {
    const overlapLevel = createControlledLevel();
    overlapLevel.orderQueue = [{ id: 'o0', itemId: 'handbag', requiredCount: 2 }];
    overlapLevel.totalItems = 2;
    overlapLevel.initialBoxes = [];
    overlapLevel.initialItems = [
      {
        uid: 'lower',
        itemId: 'handbag',
        anchorId: 'lr_sofa_1',
        layer: 0,
        x: 0.4,
        y: 0.55,
        rotation: 0,
        scale: 1,
        radius: 46,
        state: 'on_board',
        hiddenByBoxId: null,
        blockedBy: [],
      },
      {
        uid: 'upper',
        itemId: 'handbag',
        anchorId: 'lr_sofa_2',
        layer: 0,
        // ~58px away on 720p: previously (<45px) failed to block despite ~50% visual sprite overlap!
        x: 0.48,
        y: 0.55,
        rotation: 0,
        scale: 1,
        radius: 46,
        state: 'on_board',
        hiddenByBoxId: null,
        blockedBy: [],
      },
    ];

    const session = new GameSession(overlapLevel);
    const snap1 = session.getSnapshot();
    const lowerItem = snap1.items.find((it) => it.uid === 'lower')!;
    const upperItem = snap1.items.find((it) => it.uid === 'upper')!;
    expect(lowerItem.blockedBy).toContain('upper');
    expect(upperItem.blockedBy).toEqual([]);

    expect(session.tapItem('lower')).toEqual({ accepted: false, reason: 'blocked' });
    expect(session.tapItem('upper')).toEqual({ accepted: true });

    const snap2 = session.getSnapshot();
    expect(snap2.items.find((it) => it.uid === 'lower')!.blockedBy).toEqual([]);
    expect(session.tapItem('lower')).toEqual({ accepted: true });
    expect(session.getSnapshot().status).toBe('won');
  });
});

describe('Health Bar (Lives), Coins Shop & Progression Rewards', () => {
  it('starts with 5 lives, consumes on start, regenerates 1 per 10 minutes, and caps at 5', () => {
    let save = createDefaultSaveData();
    expect(save.lives).toBe(MAX_LIVES);
    expect(save.coins).toBe(INITIAL_COINS);

    const t0 = 1_700_000_000_000;
    const c1 = consumeLife(save, t0);
    expect(c1.ok).toBe(true);
    expect(c1.save.lives).toBe(4);
    expect(c1.nextRegenInSec).toBe(600);
    save = c1.save;

    // 4 minutes later: still 4 lives, 6 minutes left
    const mid = syncLives(save, t0 + 4 * 60 * 1000);
    expect(mid.gained).toBe(0);
    expect(mid.save.lives).toBe(4);
    expect(mid.nextRegenInSec).toBe(360);

    // Consume down to 0
    save = consumeLife(save, t0 + 1000).save;
    save = consumeLife(save, t0 + 2000).save;
    save = consumeLife(save, t0 + 3000).save;
    save = consumeLife(save, t0 + 4000).save;
    expect(save.lives).toBe(0);
    expect(consumeLife(save, t0 + 5000).ok).toBe(false);

    // After 25 minutes from t0: recovers 2 lives (2 * 10m), 5 min until next
    const regen2 = syncLives(save, t0 + 25 * 60 * 1000);
    expect(regen2.gained).toBe(2);
    expect(regen2.save.lives).toBe(2);
    expect(regen2.nextRegenInSec).toBe(300);

    // Granting +10 caps cleanly at MAX_LIVES (5) and clears timer anchor
    const full = grantLife(regen2.save, 10, t0 + 25 * 60 * 1000);
    expect(full.granted).toBe(3);
    expect(full.save.lives).toBe(MAX_LIVES);
    expect(full.save.lastLifeRegenAtMs).toBe(0);
    expect(syncLives(full.save, t0 + 25 * 60 * 1000).nextRegenInSec).toBe(0);

    // After 2 hours from 1 life: caps at 5
    const oneLeft = consumeLife(full.save, t0).save;
    const wayLater = syncLives(oneLeft, t0 + 120 * 60 * 1000);
    expect(wayLater.save.lives).toBe(MAX_LIVES);
    expect(LIFE_REGEN_MS).toBe(600_000);
  });

  it('buys single & pack-3 cat treats and extra lives with coins safely', () => {
    let save = createDefaultSaveData();
    save.coins = 200;
    const initTreats = save.petTreats;

    const single = buyCatTreats(save, 'single');
    expect(single.ok).toBe(true);
    expect(single.spent).toBe(CAT_TREAT_PRICE);
    expect(single.save.coins).toBe(150);
    expect(single.save.petTreats).toBe(initTreats + 1);
    save = single.save;

    const pack = buyCatTreats(save, 'pack3');
    expect(pack.ok).toBe(true);
    expect(pack.spent).toBe(CAT_TREAT_PACK3_PRICE);
    expect(pack.save.coins).toBe(20);
    expect(pack.save.petTreats).toBe(initTreats + 4);
    save = pack.save;

    // Insufficient coins fails cleanly
    expect(buyCatTreats(save, 'single').ok).toBe(false);
    expect(buyLifeWithCoins(save).reason).toBe('lives_full');

    save = consumeLife(save, 1_700_000_000_000).save;
    expect(buyLifeWithCoins(save, 1_700_000_000_000).reason).toBe('insufficient_coins');

    save.coins = LIFE_COIN_PRICE + 10;
    const lifeBought = buyLifeWithCoins(save, 1_700_000_000_000);
    expect(lifeBought.ok).toBe(true);
    expect(lifeBought.save.lives).toBe(MAX_LIVES);
    expect(lifeBought.save.coins).toBe(10);
  });

  it('grants +1 life, clear coins, win streak, and room unlock flags on level victory', () => {
    let save = createDefaultSaveData();
    const initialTreats = save.petTreats;
    const t0 = 1_700_000_000_000;
    save = consumeLife(save, t0).save; // 4/5 lives

    const r1 = recordLevelVictory(save, 1, 2, save.boosters, { nowMs: t0 });
    expect(r1.lifeGranted).toBe(1);
    expect(r1.save.lives).toBe(5);
    expect(r1.unlockedRoomId).toBe('bathroom');
    expect(r1.clearCoinsAwarded).toBeGreaterThan(0);
    expect(r1.save.winStreak).toBe(1);
    save = r1.save;

    // Spend 2 lives -> win Lv.2 -> recovers +1 life (3 -> 4) & grants milestone treat
    save = consumeLife(save, t0 + 1000).save;
    save = consumeLife(save, t0 + 2000).save;
    const r2 = recordLevelVictory(save, 2, 3, save.boosters, { nowMs: t0 + 3000 });
    expect(r2.lifeGranted).toBe(1);
    expect(r2.save.lives).toBe(4);
    expect(r2.milestonePetTreatsGranted).toBe(1);
    expect(r2.save.petTreats).toBe(initialTreats + 1);
    expect(r2.unlockedRoomId).toBe('study');
    expect(r2.save.winStreak).toBe(2);
    save = resetWinStreak(r2.save);
    expect(save.winStreak).toBe(0);
    expect(save.bestWinStreak).toBe(2);
    expect(getButlerRank(30).title).toBe('整理之神');
  });

  it('migrates legacy save data safely and tracks daily claim limits + coins + cross-day reset', () => {
    const legacy = normalizeSaveData({
      currentLevel: 4,
      highestLevel: 5,
      totalStars: 9,
      muted: true,
    });
    expect(legacy.currentLevel).toBe(4);
    expect(legacy.totalStars).toBe(9);
    expect(legacy.petTreats).toBe(2);
    expect(legacy.lives).toBe(MAX_LIVES);
    expect(legacy.coins).toBe(INITIAL_COINS);
    expect(legacy.userId).toMatch(/^TH-\d+$/);

    let save = createDefaultSaveData();
    save.dailyClaimDate = '2026-11-24';

    expect(canClaimDailyFree(save, '2026-11-24')).toBe(true);
    const c1 = claimDailyFree(save, '2026-11-24');
    expect(c1.ok).toBe(true);
    expect(c1.grantedCoins).toBe(DAILY_FREE_COINS);
    save = c1.save;
    const c2 = claimDailyFree(save, '2026-11-24');
    expect(c2.ok).toBe(true);
    save = c2.save;
    expect(save.petTreats).toBe(4);
    expect(save.coins).toBe(INITIAL_COINS + DAILY_FREE_COINS * 2);
    expect(canClaimDailyFree(save, '2026-11-24')).toBe(false);
    expect(claimDailyFree(save, '2026-11-24').ok).toBe(false);

    expect(canClaimDailyAdBonus(save, '2026-11-24')).toBe(true);
    const ad1 = claimDailyAdBonus(save, '2026-11-24');
    expect(ad1.ok).toBe(true);
    save = ad1.save;
    expect(save.petTreats).toBe(5);
    expect(canClaimDailyAdBonus(save, '2026-11-24')).toBe(false);

    save = syncDailyReset(save, '2026-11-25');
    expect(save.dailyFreeClaimed).toBe(0);
    expect(save.dailyAdClaimed).toBe(0);
    expect(save.dailyShareClaimed).toBe(0);
    expect(canClaimDailyFree(save, '2026-11-25')).toBe(true);

    const renamed = updateNickname(legacy, '  超级橘猫收纳师呀哈哈  ');
    expect(renamed.nickname).toBe('超级橘猫收纳师呀哈哈');
    expect(updateNickname(renamed, '   ').nickname).toBe('超级橘猫收纳师呀哈哈');
  });
});

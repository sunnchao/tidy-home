import { describe, expect, it } from 'vitest';
import { ITEM_CATALOG, ROOM_CATALOG } from '../src/core/catalogs';
import { GameSession } from '../src/core/gameSession';
import { generateLevel, verifyLevelSolvable } from '../src/core/levelGenerator';
import type { GeneratedLevel } from '../src/core/types';
import {
  canClaimDailyAdBonus,
  canClaimDailyFree,
  claimDailyAdBonus,
  claimDailyFree,
  recordLevelVictory,
  syncDailyReset,
  updateNickname,
} from '../src/core/userProfile';
import { createDefaultSaveData, normalizeSaveData } from '../src/platform/IPlatformAdapter';

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
    }
  });

  it('applies progressive high-complexity rules across Lv.1..Lv.20 loops', () => {
    const lv1 = generateLevel(1);
    expect(lv1.theme).toBe('living_room');
    expect(lv1.timeOfDay).toBe('morning');
    expect(lv1.totalItems).toBeGreaterThanOrEqual(30);
    expect(lv1.distinctItemTypes).toBeGreaterThanOrEqual(8);
    expect(lv1.initialBoxes.length).toBe(1);
    expect(lv1.petEnabled).toBe(false);
    expect(lv1.tutorialHint).toBeTruthy();

    const lv2 = generateLevel(2);
    expect(lv2.theme).toBe('bedroom');
    expect(lv2.totalItems).toBeGreaterThanOrEqual(45);
    expect(lv2.distinctItemTypes).toBeGreaterThanOrEqual(12);
    expect(lv2.initialBoxes.length).toBe(3);
    expect(lv2.initialBoxes.some((b) => b.maxHits === 3)).toBe(true);
    expect(lv2.petEnabled).toBe(true);

    const lv3 = generateLevel(3);
    expect(lv3.theme).toBe('kitchen');
    expect(lv3.totalItems).toBeGreaterThanOrEqual(50);
    expect(lv3.distinctItemTypes).toBeGreaterThanOrEqual(14);
    expect(lv3.timeOfDay).toBe('night');
    expect(lv3.modifiers).toContain('blackout_flashlight');

    const lv4 = generateLevel(4);
    expect(lv4.theme).toBe('living_room');
    expect(lv4.loopIndex).toBe(1);
    expect(lv4.timeOfDay).toBe('sunset');

    const lv7 = generateLevel(7);
    expect(lv7.theme).toBe('living_room');
    expect(lv7.loopIndex).toBe(2);
    expect(lv7.timeOfDay).toBe('night');

    const lv20 = generateLevel(20);
    expect(lv20.totalItems).toBeGreaterThanOrEqual(60);
    expect(lv20.distinctItemTypes).toBeGreaterThanOrEqual(16);
  });

  it('has valid catalog definitions for all 3 rooms (42+ anchors) and 48 items', () => {
    expect(ITEM_CATALOG.length).toBe(48);
    for (const room of Object.values(ROOM_CATALOG)) {
      expect(room.anchors.length).toBeGreaterThanOrEqual(42);
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
    petCooldownSec: 18,
    baseTraySlots: 5,
    maxTraySlots: 7,
  };
}

describe('GameSession Core Mechanics & Bounded Pet System', () => {
  it('blocks occluded taps, delivers direct matches, cascades tray matches on box seal, and opens cardboard boxes', () => {
    const session = new GameSession(createControlledLevel());
    const events: string[] = [];
    session.onEvent((e) => events.push(e.type));

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

    const hit1 = session.tapBox('box_0');
    expect(hit1.accepted).toBe(true);
    expect(hit1.opened).toBe(false);
    const hit2 = session.tapBox('box_0');
    expect(hit2.accepted).toBe(true);
    expect(hit2.opened).toBe(true);

    expect(session.tapItem('d3_in_box').accepted).toBe(true);
    expect(session.getSnapshot().feverActive).toBe(true);
    const remaining = session.getSnapshot().items.filter((it) => it.state === 'on_board');
    expect(remaining.length).toBe(1);
    expect(session.tapItem(remaining[0].uid).accepted).toBe(true);

    const finalSnap = session.getSnapshot();
    expect(finalSnap.status).toBe('won');
    expect(finalSnap.progressDone).toBe(9);
    expect(finalSnap.starsEarned).toBe(3);
  });

  it('handles tray full failure, revive, ad unlocks, undo, hint, shuffle, magnet, and bounded pet cat limits', () => {
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

    // Zero treats blocks free petting and requests ad
    const noTreats = session.petCat(0);
    expect(noTreats.status).toBe('need_ad_no_treats');
    expect(noTreats.treatsSpent).toBe(0);

    // With treats available: 2 pets deliver 1 gift and consume 1 treat
    expect(session.forceCatMischief()).toBe(true);
    const p1 = session.petCat(2);
    expect(p1.status).toBe('petted');
    expect(p1.treatsSpent).toBe(0);
    const p2 = session.petCat(2);
    expect(p2.status).toBe('gifted');
    expect(p2.treatsSpent).toBe(1);
    expect(session.getSnapshot().pet.freeGiftsUsedInLevel).toBe(1);

    // Further free petting in same level is blocked -> requires ad
    const p3 = session.petCat(5);
    expect(p3.status).toBe('need_ad_level_cap');

    // Grant 1 ad cat gift -> reaches absolute per-level limit
    const adGift = session.grantAdCatGift();
    expect(adGift.gifted).toBe(true);
    expect(session.getSnapshot().pet.adGiftsUsedInLevel).toBe(1);

    // Even with more treats or clicks, no more gifts this level
    const p4 = session.petCat(5);
    expect(p4.status).toBe('level_limit_reached');
    expect(session.grantAdCatGift().gifted).toBe(false);

    expect(session.unlockAdOrderSlot()).toBe(true);
    expect(session.getSnapshot().orderSlots[2].unlocked).toBe(true);
  });

  it('triggers Fever mode on 5 consecutive direct deliveries', () => {
    const session = new GameSession(generateLevel(1));
    let feverCount = 0;
    session.onEvent((ev) => {
      if (ev.type === 'fever_started') feverCount += 1;
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
    expect(session.getSnapshot().feverActive).toBe(true);
  });
});

describe('User Profile, Daily Claims & Level Clear Milestone Rewards', () => {
  it('migrates legacy save data safely and tracks daily claim limits + cross-day reset', () => {
    const legacy = normalizeSaveData({
      currentLevel: 4,
      highestLevel: 5,
      totalStars: 9,
      muted: true,
    });
    expect(legacy.currentLevel).toBe(4);
    expect(legacy.totalStars).toBe(9);
    expect(legacy.petTreats).toBe(2);
    expect(legacy.userId).toMatch(/^TH-\d+$/);

    let save = createDefaultSaveData();
    save.dailyClaimDate = '2026-11-24';

    expect(canClaimDailyFree(save, '2026-11-24')).toBe(true);
    const c1 = claimDailyFree(save, '2026-11-24');
    expect(c1.ok).toBe(true);
    save = c1.save;
    const c2 = claimDailyFree(save, '2026-11-24');
    expect(c2.ok).toBe(true);
    save = c2.save;
    expect(save.petTreats).toBe(4);
    expect(canClaimDailyFree(save, '2026-11-24')).toBe(false);
    expect(claimDailyFree(save, '2026-11-24').ok).toBe(false);

    // Daily ad bonus capped at 1 per day
    expect(canClaimDailyAdBonus(save, '2026-11-24')).toBe(true);
    const ad1 = claimDailyAdBonus(save, '2026-11-24');
    expect(ad1.ok).toBe(true);
    save = ad1.save;
    expect(save.petTreats).toBe(5);
    expect(canClaimDailyAdBonus(save, '2026-11-24')).toBe(false);

    // Next day automatically resets daily limits
    save = syncDailyReset(save, '2026-11-25');
    expect(save.dailyFreeClaimed).toBe(0);
    expect(save.dailyAdClaimed).toBe(0);
    expect(canClaimDailyFree(save, '2026-11-25')).toBe(true);
  });

  it('grants +1 pet treat every 2 cleared levels and prevents star inflation / level regression on replay', () => {
    let save = createDefaultSaveData();
    const initialTreats = save.petTreats;

    const r1 = recordLevelVictory(save, 1, 2, save.boosters);
    expect(r1.milestonePetTreatsGranted).toBe(0);
    expect(r1.clearsUntilNextReward).toBe(1);
    expect(r1.starDelta).toBe(2);
    expect(r1.save.totalStars).toBe(2);
    expect(r1.save.currentLevel).toBe(2);
    save = r1.save;

    const r2 = recordLevelVictory(save, 2, 3, save.boosters);
    expect(r2.milestonePetTreatsGranted).toBe(1);
    expect(r2.clearsUntilNextReward).toBe(2);
    expect(r2.save.petTreats).toBe(initialTreats + 1);
    expect(r2.save.totalLevelsCleared).toBe(2);
    expect(r2.save.totalStars).toBe(5);
    expect(r2.save.currentLevel).toBe(3);
    save = r2.save;

    // Replay Lv.1 with 1 star -> 0 extra stars, currentLevel remains 3
    const replayLow = recordLevelVictory(save, 1, 1, save.boosters);
    expect(replayLow.starDelta).toBe(0);
    expect(replayLow.save.totalStars).toBe(5);
    expect(replayLow.save.currentLevel).toBe(3);
    save = replayLow.save;

    // Replay Lv.1 with 3 stars -> +1 delta star only (2 -> 3)
    const replayHigh = recordLevelVictory(save, 1, 3, save.boosters);
    expect(replayHigh.starDelta).toBe(1);
    expect(replayHigh.save.totalStars).toBe(6);
    expect(replayHigh.save.levelStars[1]).toBe(3);

    // Legacy migration & nickname clamp
    const legacy = normalizeSaveData({ currentLevel: 3, totalStars: 7 });
    expect(legacy.vibrationEnabled).toBe(true);
    expect(legacy.bgmEnabled).toBe(true);
    expect(legacy.levelStars).toEqual({});

    const renamed = updateNickname(legacy, '  超级橘猫收纳师呀哈哈  ');
    expect(renamed.nickname).toBe('超级橘猫收纳师呀哈哈');
    expect(updateNickname(renamed, '   ').nickname).toBe('超级橘猫收纳师呀哈哈');
  });
});

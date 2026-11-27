import { describe, expect, it } from 'vitest';
import { createDefaultCamera, type BoardCamera } from '../src/core/camera';
import { GameSession } from '../src/core/gameSession';
import { compareBoardItemOrder, generateLevel, getItemHalfExtentsRef } from '../src/core/levelGenerator';
import { createDefaultSaveData } from '../src/platform/IPlatformAdapter';
import { OrderFlowTracker } from '../src/shared/orderFlowTracker';
import {
  BoardWorldCache,
  computeDockedCatPosition,
  DockedCatCache,
  renderBoardWorld,
  renderDockedCat,
  renderZoomControls,
} from '../src/minigame/boardRenderer';
import { renderInGameHud } from '../src/minigame/hudRenderer';
import { bindMiniGameTouch } from '../src/minigame/inputController';
import { computeHudLayout, REF_H, REF_W, type HitRect, type StageMetrics } from '../src/minigame/types';
import { createIdleTransition } from '../src/core/transition';

interface CtxPerfCounters {
  drawImageCalls: number;
  shadowBlurDraws: number;
  radialGradientCalls: number;
  fillCalls: number;
}

function createInstrumentedCtx(counters: CtxPerfCounters) {
  const stack: Array<{ shadowBlur: number }> = [];
  const ctx: any = {
    shadowBlur: 0,
    shadowColor: 'transparent',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    globalAlpha: 1,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '16px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    save() {
      stack.push({ shadowBlur: this.shadowBlur });
    },
    restore() {
      const prev = stack.pop();
      if (prev) this.shadowBlur = prev.shadowBlur;
    },
    setTransform() {},
    translate() {},
    scale() {},
    rotate() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    arcTo() {},
    ellipse() {},
    rect() {},
    quadraticCurveTo() {},
    bezierCurveTo() {},
    clip() {},
    clearRect() {},
    stroke() {},
    strokeText() {},
    fillText() {},
    measureText(t: string) {
      return { width: t.length * 10 };
    },
    createRadialGradient() {
      counters.radialGradientCalls += 1;
      return { addColorStop() {} };
    },
    createLinearGradient() {
      return { addColorStop() {} };
    },
    fill() {
      counters.fillCalls += 1;
      if (this.shadowBlur > 0) counters.shadowBlurDraws += 1;
    },
    fillRect() {
      counters.fillCalls += 1;
      if (this.shadowBlur > 0) counters.shadowBlurDraws += 1;
    },
    drawImage() {
      counters.drawImageCalls += 1;
      if (this.shadowBlur > 0) counters.shadowBlurDraws += 1;
    },
  };
  return ctx;
}

function createMockAssets() {
  const fakeImg = { width: 128, height: 128 };
  const fakeOffscreen = () => {
    const subCounters: CtxPerfCounters = {
      drawImageCalls: 0,
      shadowBlurDraws: 0,
      radialGradientCalls: 0,
      fillCalls: 0,
    };
    const subCtx = createInstrumentedCtx(subCounters);
    return {
      width: 0,
      height: 0,
      getContext: () => subCtx,
      _counters: subCounters,
    };
  };
  return {
    getImage: () => fakeImg,
    getItemDrawable: () => fakeImg,
    getAlphaMask: () => null,
    createOffscreenCanvas: (w: number, h: number) => {
      const c = fakeOffscreen();
      c.width = w;
      c.height = h;
      return c;
    },
  } as any;
}

describe('Android camera pan/zoom performance invariants', () => {
  it('coalesces high-frequency touchmove events instead of synchronously rendering inside touchmove', () => {
    const session = new GameSession(generateLevel(20));
    const metrics: StageMetrics = {
      screenW: 412,
      screenH: 915,
      stageW: REF_W,
      stageH: REF_H,
      dpr: 2,
      scale: 412 / REF_W,
      offsetX: 0,
      offsetY: 0,
      safeTopOffset: 44,
      safeBottomOffset: 24,
    };

    let camera: BoardCamera = createDefaultCamera();
    let touchStartHandler: ((res: any) => void) | null = null;
    let touchMoveHandler: ((res: any) => void) | null = null;
    let touchEndHandler: ((res: any) => void) | null = null;
    let syncRenders = 0;

    const api = {
      onTouchStart(cb: (res: any) => void) {
        touchStartHandler = cb;
      },
      onTouchMove(cb: (res: any) => void) {
        touchMoveHandler = cb;
      },
      onTouchEnd(cb: (res: any) => void) {
        touchEndHandler = cb;
      },
      onTouchCancel() {},
    };

    bindMiniGameTouch({
      api,
      canvas: {},
      getMetrics: () => metrics,
      getScreen: () => 'game',
      getActiveModal: () => 'none',
      getSession: () => session,
      getTransitionState: () => createIdleTransition(),
      getCamera: () => camera,
      setCamera: (next) => {
        camera = next;
      },
      getHitRegions: () => ({
        hud: [],
        board: [],
        cat: null,
        boardClipTopY: 270,
        boardClipBottomY: 1180,
      }),
      setPointer: () => {},
      setTapRipple: () => {},
      onRender: () => {
        syncRenders += 1;
      },
    });

    expect(touchStartHandler).toBeTruthy();
    expect(touchMoveHandler).toBeTruthy();

    // 1) Simulate 30 pinch-zoom touchmove events (200Hz burst)
    touchStartHandler!({
      touches: [
        { clientX: 140, clientY: 450 },
        { clientX: 260, clientY: 450 },
      ],
    });
    for (let i = 1; i <= 30; i++) {
      touchMoveHandler!({
        touches: [
          { clientX: 140 - i * 2.5, clientY: 450 },
          { clientX: 260 + i * 2.5, clientY: 450 },
        ],
      });
    }
    touchEndHandler!({ touches: [], changedTouches: [{ clientX: 65, clientY: 450 }] });

    expect(camera.zoom).toBeGreaterThan(1.5);

    // 2) Simulate 30 horizontal pan touchmove events while zoomed in
    touchStartHandler!({
      touches: [{ clientX: 220, clientY: 500 }],
    });
    for (let i = 1; i <= 30; i++) {
      touchMoveHandler!({
        touches: [{ clientX: 220 - i * 4, clientY: 500 }],
      });
    }
    touchEndHandler!({ touches: [], changedTouches: [{ clientX: 100, clientY: 500 }] });

    // Touchmove MUST NOT synchronously run full render() on every Android high-Hz sample!
    expect(syncRenders).toBe(0);
  });

  it('bounds expensive Canvas2D shadowBlur and radialGradient calls per frame during zoomed panning on Lv.20', () => {
    const session = new GameSession(generateLevel(20));
    const snap = session.getSnapshot();
    const saveData = createDefaultSaveData();
    const assets = createMockAssets();
    const orderFlow = new OrderFlowTracker();
    const metrics: StageMetrics = {
      screenW: 412,
      screenH: 915,
      stageW: REF_W,
      stageH: REF_H,
      dpr: 2,
      scale: 412 / REF_W,
      offsetX: 0,
      offsetY: 0,
      safeTopOffset: 44,
      safeBottomOffset: 24,
    };
    const layout = computeHudLayout(metrics);

    // Warmup frame (builds static board cache when implemented)
    const warmupCounters: CtxPerfCounters = {
      drawImageCalls: 0,
      shadowBlurDraws: 0,
      radialGradientCalls: 0,
      fillCalls: 0,
    };
    const warmupCtx = createInstrumentedCtx(warmupCounters);
    const boardHits: HitRect[] = [];
    const hudHits: HitRect[] = [];
    const boardCache = new BoardWorldCache();
    const catCache = new DockedCatCache();

    const renderOneFrame = (ctx: any, camera: BoardCamera, isNavigating: boolean) => {
      boardHits.length = 0;
      hudHits.length = 0;
      renderBoardWorld({
        ctx,
        assets,
        metrics,
        snap,
        saveData,
        camera,
        activeModal: 'none',
        activeFlys: [],
        animTimeSec: 1.2,
        gameBubbleElapsedSec: 2,
        gamePetReactSec: 0,
        pointerX: 360,
        pointerY: 640,
        flashBlockerUids: new Set(),
        blockedShakeUid: null,
        blockedShakeOffsetPx: 0,
        boardHitRegions: boardHits,
        boardCache,
        isNavigating,
        onTapItem: () => {},
        onTapBox: () => {},
        onTapCat: () => {},
      });
      renderInGameHud({
        ctx,
        assets,
        layout,
        snap,
        roomName: '暖阳客厅',
        tintLabel: '晨光',
        accentColor: '#FC9651',
        activeModal: 'none',
        orderFlow,
        activeFlys: [],
        slotLandAtMs: new Map(),
        hudHitRegions: hudHits,
        onGoHome: () => {},
        onOpenSettings: () => {},
        onUnlockOrderBox: () => {},
        onFillOrderBox: () => {},
        onUnlockTraySlot: () => {},
        onTapBooster: () => {},
        onBoxSealedToast: () => {},
      });
      renderZoomControls({
        ctx,
        assets,
        metrics,
        layout,
        snap,
        activeModal: 'none',
        camera,
        hudHitRegions: hudHits,
        setCamera: () => {},
      });
      renderDockedCat({
        ctx,
        assets,
        metrics,
        layout,
        snap,
        saveData,
        activeModal: 'none',
        animTimeSec: 1.2,
        gameBubbleElapsedSec: 2,
        gamePetReactSec: 0,
        isNavigating,
        catCache,
        hudHitRegions: hudHits,
        onTapCat: () => {},
      });
    };

    renderOneFrame(warmupCtx, { zoom: 2.0, panX: 0, panY: 0 }, false);

    // Measure 10 steady-state zoomed pan frames (board items unchanged, only camera moves)
    const panCounters: CtxPerfCounters = {
      drawImageCalls: 0,
      shadowBlurDraws: 0,
      radialGradientCalls: 0,
      fillCalls: 0,
    };
    const panCtx = createInstrumentedCtx(panCounters);
    const FRAMES = 10;
    for (let f = 0; f < FRAMES; f++) {
      renderOneFrame(panCtx, { zoom: 2.0, panX: -0.2 + f * 0.04, panY: 0.05 }, true);
    }

    const avgDrawImage = panCounters.drawImageCalls / FRAMES;
    const avgShadowBlur = panCounters.shadowBlurDraws / FRAMES;
    const avgRadialGrad = panCounters.radialGradientCalls / FRAMES;

    console.info(
      `[Perf Baseline/Check] Lv.20 (${snap.items.length} items) zoomed pan avg/frame: drawImage=${avgDrawImage.toFixed(1)}, shadowBlurDraws=${avgShadowBlur.toFixed(1)}, radialGradients=${avgRadialGrad.toFixed(1)}`
    );

    // Budget for smooth 60fps on mid-range Android Canvas2D:
    // - Static board cached into offscreen canvas => < 25 drawImage calls total (board blit + HUD icons + cat blit)
    // - Zero per-item/per-card shadowBlur during steady-state zoomed pan (<= 2 total)
    // - Zero per-pile radialGradient allocations during steady-state zoomed pan (<= 2 total)
    expect(avgDrawImage).toBeLessThanOrEqual(28);
    expect(avgShadowBlur).toBeLessThanOrEqual(2);
    expect(avgRadialGrad).toBeLessThanOrEqual(2);
  });

  it('keeps the in-level cat fixed in the screen-space bottom-right corner regardless of camera zoom/pan', () => {
    const session = new GameSession(generateLevel(1));
    const snap = session.getSnapshot();
    const saveData = createDefaultSaveData();
    const assets = createMockAssets();
    const metrics: StageMetrics = {
      screenW: 412,
      screenH: 915,
      stageW: REF_W,
      stageH: REF_H,
      dpr: 2,
      scale: 412 / REF_W,
      offsetX: 0,
      offsetY: 0,
      safeTopOffset: 44,
      safeBottomOffset: 24,
    };
    const layout = computeHudLayout(metrics);
    const pos = computeDockedCatPosition(metrics, layout);

    // Bottom-right corner cleanly above the bottom boosters bar AND its protruding top count badge (boostersY - 8)
    const catBadgeBottom = pos.cy + pos.size * 0.34 + 26;
    const catBitmapBottom = pos.cy + pos.size * 1.14 * 0.5;
    expect(pos.cx).toBeGreaterThan(metrics.stageW * 0.8);
    expect(pos.cx).toBeLessThan(metrics.stageW - 40);
    expect(catBadgeBottom).toBeLessThanOrEqual(layout.boostersY - 30);
    expect(catBitmapBottom).toBeLessThanOrEqual(layout.boostersY - 30);
    expect(pos.cy).toBeGreaterThan(layout.boostersY - 160);

    const counters: CtxPerfCounters = {
      drawImageCalls: 0,
      shadowBlurDraws: 0,
      radialGradientCalls: 0,
      fillCalls: 0,
    };
    const ctx = createInstrumentedCtx(counters);
    const hudHitsA: HitRect[] = [];
    const hitA = renderDockedCat({
      ctx,
      assets,
      metrics,
      layout,
      snap,
      saveData,
      activeModal: 'none',
      animTimeSec: 0.5,
      gameBubbleElapsedSec: 1,
      gamePetReactSec: 0,
      hudHitRegions: hudHitsA,
      onTapCat: () => {},
    });

    // Mutate pet world coords as if cat mischief / movePetTo ran; docked HUD corner must NOT drift
    session.movePetTo(0.18, 0.35);
    const movedSnap = session.getSnapshot();
    const hudHitsB: HitRect[] = [];
    const hitB = renderDockedCat({
      ctx,
      assets,
      metrics,
      layout,
      snap: movedSnap,
      saveData,
      activeModal: 'none',
      animTimeSec: 0.9,
      gameBubbleElapsedSec: 1.4,
      gamePetReactSec: 0,
      hudHitRegions: hudHitsB,
      onTapCat: () => {},
    });

    expect(hitA).toBeTruthy();
    expect(hitB).toBeTruthy();
    expect(hitB!.x).toBe(hitA!.x);
    expect(hitB!.y).toBe(hitA!.y);
    expect(hudHitsB.length).toBe(1);
  });

  it('never randomly unblocks buried items during idle ticks and blocks visually covered lower items', () => {
    // 1) Idle ticks on Lv.2 & Lv.5 must NOT silently teleport items or unlock buried items
    for (const lv of [2, 5]) {
      const session = new GameSession(generateLevel(lv));
      const initialBlocked = new Set(
        session
          .getSnapshot()
          .items.filter((it) => it.state === 'on_board' && it.blockedBy.length > 0)
          .map((it) => it.uid)
      );
      for (let i = 0; i < 90; i++) {
        session.tick(0.5);
      }
      const newlyUnblocked = session
        .getSnapshot()
        .items.filter(
          (it) => it.state === 'on_board' && it.blockedBy.length === 0 && initialBlocked.has(it.uid)
        );
      expect(newlyUnblocked).toEqual([]);
    }

    // 2) No unblocked item should have >= 18% of its rotated visual core covered by a higher item
    for (const lv of [1, 2, 5, 10, 20]) {
      const gen = generateLevel(lv);
      const onBoard = gen.initialItems
        .filter((it) => it.state === 'on_board')
        .sort(compareBoardItemOrder);
      let missedCount = 0;
      for (let i = 0; i < onBoard.length; i++) {
        const low = onBoard[i];
        if (low.blockedBy.length > 0) continue;
        const lowExt = getItemHalfExtentsRef(low);
        const lowArea = 4 * lowExt.rx * lowExt.ry;
        for (let j = i + 1; j < onBoard.length; j++) {
          const up = onBoard[j];
          const upExt = getItemHalfExtentsRef(up);
          const dx = Math.abs((low.x - up.x) * 720);
          const dy = Math.abs((low.y - up.y) * 1280 - (low.layer - up.layer) * 4.5);
          const ow = lowExt.rx + upExt.rx - dx;
          const oh = lowExt.ry + upExt.ry - dy;
          if (ow > 0 && oh > 0 && (ow * oh) / Math.max(1, lowArea) >= 0.18) {
            missedCount += 1;
            break;
          }
        }
      }
      expect(missedCount).toBe(0);
    }
  });
});

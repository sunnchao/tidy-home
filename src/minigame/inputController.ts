import {
  type BoardCamera,
  MIN_ZOOM,
  panCameraBy,
  pinchDistance,
  pinchMidpoint,
  viewportToBoard,
  zoomCameraTo,
} from '@core/camera';
import type { GameSession } from '@core/gameSession';
import { isTransitionBlockingInput, type SceneTransitionState } from '@core/transition';
import type { SessionSnapshot } from '@core/types';
import {
  countActiveTouches,
  extractActiveTouchPoints,
  extractTouchPoint,
  extractTouchPoints,
  hitRegionAt,
  isDuplicateTap,
  isRecentTap,
  type Point,
  screenToLogic,
  type TapStamp,
} from './input';
import {
  type HitRect,
  type MiniGameModal,
  type MiniGameScreen,
  type PendingBoardTouch,
  type StageMetrics,
} from './types';

export interface MiniGameInputDeps {
  api: any;
  canvas: any;
  getMetrics: () => StageMetrics;
  getScreen: () => MiniGameScreen;
  getActiveModal: () => MiniGameModal;
  getSession: () => GameSession | undefined;
  getTransitionState: () => SceneTransitionState;
  getCamera: () => BoardCamera;
  setCamera: (next: BoardCamera) => void;
  getHitRegions: () => {
    hud: HitRect[];
    board: HitRect[];
    cat: HitRect | null;
    boardClipTopY: number;
    boardClipBottomY: number;
  };
  setPointer: (pt: Point) => void;
  setTapRipple: (pt: Point, atMs: number) => void;
  onRender: (snap: SessionSnapshot) => void;
  onNavigationStateChange?: (active: boolean) => void;
}

export function bindMiniGameTouch(deps: MiniGameInputDeps): void {
  let lastTapLogic: TapStamp | null = null;
  let lastWxTouchMs = 0;
  let pendingBoardTouch: PendingBoardTouch | null = null;
  let pinchActive = false;
  let pinchStartDist = 0;
  let pinchStartZoom = 1;
  let isNavigating = false;
  let cachedCanvasRect: { left: number; top: number; width: number; height: number } | null = null;

  const setNavigating = (next: boolean) => {
    if (isNavigating === next) return;
    isNavigating = next;
    deps.onNavigationStateChange?.(next);
  };

  const refreshCanvasRect = () => {
    cachedCanvasRect = null;
    try {
      if (deps.canvas && typeof deps.canvas.getBoundingClientRect === 'function') {
        const rect = deps.canvas.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          cachedCanvasRect = {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          };
        }
      }
    } catch {
      cachedCanvasRect = null;
    }
  };

  const toLogic = (rawX: number, rawY: number): Point => {
    const metrics = deps.getMetrics();
    let localX = rawX;
    let localY = rawY;
    if (cachedCanvasRect) {
      localX = ((rawX - cachedCanvasRect.left) / cachedCanvasRect.width) * metrics.screenW;
      localY = ((rawY - cachedCanvasRect.top) / cachedCanvasRect.height) * metrics.screenH;
    }
    return screenToLogic({ x: localX, y: localY }, metrics);
  };

  const canRunZoomGesture = (): boolean => {
    if (deps.getScreen() !== 'game' || deps.getActiveModal() !== 'none') return false;
    const session = deps.getSession();
    return Boolean(session && (typeof session.isPlaying === 'function' ? session.isPlaying() : true));
  };

  const invokeTapRegion = (region: HitRect, screenPt: Point, now: number): void => {
    lastTapLogic = { atMs: now, x: screenPt.x, y: screenPt.y };
    deps.setPointer(screenPt);
    deps.setTapRipple(screenPt, now);
    try {
      region.onTap();
    } catch (err) {
      console.error('[TidyHome] tap handler error:', err);
    }
    const session = deps.getSession();
    if (session) {
      deps.onRender(session.getSnapshot());
    }
  };

  const resetGestures = () => {
    pendingBoardTouch = null;
    pinchActive = false;
    setNavigating(false);
  };

  const onStart = (res: any, fromTouch: boolean) => {
    const now = Date.now();
    if (fromTouch) {
      lastWxTouchMs = now;
    } else if (now - lastWxTouchMs < 240) {
      return;
    }
    if (isTransitionBlockingInput(deps.getTransitionState())) return;

    refreshCanvasRect();
    const activePts = extractActiveTouchPoints(res);
    const rawPts = activePts.length > 0 ? activePts : extractTouchPoints(res);
    if (rawPts.length === 0) return;

    const canZoomGesture = canRunZoomGesture();
    const regions = deps.getHitRegions();

    if (fromTouch && (activePts.length >= 2 || countActiveTouches(res) >= 2) && canZoomGesture) {
      const pts = activePts.length >= 2 ? activePts : rawPts;
      const p1 = toLogic(pts[0].x, pts[0].y);
      const p2 = toLogic(pts[1].x, pts[1].y);
      pinchActive = true;
      pinchStartDist = Math.max(14, pinchDistance(p1, p2));
      pinchStartZoom = deps.getCamera().zoom;
      pendingBoardTouch = null;
      setNavigating(true);
      return;
    }

    if (fromTouch && countActiveTouches(res) < 2) {
      pinchActive = false;
    } else if (!fromTouch) {
      pinchActive = false;
    }

    const pt = toLogic(rawPts[0].x, rawPts[0].y);
    deps.setPointer(pt);

    const hudHit = hitRegionAt(regions.hud, pt);
    if (hudHit) {
      resetGestures();
      if (isRecentTap(now, lastTapLogic) || isDuplicateTap(now, pt, lastTapLogic)) return;
      invokeTapRegion(hudHit, pt, now);
      return;
    }

    if (canZoomGesture) {
      pendingBoardTouch = {
        startX: pt.x,
        startY: pt.y,
        startCam: { ...deps.getCamera() },
        moved: false,
      };
    } else {
      if (isRecentTap(now, lastTapLogic) || isDuplicateTap(now, pt, lastTapLogic)) return;
      lastTapLogic = { atMs: now, x: pt.x, y: pt.y };
      deps.setTapRipple(pt, now);
    }
  };

  const onMove = (res: any, fromTouch: boolean) => {
    const now = Date.now();
    if (!fromTouch && now - lastWxTouchMs < 240) return;
    if (isTransitionBlockingInput(deps.getTransitionState())) return;

    const activePts = extractActiveTouchPoints(res);
    const rawPts = activePts.length > 0 ? activePts : !fromTouch ? extractTouchPoints(res) : [];
    const canZoomGesture = canRunZoomGesture();
    const metrics = deps.getMetrics();

    if (fromTouch && activePts.length >= 2 && canZoomGesture) {
      const p1 = toLogic(activePts[0].x, activePts[0].y);
      const p2 = toLogic(activePts[1].x, activePts[1].y);
      const curDist = pinchDistance(p1, p2);
      const mid = pinchMidpoint(p1, p2);
      if (!pinchActive) {
        pinchActive = true;
        pinchStartDist = Math.max(14, curDist);
        pinchStartZoom = deps.getCamera().zoom;
        pendingBoardTouch = null;
        setNavigating(true);
      } else {
        // Coalesce into next requestAnimationFrame render — NEVER run full render() inside touchmove!
        deps.setCamera(
          zoomCameraTo(
            deps.getCamera(),
            pinchStartZoom * (curDist / pinchStartDist),
            mid.x / metrics.stageW,
            mid.y / metrics.stageH
          )
        );
      }
      return;
    }

    if (rawPts.length === 0) return;
    const pt = toLogic(rawPts[0].x, rawPts[0].y);
    deps.setPointer(pt);

    if (pendingBoardTouch && canZoomGesture && deps.getCamera().zoom > MIN_ZOOM + 0.01) {
      const dx = pt.x - pendingBoardTouch.startX;
      const dy = pt.y - pendingBoardTouch.startY;
      if (!pendingBoardTouch.moved && Math.hypot(dx, dy) >= 22) {
        pendingBoardTouch.moved = true;
        setNavigating(true);
      }
      if (pendingBoardTouch.moved) {
        deps.setCamera(
          panCameraBy(pendingBoardTouch.startCam, dx / metrics.stageW, dy / metrics.stageH)
        );
      }
    }
  };

  const onEnd = (res: any, fromTouch: boolean) => {
    const now = Date.now();
    if (!fromTouch && now - lastWxTouchMs < 240) return;

    if (fromTouch && pinchActive) {
      if (countActiveTouches(res) < 2) {
        pinchActive = false;
        setNavigating(false);
      }
      pendingBoardTouch = null;
      return;
    }
    if (!fromTouch) {
      pinchActive = false;
    }

    const regions = deps.getHitRegions();
    const metrics = deps.getMetrics();

    const pbt = pendingBoardTouch;
    pendingBoardTouch = null;
    setNavigating(false);
    if (!pbt || pbt.moved || isTransitionBlockingInput(deps.getTransitionState())) return;

    const raw = extractTouchPoint(res);
    const pt = raw ? toLogic(raw.x, raw.y) : { x: pbt.startX, y: pbt.startY };
    if (isRecentTap(now, lastTapLogic) || isDuplicateTap(now, pt, lastTapLogic)) return;

    if (pt.y < regions.boardClipTopY || pt.y > regions.boardClipBottomY) {
      return;
    }

    const boardNorm = viewportToBoard(
      { x: pt.x / metrics.stageW, y: pt.y / metrics.stageH },
      deps.getCamera()
    );
    const boardPt = { x: boardNorm.x * metrics.stageW, y: boardNorm.y * metrics.stageH };
    const boardHit = hitRegionAt(regions.board, boardPt);
    if (boardHit) {
      invokeTapRegion(boardHit, pt, now);
    } else {
      lastTapLogic = { atMs: now, x: pt.x, y: pt.y };
      deps.setTapRipple(pt, now);
    }
  };

  if (typeof deps.api?.onTouchStart === 'function') {
    deps.api.onTouchStart((res: any) => onStart(res, true));
  }
  if (typeof deps.api?.onTouchMove === 'function') {
    deps.api.onTouchMove((res: any) => onMove(res, true));
  }
  if (typeof deps.api?.onTouchEnd === 'function') {
    deps.api.onTouchEnd((res: any) => onEnd(res, true));
  }
  if (typeof deps.api?.onTouchCancel === 'function') {
    deps.api.onTouchCancel(resetGestures);
  }
  if (typeof deps.api?.onMouseDown === 'function') {
    deps.api.onMouseDown((res: any) => onStart(res, false));
  }
  if (typeof deps.api?.onMouseMove === 'function') {
    deps.api.onMouseMove((res: any) => onMove(res, false));
  }
  if (typeof deps.api?.onMouseUp === 'function') {
    deps.api.onMouseUp((res: any) => onEnd(res, false));
  }
  if (typeof deps.canvas?.addEventListener === 'function') {
    deps.canvas.addEventListener('touchstart', (e: any) => onStart(e, true));
    deps.canvas.addEventListener('touchmove', (e: any) => onMove(e, true));
    deps.canvas.addEventListener('touchend', (e: any) => onEnd(e, true));
    deps.canvas.addEventListener('touchcancel', resetGestures);
    deps.canvas.addEventListener('mousedown', (e: any) => onStart(e, false));
    deps.canvas.addEventListener('mousemove', (e: any) => onMove(e, false));
    deps.canvas.addEventListener('mouseup', (e: any) => onEnd(e, false));
  }
}

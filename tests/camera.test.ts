import { describe, expect, it } from 'vitest';
import {
  boardToViewport,
  clampCamera,
  createDefaultCamera,
  MAX_ZOOM,
  MIN_ZOOM,
  panCameraBy,
  pinchDistance,
  pinchMidpoint,
  viewportToBoard,
  zoomCameraBy,
  zoomCameraTo,
} from '@core/camera';

describe('Bounded In-Level Board Camera', () => {
  it('enforces strict min/max zoom limits (never infinite zoom)', () => {
    const cam = createDefaultCamera();
    expect(cam.zoom).toBe(MIN_ZOOM);

    const zoomedOut = zoomCameraBy(cam, -5);
    expect(zoomedOut.zoom).toBe(MIN_ZOOM);
    expect(zoomedOut.panX).toBe(0);
    expect(zoomedOut.panY).toBe(0);

    const overZoomed = zoomCameraTo(cam, 99);
    expect(overZoomed.zoom).toBe(MAX_ZOOM);

    const clamped = clampCamera({ zoom: 12, panX: 5, panY: -5 });
    expect(clamped.zoom).toBe(MAX_ZOOM);
    expect(clamped.panX).toBeLessThanOrEqual(0.5 * (MAX_ZOOM - 1) + 1e-6);
    expect(clamped.panY).toBeGreaterThanOrEqual(-(1 - 0.56) * (MAX_ZOOM - 1) - 1e-6);
  });

  it('keeps board edges inside viewport when panning and resets pan at 1.0x', () => {
    const zoomed = zoomCameraTo(createDefaultCamera(), 2.0, 0.5, 0.56);
    const pannedFarLeft = panCameraBy(zoomed, 10, 10);
    const topLeftBoardInVp = boardToViewport({ x: 0, y: 0 }, pannedFarLeft);
    const botRightBoardInVp = boardToViewport({ x: 1, y: 1 }, pannedFarLeft);
    expect(topLeftBoardInVp.x).toBeLessThanOrEqual(1e-6);
    expect(topLeftBoardInVp.y).toBeLessThanOrEqual(1e-6);
    expect(botRightBoardInVp.x).toBeGreaterThanOrEqual(1 - 1e-6);
    expect(botRightBoardInVp.y).toBeGreaterThanOrEqual(1 - 1e-6);

    const pannedFarRight = panCameraBy(zoomed, -10, -10);
    const tl2 = boardToViewport({ x: 0, y: 0 }, pannedFarRight);
    const br2 = boardToViewport({ x: 1, y: 1 }, pannedFarRight);
    expect(tl2.x).toBeLessThanOrEqual(1e-6);
    expect(tl2.y).toBeLessThanOrEqual(1e-6);
    expect(br2.x).toBeGreaterThanOrEqual(1 - 1e-6);
    expect(br2.y).toBeGreaterThanOrEqual(1 - 1e-6);

    const backToOne = zoomCameraTo(pannedFarRight, 1.0);
    expect(backToOne).toEqual({ zoom: 1, panX: 0, panY: 0 });
  });

  it('round-trips boardToViewport and viewportToBoard and preserves focal point on zoom', () => {
    const cam = clampCamera({ zoom: 1.75, panX: 0.14, panY: -0.09 });
    const pt = { x: 0.32, y: 0.61 };
    const vp = boardToViewport(pt, cam);
    const recovered = viewportToBoard(vp, cam);
    expect(recovered.x).toBeCloseTo(pt.x, 5);
    expect(recovered.y).toBeCloseTo(pt.y, 5);

    const focal = { x: 0.35, y: 0.52 };
    const beforeBoard = viewportToBoard(focal, cam);
    const zoomed = zoomCameraTo(cam, 2.0, focal.x, focal.y);
    const afterBoard = viewportToBoard(focal, zoomed);
    expect(afterBoard.x).toBeCloseTo(beforeBoard.x, 2);
    expect(afterBoard.y).toBeCloseTo(beforeBoard.y, 2);
  });

  it('computes pinch distance and midpoint accurately', () => {
    expect(pinchDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(pinchMidpoint({ x: 10, y: 20 }, { x: 30, y: 60 })).toEqual({ x: 20, y: 40 });
  });
});

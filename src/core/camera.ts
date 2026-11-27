export const MIN_ZOOM = 1.0;
export const MAX_ZOOM = 2.2;
export const ZOOM_STEP = 0.3;
export const CAMERA_PIVOT_X = 0.5;
export const CAMERA_PIVOT_Y = 0.56;

export interface BoardCamera {
  zoom: number;
  panX: number;
  panY: number;
}

export interface NormPoint {
  x: number;
  y: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function createDefaultCamera(): BoardCamera {
  return { zoom: MIN_ZOOM, panX: 0, panY: 0 };
}

/**
 * Clamps zoom to [MIN_ZOOM, MAX_ZOOM] and pan offsets so the room [0,1]x[0,1]
 * always covers the viewport around (CAMERA_PIVOT_X, CAMERA_PIVOT_Y) with zero empty margins.
 */
export function clampCamera(cam: BoardCamera): BoardCamera {
  const rawZoom = Number.isFinite(cam.zoom) ? cam.zoom : MIN_ZOOM;
  const zoom = Number(clamp(rawZoom, MIN_ZOOM, MAX_ZOOM).toFixed(4));
  if (zoom <= MIN_ZOOM + 1e-4) {
    return { zoom: MIN_ZOOM, panX: 0, panY: 0 };
  }

  const minPanX = -(1 - CAMERA_PIVOT_X) * (zoom - 1);
  const maxPanX = CAMERA_PIVOT_X * (zoom - 1);
  const minPanY = -(1 - CAMERA_PIVOT_Y) * (zoom - 1);
  const maxPanY = CAMERA_PIVOT_Y * (zoom - 1);

  return {
    zoom,
    panX: clamp(Number.isFinite(cam.panX) ? cam.panX : 0, minPanX, maxPanX),
    panY: clamp(Number.isFinite(cam.panY) ? cam.panY : 0, minPanY, maxPanY),
  };
}

/** Projects normalized board coordinates [0..1] into viewport coordinates [0..1]. */
export function boardToViewport(pt: NormPoint, cam: BoardCamera): NormPoint {
  return {
    x: CAMERA_PIVOT_X + (pt.x - CAMERA_PIVOT_X) * cam.zoom + cam.panX,
    y: CAMERA_PIVOT_Y + (pt.y - CAMERA_PIVOT_Y) * cam.zoom + cam.panY,
  };
}

/** Converts viewport coordinates [0..1] back to normalized board coordinates [0..1]. */
export function viewportToBoard(pt: NormPoint, cam: BoardCamera): NormPoint {
  const safeZoom = Math.max(MIN_ZOOM, cam.zoom);
  return {
    x: CAMERA_PIVOT_X + (pt.x - CAMERA_PIVOT_X - cam.panX) / safeZoom,
    y: CAMERA_PIVOT_Y + (pt.y - CAMERA_PIVOT_Y - cam.panY) / safeZoom,
  };
}

/** Zooms to `targetZoom` while anchoring the board point currently under `(focalVx, focalVy)`. */
export function zoomCameraTo(
  cam: BoardCamera,
  targetZoom: number,
  focalVx = CAMERA_PIVOT_X,
  focalVy = CAMERA_PIVOT_Y
): BoardCamera {
  const clampedTarget = clamp(targetZoom, MIN_ZOOM, MAX_ZOOM);
  const anchor = viewportToBoard({ x: focalVx, y: focalVy }, cam);
  const nextPanX = focalVx - CAMERA_PIVOT_X - (anchor.x - CAMERA_PIVOT_X) * clampedTarget;
  const nextPanY = focalVy - CAMERA_PIVOT_Y - (anchor.y - CAMERA_PIVOT_Y) * clampedTarget;
  return clampCamera({
    zoom: clampedTarget,
    panX: nextPanX,
    panY: nextPanY,
  });
}

export function zoomCameraBy(
  cam: BoardCamera,
  deltaZoom: number,
  focalVx = CAMERA_PIVOT_X,
  focalVy = CAMERA_PIVOT_Y
): BoardCamera {
  return zoomCameraTo(cam, cam.zoom + deltaZoom, focalVx, focalVy);
}

export function panCameraBy(cam: BoardCamera, deltaVx: number, deltaVy: number): BoardCamera {
  return clampCamera({
    zoom: cam.zoom,
    panX: cam.panX + deltaVx,
    panY: cam.panY + deltaVy,
  });
}

export function pinchDistance(p1: NormPoint, p2: NormPoint): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

export function pinchMidpoint(p1: NormPoint, p2: NormPoint): NormPoint {
  return {
    x: (p1.x + p2.x) * 0.5,
    y: (p1.y + p2.y) * 0.5,
  };
}

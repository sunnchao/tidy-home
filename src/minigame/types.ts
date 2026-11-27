import { type BoardCamera, CAMERA_PIVOT_X, CAMERA_PIVOT_Y } from '@core/camera';
import type { Point } from './input';

export const REF_W = 720;
export const REF_H = 1280;

export type MiniGameScreen = 'home' | 'game';
export type MiniGameModal =
  | 'none'
  | 'daily'
  | 'cat_ad'
  | 'no_lives'
  | 'settings'
  | 'rooms'
  | 'help'
  | 'privacy';

export interface HitRect {
  x: number;
  y: number;
  w: number;
  h: number;
  onTap: () => void;
  containsPoint?: (pt: Point) => boolean;
}

export interface PendingBoardTouch {
  startX: number;
  startY: number;
  startCam: BoardCamera;
  moved: boolean;
}

export interface StageMetrics {
  screenW: number;
  screenH: number;
  stageW: number;
  stageH: number;
  dpr: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  safeTopOffset: number;
  safeBottomOffset: number;
}

export interface HudLayout {
  ox: number;
  topY: number;
  barY: number;
  orderY: number;
  bottomMargin: number;
  boostersY: number;
  trayRowY: number;
  boardClipTopY: number;
  boardClipBottomY: number;
}

export interface TapRipple {
  x: number;
  y: number;
  atMs: number;
}

export interface ToastState {
  text: string;
  untilMs: number;
}

export function computeHudLayout(metrics: StageMetrics): HudLayout {
  const ox = (metrics.stageW - REF_W) * 0.5;
  const topY = Math.max(14, metrics.safeTopOffset);
  const barY = topY + 50;
  const orderY = barY + 28;
  const trayRowY = orderY + 132;
  const bottomMargin = Math.max(12, metrics.safeBottomOffset + 10);
  const boostersY = Math.round(metrics.stageH - bottomMargin - 64);
  return {
    ox,
    topY,
    barY,
    orderY,
    bottomMargin,
    boostersY,
    trayRowY,
    boardClipTopY: trayRowY + 102,
    boardClipBottomY: boostersY - 8,
  };
}

export function getOrderSlotCenter(layout: HudLayout, slotIndex: number): Point {
  const bx = layout.ox + 20 + slotIndex * 230;
  return { x: bx + 48, y: layout.orderY + 44 };
}

export function getTraySlotCenter(layout: HudLayout, trayIndex: number): Point {
  const tx = layout.ox + 30 + trayIndex * 95;
  return { x: tx + 42, y: layout.trayRowY + 52 };
}

export function boardItemPos(stageW: number, stageH: number, nx: number, ny: number): Point {
  const ox = (stageW - REF_W) * 0.5;
  return {
    x: ox + nx * REF_W,
    y: ny * stageH,
  };
}

export function boardNormToStage(
  stageW: number,
  stageH: number,
  camera: BoardCamera,
  nx: number,
  ny: number
): Point {
  const base = boardItemPos(stageW, stageH, nx, ny);
  const px = CAMERA_PIVOT_X * stageW;
  const py = CAMERA_PIVOT_Y * stageH;
  return {
    x: px + camera.panX * stageW + (base.x - px) * camera.zoom,
    y: py + camera.panY * stageH + (base.y - py) * camera.zoom,
  };
}

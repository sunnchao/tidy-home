import type { PetCatState, RoomThemeId } from './types';

export type CatVisualMood = PetCatState['mood'];

export interface HomeCatDialogueContext {
  roomTheme: RoomThemeId;
  currentLevel: number;
  totalLevelsCleared: number;
  petTreats: number;
  canClaimDailyFree: boolean;
  coins?: number;
  lives?: number;
  canClaimShare?: boolean;
}

export interface CatRenderOptions {
  timeSec: number;
  mood?: CatVisualMood;
  talking?: boolean;
  petReactionProgress?: number;
}

export interface SpeechBubbleRenderOptions {
  text: string;
  typedChars: number;
  anchorX: number;
  bottomY: number;
  timeSec: number;
  stageWidth: number;
  popProgress?: number;
  fontSize?: number;
  maxWidth?: number;
  pointerTargetX?: number;
}

export const TYPEWRITER_CHARS_PER_SEC = 22;
export const HOME_DIALOGUE_INTERVAL_SEC = 5.4;
export const PET_REACTION_DURATION_SEC = 0.72;

const ROOM_LINES: Record<RoomThemeId, string[]> = {
  living_room: [
    '喵～ 今天也一起把暖阳客厅收拾得干干净净吧!',
    '沙发抱枕和毛线球我都替你盯好位置啦～',
  ],
  bathroom: [
    '哗啦啦～ 泡泡浴室好清凉呀，一起把香皂和浴巾排排好!',
    '浴缸边和洗漱台上堆了不少宝贝，放大看更清楚哟～',
  ],
  study: [
    '喵呜～ 森林画室的绿地毯好舒服呀，画笔和手账本都备好啦!',
    '书架和画桌上的小工具超多，喂我猫条帮你精准找出来～',
  ],
  cafe: [
    '咪呜! 樱花甜品屋甜甜香香的，马卡龙和奶茶别弄混啦～',
    '露台圆桌堆满甜点咯，闯关多攒金币来给我买猫条吧!',
  ],
  kitchen: [
    '喵呜! 阳光厨房好香呀，猫粮罐头先归我管～',
    '餐桌和地垫上的小物件，一起打包清爽起来吧!',
  ],
  bedroom: [
    '呼噜噜～ 梦幻卧室软乎乎的，最适合慢慢整理啦!',
    '床头的小台灯和玩偶都在等你归位哟～',
  ],
};

const TAP_REACTION_LINES: string[] = [
  '呼噜噜～ 摸得我尾巴都翘起来啦!',
  '喵呜～ 蹭蹭手心，今天手气一定超顺!',
  '咪～ 再挠挠下巴，进关我给你叼宝贝!',
  '呼噜呼噜～ 本喵随时准备出发帮忙啦!',
];

export function buildHomeCatLines(ctx: HomeCatDialogueContext): string[] {
  const lines: string[] = [...ROOM_LINES[ctx.roomTheme]];
  if (ctx.canClaimDailyFree) {
    lines.push('喵!「猫条小铺」还有每日免费猫条+金币没领，快去看看～');
  }
  if (ctx.canClaimShare) {
    lines.push('分享给好友并收到平台的成功确认后，可以领 1 根猫条。');
  }
  if (ctx.petTreats > 0) {
    lines.push(`兜里还有 ${ctx.petTreats} 根猫条，关卡里摸我两下替你寻物!`);
  } else if ((ctx.coins ?? 0) >= 50) {
    lines.push(`身上有 ${ctx.coins} 金币啦，去小铺买根猫条我就能帮你找物品!`);
  } else {
    lines.push('闯关打包赚金币就能买猫条，攒够随时喊我帮忙找物品～');
  }
  if (ctx.totalLevelsCleared === 0) {
    lines.push('点我也可以撸猫互动哦，准备好就开启第 1 关吧!');
  } else {
    lines.push(`已经整理好 ${ctx.totalLevelsCleared} 个房间啦，第 ${ctx.currentLevel} 关继续冲!`);
  }
  return lines;
}

export function pickTapReactionLine(tapIndex: number): string {
  const idx = Math.abs(Math.floor(tapIndex)) % TAP_REACTION_LINES.length;
  return TAP_REACTION_LINES[idx];
}

export function sliceTypedText(fullText: string, elapsedSec: number, charsPerSec = TYPEWRITER_CHARS_PER_SEC): {
  visibleText: string;
  typedChars: number;
  totalChars: number;
  typing: boolean;
} {
  const codePoints = Array.from(fullText);
  const totalChars = codePoints.length;
  if (totalChars === 0) {
    return { visibleText: '', typedChars: 0, totalChars: 0, typing: false };
  }
  const count = Math.max(1, Math.min(totalChars, Math.floor(Math.max(0, elapsedSec) * charsPerSec) + 1));
  return {
    visibleText: codePoints.slice(0, count).join(''),
    typedChars: count,
    totalChars,
    typing: count < totalChars,
  };
}

/** Computes smooth periodic blink amount in [0, 1]. */
export function computeBlinkFactor(timeSec: number): number {
  const period = 3.6;
  const windowSec = 0.17;
  const phase = ((timeSec % period) + period) % period;
  if (phase < windowSec) {
    return Math.sin((phase / windowSec) * Math.PI);
  }
  // Occasional double-blink every second cycle
  const cycleIndex = Math.floor(Math.max(0, timeSec) / period);
  if (cycleIndex % 2 === 1) {
    const secondStart = 0.28;
    if (phase >= secondStart && phase < secondStart + windowSec) {
      return Math.sin(((phase - secondStart) / windowSec) * Math.PI);
    }
  }
  return 0;
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawHeart(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  colorLight: string,
  colorDeep: string,
  alpha = 1
): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy);
  ctx.scale(size / 32, size / 32);
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.bezierCurveTo(-16, 2, -18, -12, -8, -12);
  ctx.bezierCurveTo(-2, -12, 0, -6, 0, -4);
  ctx.bezierCurveTo(0, -6, 2, -12, 8, -12);
  ctx.bezierCurveTo(18, -12, 16, 2, 0, 12);
  ctx.closePath();
  const grad = ctx.createRadialGradient(-4, -6, 2, 0, 2, 18);
  grad.addColorStop(0, colorLight);
  grad.addColorStop(1, colorDeep);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(166, 56, 62, 0.28)';
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.beginPath();
  ctx.ellipse(-6.5, -5.5, 3.2, 1.8, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Renders a soft lineless 3D plush painted orange tabby mascot onto a 2D canvas context.
 * Coordinates match a 256x256 design grid scaled into `size` around `(cx, cy)`.
 */
export function drawAnimatedCat(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  opts: CatRenderOptions
): void {
  const t = opts.timeSec;
  const mood: CatVisualMood = opts.mood ?? 'idle';
  const react = Math.max(0, Math.min(1, opts.petReactionProgress ?? 0));
  const happyActive = mood === 'pleased' || react > 0.02;
  const mischiefActive = mood === 'mischief' && react <= 0.02;

  const BROW_BROWN = '#5A3928';
  const RIM_WARM = 'rgba(145, 78, 34, 0.28)';
  const CREAM_TOP = '#FFFDF7';
  const CREAM_BOT = '#F3DFBE';

  const breathFreq = mischiefActive ? 6.2 : happyActive ? 3.8 : 2.5;
  const breath = Math.sin(t * breathFreq);
  const hop = react > 0 ? Math.sin(react * Math.PI) * 10 : 0;
  const bobY = breath * (mischiefActive ? 3.2 : 2.4) - hop;
  const squashX = 1 + breath * 0.018 + (react > 0 ? Math.sin(react * Math.PI * 2) * 0.035 : 0);
  const squashY = 1 - breath * 0.018 - (react > 0 ? Math.sin(react * Math.PI * 2) * 0.025 : 0);
  const headTilt =
    (mischiefActive ? Math.sin(t * 9) * 0.09 : Math.sin(t * 1.7) * 0.045) +
    (react > 0 ? Math.sin(react * Math.PI * 3) * 0.08 : 0);

  const blink = happyActive ? 1 : computeBlinkFactor(t);
  const tailSpeed = mischiefActive ? 9.5 : happyActive ? 7.2 : 3.4;
  const tailAmp = mischiefActive ? 22 : happyActive ? 18 : 13;
  const tailSwing = Math.sin(t * tailSpeed) * tailAmp;
  const earFlickL = Math.pow(Math.max(0, Math.sin(t * 2.3 + 0.6)), 10) * 0.16;
  const earFlickR = Math.pow(Math.max(0, Math.sin(t * 2.9 + 2.1)), 12) * 0.16;
  const talkOpen = opts.talking ? 0.35 + 0.65 * Math.abs(Math.sin(t * 13.5)) : 0;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size / 256, size / 256);
  ctx.translate(-128, -128);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Soft diffused contact shadow beneath paws
  const shadowScale = 1 - Math.max(0, -bobY) * 0.012;
  const shadowGrad = ctx.createRadialGradient(128, 218, 6, 128, 218, 72 * shadowScale);
  shadowGrad.addColorStop(0, 'rgba(64, 42, 28, 0.22)');
  shadowGrad.addColorStop(0.6, 'rgba(64, 42, 28, 0.10)');
  shadowGrad.addColorStop(1, 'rgba(64, 42, 28, 0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(128, 218, 72 * shadowScale, 16 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Plush wagging tail behind body
  const tailTipX = 198 + tailSwing * 0.85;
  const tailTipY = (mischiefActive ? 114 : 128) + Math.cos(t * tailSpeed) * 7;
  const tailCtrl1X = 218 + tailSwing * 0.45;
  const tailCtrl1Y = 188;
  const tailCtrl2X = 226 + tailSwing;
  const tailCtrl2Y = 136;

  ctx.beginPath();
  ctx.moveTo(172, 188 + bobY * 0.5);
  ctx.bezierCurveTo(tailCtrl1X, tailCtrl1Y, tailCtrl2X, tailCtrl2Y, tailTipX, tailTipY + bobY * 0.4);
  ctx.strokeStyle = 'rgba(155, 82, 32, 0.22)';
  ctx.lineWidth = 22;
  ctx.stroke();

  const tailGrad = ctx.createLinearGradient(170, 190, tailTipX, tailTipY);
  tailGrad.addColorStop(0, '#CF702A');
  tailGrad.addColorStop(0.65, '#F59E4E');
  tailGrad.addColorStop(1, '#FFCA88');
  ctx.beginPath();
  ctx.moveTo(172, 188 + bobY * 0.5);
  ctx.bezierCurveTo(tailCtrl1X, tailCtrl1Y, tailCtrl2X, tailCtrl2Y, tailTipX, tailTipY + bobY * 0.4);
  ctx.strokeStyle = tailGrad;
  ctx.lineWidth = 17;
  ctx.stroke();

  // Cream tip on tail
  ctx.fillStyle = '#FFF5E0';
  ctx.beginPath();
  ctx.arc(tailTipX, tailTipY + bobY * 0.4, 7.5, 0, Math.PI * 2);
  ctx.fill();

  // Plush body with 3D spherical fur gradient
  ctx.save();
  ctx.translate(128, 174 + bobY * 0.7);
  ctx.scale(squashX, squashY);

  const bodyGrad = ctx.createRadialGradient(-16, -24, 10, 0, 2, 62);
  bodyGrad.addColorStop(0, '#FFCC8C');
  bodyGrad.addColorStop(0.55, '#F29B4A');
  bodyGrad.addColorStop(1, '#C86D2A');
  ctx.beginPath();
  ctx.ellipse(0, -4, 54, 48, 0, 0, Math.PI * 2);
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = RIM_WARM;
  ctx.stroke();

  // Fluffy cream belly patch with soft radial feathering
  const bellyGrad = ctx.createRadialGradient(-4, -2, 4, 0, 8, 34);
  bellyGrad.addColorStop(0, CREAM_TOP);
  bellyGrad.addColorStop(0.75, '#FFF2DC');
  bellyGrad.addColorStop(1, CREAM_BOT);
  ctx.beginPath();
  ctx.ellipse(0, 8, 31, 30, 0, 0, Math.PI * 2);
  ctx.fillStyle = bellyGrad;
  ctx.fill();

  // Chin ambient occlusion shadow cast by head onto neck
  const neckAo = ctx.createRadialGradient(0, -34, 6, 0, -30, 42);
  neckAo.addColorStop(0, 'rgba(148, 68, 22, 0.30)');
  neckAo.addColorStop(1, 'rgba(148, 68, 22, 0)');
  ctx.fillStyle = neckAo;
  ctx.beginPath();
  ctx.ellipse(0, -32, 40, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Head + ears + face group
  ctx.save();
  ctx.translate(128, 114 + bobY);
  ctx.rotate(headTilt);

  // Soft rounded ears (no hard black border)
  for (const side of [-1, 1] as const) {
    ctx.save();
    ctx.translate(side * 40, -28);
    ctx.rotate(side === -1 ? -earFlickL : earFlickR);
    ctx.beginPath();
    ctx.moveTo(-18 * side, 14);
    ctx.quadraticCurveTo(-20 * side, -24, -10 * side, -40);
    ctx.quadraticCurveTo(-2 * side, -48, 22 * side, -12);
    ctx.closePath();
    const earGrad = ctx.createLinearGradient(-15 * side, -44, 15 * side, 10);
    earGrad.addColorStop(0, '#FFB974');
    earGrad.addColorStop(1, '#CE702C');
    ctx.fillStyle = earGrad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = RIM_WARM;
    ctx.stroke();

    // Inner recessed pink ear
    ctx.beginPath();
    ctx.moveTo(-12 * side, 4);
    ctx.quadraticCurveTo(-11 * side, -20, -4 * side, -28);
    ctx.quadraticCurveTo(3 * side, -30, 16 * side, -10);
    ctx.closePath();
    const innerEarGrad = ctx.createLinearGradient(0, -30, 0, 4);
    innerEarGrad.addColorStop(0, '#F09496');
    innerEarGrad.addColorStop(1, '#FFD2CF');
    ctx.fillStyle = innerEarGrad;
    ctx.fill();

    // Tiny cream ear tuft
    ctx.fillStyle = 'rgba(255, 246, 232, 0.78)';
    ctx.beginPath();
    ctx.ellipse(-2 * side, -4, 7, 3.5, -0.35 * side, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Soft chubby-cheeked head silhouette
  const headGrad = ctx.createRadialGradient(-20, -26, 8, 0, -4, 68);
  headGrad.addColorStop(0, '#FFD8A4');
  headGrad.addColorStop(0.5, '#F8A95C');
  headGrad.addColorStop(1, '#CE722D');
  ctx.beginPath();
  ctx.moveTo(0, -52);
  ctx.bezierCurveTo(38, -52, 60, -28, 60, -2);
  ctx.bezierCurveTo(60, 26, 36, 42, 0, 42);
  ctx.bezierCurveTo(-36, 42, -60, 26, -60, -2);
  ctx.bezierCurveTo(-60, -28, -38, -52, 0, -52);
  ctx.closePath();
  ctx.fillStyle = headGrad;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = RIM_WARM;
  ctx.stroke();

  // Top-left plush fur highlight sheen
  const sheen = ctx.createRadialGradient(-18, -32, 2, -16, -30, 28);
  sheen.addColorStop(0, 'rgba(255, 252, 240, 0.35)');
  sheen.addColorStop(1, 'rgba(255, 252, 240, 0)');
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.ellipse(-16, -30, 26, 15, -0.25, 0, Math.PI * 2);
  ctx.fill();

  // Soft cream muzzle pillow
  const muzzleGrad = ctx.createRadialGradient(0, 12, 2, 0, 15, 28);
  muzzleGrad.addColorStop(0, '#FFFDF7');
  muzzleGrad.addColorStop(0.7, '#FFF0D6');
  muzzleGrad.addColorStop(1, 'rgba(248, 200, 140, 0)');
  ctx.fillStyle = muzzleGrad;
  ctx.beginPath();
  ctx.ellipse(0, 15, 28, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Forehead & cheek tabby stripes (soft warm ginger brushstrokes)
  ctx.strokeStyle = 'rgba(182, 86, 26, 0.72)';
  ctx.lineWidth = 5.2;
  ctx.beginPath();
  ctx.moveTo(-10, -48);
  ctx.quadraticCurveTo(-11, -40, -9, -32);
  ctx.moveTo(0, -50);
  ctx.lineTo(0, -28);
  ctx.moveTo(10, -48);
  ctx.quadraticCurveTo(11, -40, 9, -32);
  ctx.stroke();

  ctx.lineWidth = 3.8;
  ctx.strokeStyle = 'rgba(182, 86, 26, 0.45)';
  ctx.beginPath();
  ctx.moveTo(-54, -2);
  ctx.quadraticCurveTo(-45, -1, -40, 1);
  ctx.moveTo(-53, 8);
  ctx.quadraticCurveTo(-44, 8, -39, 9);
  ctx.moveTo(54, -2);
  ctx.quadraticCurveTo(45, -1, 40, 1);
  ctx.moveTo(53, 8);
  ctx.quadraticCurveTo(44, 8, 39, 9);
  ctx.stroke();

  // Delicate warm-brown whiskers
  const whiskerWave = Math.sin(t * 4.2) * 2.0;
  ctx.strokeStyle = 'rgba(104, 68, 48, 0.58)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-42, 4);
  ctx.quadraticCurveTo(-56, 1, -68, -2 + whiskerWave);
  ctx.moveTo(-42, 12);
  ctx.quadraticCurveTo(-56, 14, -69, 16 + whiskerWave);
  ctx.moveTo(42, 4);
  ctx.quadraticCurveTo(56, 1, 68, -2 - whiskerWave);
  ctx.moveTo(42, 12);
  ctx.quadraticCurveTo(56, 14, 69, 16 - whiskerWave);
  ctx.stroke();

  // Expressive glossy 3D eyes
  if (happyActive) {
    ctx.strokeStyle = BROW_BROWN;
    ctx.lineWidth = 5.4;
    ctx.beginPath();
    ctx.moveTo(-36, -6);
    ctx.quadraticCurveTo(-25, -20, -14, -6);
    ctx.moveTo(14, -6);
    ctx.quadraticCurveTo(25, -20, 36, -6);
    ctx.stroke();
  } else if (blink > 0.65) {
    ctx.strokeStyle = BROW_BROWN;
    ctx.lineWidth = 4.8;
    ctx.beginPath();
    ctx.moveTo(-35, -8);
    ctx.quadraticCurveTo(-25, -2, -15, -8);
    ctx.moveTo(15, -8);
    ctx.quadraticCurveTo(25, -2, 35, -8);
    ctx.stroke();
  } else {
    const eyeScaleY = Math.max(0.24, 1 - blink * 0.85);
    const lookX = mischiefActive ? Math.sin(t * 5) * 2.0 : Math.sin(t * 1.1) * 1.5;
    for (const side of [-1, 1]) {
      const ex = side * 25 + lookX;
      const ey = -8;
      // Soft dark iris + warm amber lower gleam + specular catchlights
      const irisGrad = ctx.createRadialGradient(ex - 2, ey - 3 * eyeScaleY, 1, ex, ey, 10);
      irisGrad.addColorStop(0, '#5A3622');
      irisGrad.addColorStop(0.65, '#341D13');
      irisGrad.addColorStop(1, '#1E100A');
      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.ellipse(ex, ey, 9.2, 9.8 * eyeScaleY, 0, 0, Math.PI * 2);
      ctx.fill();

      if (eyeScaleY > 0.45) {
        // Lower amber iris rim reflection
        ctx.fillStyle = 'rgba(218, 134, 58, 0.55)';
        ctx.beginPath();
        ctx.ellipse(ex + 1, ey + 4.4 * eyeScaleY, 5.4, 2.2 * eyeScaleY, 0, 0, Math.PI * 2);
        ctx.fill();
        // Main top-left white catchlight + secondary pinpoint glint
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(ex - 3.0, ey - 3.2 * eyeScaleY, 3.0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + 2.6, ey + 2.2 * eyeScaleY, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (mischiefActive) {
      ctx.strokeStyle = '#6A3D22';
      ctx.lineWidth = 4.6;
      ctx.beginPath();
      ctx.moveTo(-36, -22);
      ctx.lineTo(-16, -13);
      ctx.moveTo(36, -22);
      ctx.lineTo(16, -13);
      ctx.stroke();
    }
  }

  // Soft airbrushed rosy cheeks
  const cheekR = happyActive ? 13 : 11;
  for (const cxSide of [-39, 39]) {
    const cg = ctx.createRadialGradient(cxSide, 6, 1, cxSide, 6, cheekR);
    cg.addColorStop(0, 'rgba(255, 132, 146, 0.58)');
    cg.addColorStop(1, 'rgba(255, 132, 146, 0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cxSide, 6, cheekR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft 3D pink nose + tiny shine
  const noseGrad = ctx.createLinearGradient(0, 1, 0, 9);
  noseGrad.addColorStop(0, '#FF9FA6');
  noseGrad.addColorStop(1, '#DC6870');
  ctx.fillStyle = noseGrad;
  ctx.beginPath();
  ctx.moveTo(-5.5, 2.5);
  ctx.quadraticCurveTo(0, 0.5, 5.5, 2.5);
  ctx.quadraticCurveTo(4, 8, 0, 9.2);
  ctx.quadraticCurveTo(-4, 8, -5.5, 2.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.beginPath();
  ctx.ellipse(-1.8, 3.6, 1.6, 0.9, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Gentle mouth (animated when talking or mischievous)
  if (talkOpen > 0.08 || mischiefActive) {
    const openH = mischiefActive ? 7.5 + Math.abs(Math.sin(t * 10)) * 4.5 : 3.5 + talkOpen * 7.5;
    ctx.fillStyle = '#D96476';
    ctx.beginPath();
    ctx.ellipse(0, 15 + openH * 0.25, 7, openH * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F59CA8';
    ctx.beginPath();
    ctx.ellipse(0, 15 + openH * 0.45, 4.2, openH * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#6A4230';
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(-13, 14);
  ctx.quadraticCurveTo(-6, 21, 0, 11);
  ctx.quadraticCurveTo(6, 21, 13, 14);
  ctx.stroke();

  ctx.restore(); // end head

  // Plush cream paws with 3D shading
  if (mischiefActive) {
    const swipeY = Math.sin(t * 12) * 8;
    ctx.strokeStyle = 'rgba(155, 82, 32, 0.24)';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(68, 168 + bobY * 0.5);
    ctx.lineTo(34, 136 + swipeY);
    ctx.stroke();
    ctx.strokeStyle = '#FFF4DF';
    ctx.lineWidth = 17;
    ctx.beginPath();
    ctx.moveTo(68, 168 + bobY * 0.5);
    ctx.lineTo(34, 136 + swipeY);
    ctx.stroke();

    // Raised paw pad hint
    ctx.fillStyle = '#F7A8AE';
    ctx.beginPath();
    ctx.arc(34, 136 + swipeY, 5.2, 0, Math.PI * 2);
    ctx.fill();

    const rpGrad = ctx.createRadialGradient(150, 200, 3, 154, 206, 17);
    rpGrad.addColorStop(0, CREAM_TOP);
    rpGrad.addColorStop(1, '#EBD2AE');
    ctx.fillStyle = rpGrad;
    ctx.beginPath();
    ctx.arc(154, 206, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = RIM_WARM;
    ctx.stroke();
  } else {
    const leftPawLift = opts.talking ? Math.max(0, Math.sin(t * 7)) * 4 : Math.max(0, Math.sin(t * 2.5)) * 2;
    const rightPawLift = react > 0 ? Math.sin(react * Math.PI) * 14 : Math.max(0, -Math.sin(t * 2.5)) * 2;
    for (const [px, lift] of [
      [102, leftPawLift],
      [154, rightPawLift],
    ] as const) {
      const py = 206 - lift;
      const pawGrad = ctx.createRadialGradient(px - 4, py - 5, 3, px, py, 18);
      pawGrad.addColorStop(0, CREAM_TOP);
      pawGrad.addColorStop(0.7, '#FFF2DC');
      pawGrad.addColorStop(1, '#E6CAA2');
      ctx.fillStyle = pawGrad;
      ctx.beginPath();
      ctx.arc(px, py, 16.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = RIM_WARM;
      ctx.stroke();
    }
  }

  // Glossy 3D floating hearts for pleased or petted state
  if (happyActive) {
    const pulse = 0.88 + Math.sin(t * 7) * 0.12;
    const floatOffset = react > 0 ? (1 - react) * -14 : Math.sin(t * 3.6) * 5;
    drawHeart(
      ctx,
      206,
      48 + floatOffset,
      28 * pulse,
      '#FF8F84',
      '#DF4E4A',
      react > 0 ? Math.min(1, react * 2.2) : 0.95
    );
    if (react > 0.05) {
      drawHeart(
        ctx,
        56,
        62 - (1 - react) * 18,
        21 * pulse,
        '#FFB3C6',
        '#EB6888',
        Math.min(1, Math.sin(react * Math.PI) * 1.3)
      );
    }
  }

  ctx.restore();
}

/**
 * Draws a soft frosted comic speech bubble with tail pointer, gentle float,
 * pop-in scale, and typewriter cursor on a 2D canvas (used by MiniGame runtime).
 */
export function drawAnimatedSpeechBubble(
  ctx: CanvasRenderingContext2D,
  opts: SpeechBubbleRenderOptions
): void {
  const fullChars = Array.from(opts.text);
  if (fullChars.length === 0) return;

  const typedCount = Math.max(1, Math.min(fullChars.length, opts.typedChars));
  const shownText = fullChars.slice(0, typedCount).join('');
  const isTyping = typedCount < fullChars.length;

  const fontSize = opts.fontSize ?? 20;
  const maxWidth = opts.maxWidth ?? 560;
  const padX = 22;
  const lineH = Math.round(fontSize * 1.38);

  ctx.save();
  ctx.font = `bold ${fontSize}px sans-serif`;

  // Wrap full text first so the bubble box does not jitter horizontally while typing
  const wrapLines = (str: string): string[] => {
    const chars = Array.from(str);
    const lines: string[] = [];
    let current = '';
    for (const ch of chars) {
      const next = current + ch;
      if (current.length > 0 && ctx.measureText(next).width > maxWidth - padX * 2) {
        lines.push(current);
        current = ch;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  const fullLines = wrapLines(opts.text);
  let contentW = 140;
  for (const line of fullLines) {
    contentW = Math.max(contentW, Math.ceil(ctx.measureText(line).width));
  }
  const boxW = Math.min(maxWidth, contentW + padX * 2 + 12);
  const boxH = Math.max(50, fullLines.length * lineH + 20);

  // Slice visible characters matching full line breaks
  let remaining = typedCount;
  const visibleLines: string[] = [];
  for (const fullLine of fullLines) {
    if (remaining <= 0) break;
    const cp = Array.from(fullLine);
    const take = Math.min(cp.length, remaining);
    visibleLines.push(cp.slice(0, take).join(''));
    remaining -= take;
  }

  const pop = Math.max(0, Math.min(1, opts.popProgress ?? 1));
  const popScale = pop < 1 ? 0.84 + Math.sin(pop * Math.PI * 0.68) * 0.2 : 1;
  const floatY = Math.sin(opts.timeSec * 3.1) * 2.2;

  const margin = 18;
  const bx = Math.max(margin, Math.min(opts.stageWidth - boxW - margin, opts.anchorX - boxW * 0.5));
  const by = opts.bottomY - boxH + floatY;
  const pointerX = Math.max(
    bx + 26,
    Math.min(bx + boxW - 26, opts.pointerTargetX ?? opts.anchorX)
  );

  ctx.translate(pointerX, by + boxH);
  ctx.scale(popScale, popScale);
  ctx.translate(-pointerX, -(by + boxH));

  // Soft elevated drop shadow + warm frosted body (layered offset fill avoids Android shadowBlur spikes)
  ctx.save();
  drawRoundedRectPath(ctx, bx - 1.5, by + 5.5, boxW + 3, boxH + 1, 21);
  ctx.fillStyle = 'rgba(59, 45, 38, 0.08)';
  ctx.fill();
  drawRoundedRectPath(ctx, bx, by + 3, boxW, boxH, 20);
  ctx.fillStyle = 'rgba(59, 45, 38, 0.11)';
  ctx.fill();
  drawRoundedRectPath(ctx, bx, by, boxW, boxH, 20);
  ctx.fillStyle = 'rgba(255, 253, 249, 0.96)';
  ctx.fill();
  ctx.restore();

  drawRoundedRectPath(ctx, bx, by, boxW, boxH, 20);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(92, 66, 52, 0.20)';
  ctx.stroke();

  // Seamless tail triangle attached at bottom
  ctx.beginPath();
  ctx.moveTo(pointerX - 10, by + boxH - 1.5);
  ctx.lineTo(pointerX, by + boxH + 10);
  ctx.lineTo(pointerX + 10, by + boxH - 1.5);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 253, 249, 0.96)';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(pointerX - 10, by + boxH - 0.5);
  ctx.lineTo(pointerX, by + boxH + 10);
  ctx.lineTo(pointerX + 10, by + boxH - 0.5);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(92, 66, 52, 0.20)';
  ctx.stroke();

  // Text lines + animated caret while typing
  ctx.fillStyle = '#3B2D26';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const textStartX = bx + (boxW - contentW) * 0.5;
  const firstLineCenterY = by + (boxH - (fullLines.length - 1) * lineH) * 0.5;

  visibleLines.forEach((line, idx) => {
    const ly = firstLineCenterY + idx * lineH;
    ctx.fillText(line, textStartX, ly);
    if (isTyping && idx === visibleLines.length - 1 && Math.floor(opts.timeSec * 8) % 2 === 0) {
      const lw = ctx.measureText(line).width;
      ctx.fillStyle = '#FC9651';
      ctx.fillRect(textStartX + lw + 3, ly - fontSize * 0.42, 3.2, fontSize * 0.84);
      ctx.fillStyle = '#3B2D26';
    }
  });

  void shownText;
  ctx.restore();
}

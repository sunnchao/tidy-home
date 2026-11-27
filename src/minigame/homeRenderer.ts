import {
  buildHomeCatLines,
  drawAnimatedCat,
  drawAnimatedSpeechBubble,
  PET_REACTION_DURATION_SEC,
  sliceTypedText,
} from '@core/catAnimation';
import type { SaveData } from '@core/types';
import {
  canClaimDailyFree,
  canClaimShareReward,
  getButlerRank,
  getNextUnlockTeaser,
  MAX_LIVES,
} from '@core/userProfile';
import { getHomePlayCtaLabel, getRoomForLevel } from '@shared/hudViewModel';
import type { MiniGameAssetStore } from './assets';
import {
  drawClippedRoundImage,
  drawFullScreenBg,
  drawImg,
  drawLivesPill,
  drawRoundRect,
  drawSoftCard,
} from './canvasPrimitives';
import { type HitRect, type MiniGameModal, REF_W, type StageMetrics } from './types';

export interface HomeRenderDeps {
  ctx: any;
  assets: MiniGameAssetStore;
  metrics: StageMetrics;
  saveData: SaveData;
  shareUnlock: boolean;
  activeModal: MiniGameModal;
  animTimeSec: number;
  homeDialogueIdx: number;
  homeDialogueElapsedSec: number;
  homeCustomLine: string | null;
  homePetReactSec: number;
  hudHitRegions: HitRect[];
  onSyncSave: (next: SaveData) => void;
  onTapHomeCat: () => void;
  onOpenLivesModal: () => void;
  onOpenSettingsModal: () => void;
  onPlayLevel: (levelNumber: number) => void;
  onOpenModal: (modal: MiniGameModal) => void;
  onTriggerShare: () => void;
}

export function renderHomeScreen(deps: HomeRenderDeps): void {
  const { ctx, assets, metrics, saveData } = deps;
  const ox = (metrics.stageW - REF_W) * 0.5;
  const { theme, room } = getRoomForLevel(saveData.currentLevel);
  const rank = getButlerRank(saveData.totalLevelsCleared);
  const teaser = getNextUnlockTeaser(saveData.currentLevel, saveData.highestLevel);

  const homeBottomPad = Math.max(24, metrics.safeBottomOffset + 20);
  const barY = Math.max(22, metrics.safeTopOffset);
  const titleY = barY + 96;

  const menuY = Math.round(metrics.stageH - homeBottomPad - 130);
  const ctaY = menuY - 122;
  const teaserY = ctaY - 126;
  const titleH = Math.min(168, Math.max(134, Math.round((teaserY - titleY) * 0.3)));
  const titleBottom = titleY + titleH;
  const catAreaH = Math.max(190, teaserY - titleBottom);
  const catSize = Math.min(204, Math.max(146, Math.round(catAreaH * 0.44)));
  const catY = Math.round(titleBottom + catAreaH * 0.62);
  const catBubbleBottomY = Math.max(titleBottom + 78, catY - Math.round(catSize * 0.56));

  drawFullScreenBg(ctx, assets, `resources/${room.bgResource}`, metrics.stageW, metrics.stageH);
  ctx.fillStyle = 'rgba(255, 246, 234, 0.58)';
  ctx.fillRect(0, 0, metrics.stageW, metrics.stageH);

  // Unified single top header row: Lives + Coins + Treats + Settings
  drawLivesPill(ctx, assets, saveData, deps.onSyncSave, ox + 20, barY, 244, '#FF5A6E');

  drawSoftCard(ctx, ox + 272, barY, 122, 44, 22, 'rgba(255, 250, 224, 0.94)', 'rgba(205, 148, 36, 0.24)', 1.5, 0.09, 3);
  drawImg(ctx, assets, 'resources/ui/icon_coin.png', ox + 282, barY + 7, 30, 30);
  ctx.fillStyle = '#3B2D26';
  ctx.font = 'bold 19px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(String(saveData.coins ?? 0), ox + 320, barY + 28);

  drawSoftCard(ctx, ox + 402, barY, 108, 44, 22, 'rgba(255, 245, 226, 0.94)', 'rgba(232, 118, 48, 0.24)', 1.5, 0.09, 3);
  drawImg(ctx, assets, 'resources/ui/icon_cat_treat.png', ox + 412, barY + 7, 30, 30);
  ctx.fillStyle = '#3B2D26';
  ctx.font = 'bold 19px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(String(saveData.petTreats), ox + 450, barY + 28);

  drawSoftCard(ctx, ox + 642, barY - 2, 48, 48, 24, 'rgba(255, 253, 249, 0.94)', 'rgba(90, 66, 52, 0.14)', 1.5, 0.1, 3);
  drawImg(ctx, assets, 'resources/ui/icon_settings.png', ox + 651, barY + 7, 30, 30);

  // Title card + rank pill
  drawSoftCard(ctx, ox + 92, titleY, 536, titleH, 32, 'rgba(255, 253, 249, 0.88)', 'rgba(255, 255, 255, 0.92)', 2, 0.13, 8);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#3B2D26';
  ctx.font = 'bold 46px sans-serif';
  ctx.fillText('我来收纳', ox + 360, titleY + Math.round(titleH * 0.36));
  ctx.fillStyle = room.accentDeep;
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(room.tagline, ox + 360, titleY + Math.round(titleH * 0.59));

  const pillY = titleY + Math.round(titleH * 0.7);
  ctx.font = 'bold 17px sans-serif';
  const rankW = Math.ceil(ctx.measureText(rank.title).width);
  const pillInnerW = 22 + 7 + rankW;
  const pillW = Math.max(150, pillInnerW + 32);
  const pillX = ox + 360 - pillW * 0.5;
  drawRoundRect(ctx, pillX, pillY, pillW, 34, 17, room.badgeBg, 'rgba(90, 66, 52, 0.12)', 1.2);
  const rankStartX = ox + 360 - pillInnerW * 0.5;
  drawImg(ctx, assets, 'resources/ui/icon_crown.png', rankStartX, pillY + 6, 22, 22);
  ctx.fillStyle = '#3B2D26';
  ctx.textAlign = 'left';
  ctx.fillText(rank.title, rankStartX + 29, pillY + 23);
  ctx.textAlign = 'center';

  // Cat mascot spotlight + animated cat
  ctx.save();
  const spotlight = ctx.createRadialGradient(ox + 360, catY + 12, 10, ox + 360, catY + 12, 130);
  spotlight.addColorStop(0, 'rgba(255, 246, 226, 0.72)');
  spotlight.addColorStop(1, 'rgba(255, 246, 226, 0)');
  ctx.fillStyle = spotlight;
  ctx.beginPath();
  ctx.arc(ox + 360, catY + 12, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const homeLines = buildHomeCatLines({
    roomTheme: theme,
    currentLevel: saveData.currentLevel,
    totalLevelsCleared: saveData.totalLevelsCleared,
    petTreats: saveData.petTreats,
    canClaimDailyFree: canClaimDailyFree(saveData),
    coins: saveData.coins,
    lives: saveData.lives,
    canClaimShare: deps.shareUnlock && canClaimShareReward(saveData),
  });
  const activeHomeLine = deps.homeCustomLine ?? homeLines[deps.homeDialogueIdx % homeLines.length];
  const homeTyped = sliceTypedText(activeHomeLine, deps.homeDialogueElapsedSec);
  const homeReactProgress =
    deps.homePetReactSec > 0 ? 1 - deps.homePetReactSec / PET_REACTION_DURATION_SEC : 0;

  drawAnimatedSpeechBubble(ctx, {
    text: activeHomeLine,
    typedChars: homeTyped.typedChars,
    anchorX: ox + 360,
    bottomY: catBubbleBottomY,
    pointerTargetX: ox + 360,
    timeSec: deps.animTimeSec,
    stageWidth: metrics.stageW,
    popProgress: Math.min(1, deps.homeDialogueElapsedSec / 0.24),
    fontSize: 19,
    maxWidth: 560,
  });
  drawAnimatedCat(ctx, ox + 360, catY, catSize, {
    timeSec: deps.animTimeSec,
    mood: homeReactProgress > 0 ? 'pleased' : 'idle',
    talking: homeTyped.typing,
    petReactionProgress: homeReactProgress,
  });

  if (deps.activeModal === 'none') {
    deps.hudHitRegions.push({
      x: ox + 130,
      y: Math.max(titleBottom + 4, catY - 180),
      w: 460,
      h: 280,
      onTap: deps.onTapHomeCat,
    });
  }

  // Progress & Unlock Teaser Card
  drawSoftCard(ctx, ox + 34, teaserY, 652, 108, 26, 'rgba(255, 253, 249, 0.94)', 'rgba(90, 66, 52, 0.14)', 1.5, 0.11, 5);
  drawClippedRoundImage(ctx, assets, `resources/${room.bgResource}`, ox + 52, teaserY + 16, 76, 76, 16);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#3B2D26';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`第 ${saveData.currentLevel} 关 · ${room.name}`, ox + 144, teaserY + 46);
  ctx.fillStyle = '#7E6B61';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(teaser, ox + 144, teaserY + 82);

  // Primary Play Button
  drawSoftCard(ctx, ox + 34, ctaY, 652, 100, 26, room.accentColor, 'rgba(255, 255, 255, 0.35)', 2, 0.24, 8);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 31px sans-serif';
  ctx.fillText(getHomePlayCtaLabel(saveData), ox + 326, ctaY + 61);
  drawRoundRect(ctx, ox + 566, ctaY + 27, 94, 46, 23, 'rgba(34, 22, 16, 0.20)', 'rgba(255, 255, 255, 0.28)', 1.5);
  drawImg(ctx, assets, 'resources/ui/icon_heart.png', ox + 580, ctaY + 37, 26, 26);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('-1', ox + 630, ctaY + 57);

  // Bottom 3 Menu Buttons
  const menus: Array<{ key: 'daily' | 'share' | 'help'; icon: string; name: string; dot?: boolean }> = [
    { key: 'daily', icon: 'resources/ui/icon_shop.png', name: '猫条小铺', dot: canClaimDailyFree(saveData) },
    { key: 'share', icon: 'resources/ui/icon_share.png', name: deps.shareUnlock ? '分享领条' : '分享游戏' },
    { key: 'help', icon: 'resources/ui/icon_help.png', name: '玩法说明' },
  ];
  menus.forEach((m, i) => {
    const bx = ox + 34 + i * 226;
    const by = menuY;
    const bw = 200;
    const bh = 128;
    drawSoftCard(ctx, bx, by, bw, bh, 24, 'rgba(255, 253, 249, 0.94)', 'rgba(90, 66, 52, 0.14)', 1.5, 0.1, 5);
    drawImg(ctx, assets, m.icon, bx + 68, by + 16, 64, 64);
    ctx.fillStyle = '#3B2D26';
    ctx.font = 'bold 21px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.name, bx + bw / 2, by + 108);
    if (m.dot) {
      drawRoundRect(ctx, bx + bw - 26, by - 5, 20, 20, 10, '#EB4D4B', '#FFFDF9', 2.5);
    }
    if (deps.activeModal === 'none') {
      deps.hudHitRegions.push({
        x: bx,
        y: by,
        w: bw,
        h: bh,
        onTap: () => {
          if (m.key === 'share') {
            deps.onTriggerShare();
            return;
          }
          deps.onOpenModal(m.key);
        },
      });
    }
  });

  if (deps.activeModal === 'none') {
    deps.hudHitRegions.push(
      {
        x: ox + 20,
        y: barY,
        w: 244,
        h: 44,
        onTap: () => {
          if (saveData.lives < MAX_LIVES) deps.onOpenLivesModal();
          else deps.onOpenModal('daily');
        },
      },
      {
        x: ox + 642,
        y: barY - 2,
        w: 48,
        h: 48,
        onTap: deps.onOpenSettingsModal,
      },
      {
        x: ox + 34,
        y: ctaY,
        w: 652,
        h: 100,
        onTap: () => deps.onPlayLevel(saveData.currentLevel),
      }
    );
  }
}

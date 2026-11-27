import { ROOM_CATALOG, ROOM_ORDER } from '@core/catalogs';
import { isShareUnlockMode, REWARD_UNLOCK_COPY } from '@core/rewardUnlock';
import type { AdPlacement, SaveData, SessionSnapshot } from '@core/types';
import {
  buyCatTreats,
  buyLifeWithCoins,
  canClaimShareReward,
  CAT_TREAT_PACK3_PRICE,
  CAT_TREAT_PRICE,
  claimDailyAdBonus,
  claimDailyFree,
  DAILY_AD_LIMIT,
  DAILY_FREE_COINS,
  DAILY_FREE_LIMIT,
  DAILY_SHARE_LIMIT,
  formatCountdownMmSs,
  getClearsUntilNextPetReward,
  grantLife,
  LIFE_COIN_PRICE,
  MAX_LIVES,
  resetWinStreak,
  syncDailyReset,
  syncLives,
} from '@core/userProfile';
import type { IPlatformAdapter } from '@platform/IPlatformAdapter';
import type { VictoryDisplayMeta } from '@shared/hudViewModel';
import { drawRoundRect, drawSoftCard } from './canvasPrimitives';
import { type HitRect, type MiniGameModal, type MiniGameScreen, REF_H, REF_W, type StageMetrics } from './types';

export interface ModalRenderDeps {
  ctx: any;
  metrics: StageMetrics;
  screen: MiniGameScreen;
  activeModal: MiniGameModal;
  confirmReset: boolean;
  saveData: SaveData;
  snap: SessionSnapshot;
  lastVictoryMeta: VictoryDisplayMeta;
  platform: IPlatformAdapter;
  hudHitRegions: HitRect[];
  setSaveData: (next: SaveData) => void;
  setActiveModal: (modal: MiniGameModal) => void;
  setConfirmReset: (confirm: boolean) => void;
  onPlaySfx: (name: string) => void;
  onVibrate: (style?: 'light' | 'medium' | 'heavy') => void;
  onShowToast: (text: string, durationMs?: number) => void;
  onRunAd: (placement: AdPlacement, onOk: () => void) => void;
  onTriggerShare: () => void;
  onTryEnterLevel: (levelNumber: number, opts?: { resetStreakOnRestart?: boolean }) => void;
  onShowHomeWithTransition: (beforeSwap?: () => void) => void;
  onPrepareStandbyLevel: (levelNumber: number) => void;
  onResetAllProgress: () => void;
  onGrantAdCatGift: () => void;
  onReviveClearTray: () => void;
}

type AddHitFn = (x: number, y: number, w: number, h: number, onTap: () => void) => void;

export function renderOverlayModal(deps: ModalRenderDeps): void {
  const { ctx, metrics } = deps;
  ctx.fillStyle = 'rgba(34, 22, 16, 0.48)';
  ctx.fillRect(0, 0, metrics.stageW, metrics.stageH);

  const ox = (metrics.stageW - REF_W) * 0.5;
  const oy = Math.max(Math.round(metrics.safeTopOffset * 0.5), Math.round((metrics.stageH - REF_H) * 0.5));
  const addHit: AddHitFn = (x, y, w, h, onTap) => {
    deps.hudHitRegions.push({ x: ox + x, y: oy + y, w, h, onTap });
  };

  ctx.save();
  ctx.translate(ox, oy);
  try {
    drawSoftCard(ctx, 46, 220, 628, 820, 34, '#FFFDF9', 'rgba(90, 66, 52, 0.14)', 1.8, 0.22, 12);
    ctx.textAlign = 'center';

    if (deps.activeModal === 'no_lives') {
      renderNoLivesModal(deps, addHit);
    } else if (deps.activeModal === 'settings') {
      renderSettingsModal(deps, addHit);
    } else if (deps.activeModal === 'rooms') {
      renderRoomsModal(deps, addHit);
    } else if (deps.activeModal === 'help') {
      renderHelpModal(deps, addHit);
    } else if (deps.activeModal === 'privacy') {
      renderPrivacyModal(deps, addHit);
    } else if (deps.activeModal === 'daily') {
      renderDailyShopModal(deps, addHit);
    } else if (deps.activeModal === 'cat_ad') {
      renderCatAdModal(deps, addHit);
    } else if (deps.snap.status === 'won') {
      renderWonModal(deps, addHit);
    } else if (deps.snap.status === 'failed_tray_full') {
      renderFailedTrayModal(deps, addHit);
    }
  } finally {
    ctx.restore();
  }
}

function renderNoLivesModal(deps: ModalRenderDeps, addHit: AddHitFn): void {
  const { ctx } = deps;
  const synced = syncLives(deps.saveData, Date.now());
  const timerText = synced.nextRegenInSec > 0 ? formatCountdownMmSs(synced.nextRegenInSec) : '已满';
  const coins = deps.saveData.coins ?? 0;
  const canBuy = coins >= LIFE_COIN_PRICE && deps.saveData.lives < MAX_LIVES;
  const shareMode = isShareUnlockMode(deps.platform.platformName);

  ctx.fillStyle = '#3B2D26';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(deps.saveData.lives <= 0 ? '体力已耗尽啦!' : '体力恢复中心', 360, 300);
  ctx.font = 'bold 21px sans-serif';
  ctx.fillStyle = '#7E6B61';
  ctx.fillText(`当前体力 ${deps.saveData.lives}/${MAX_LIVES} · 每10分钟自动恢复1次`, 360, 360);
  if (deps.saveData.lives < MAX_LIVES) {
    ctx.fillStyle = '#C93B52';
    ctx.fillText(`下次恢复倒计时：${timerText}`, 360, 402);
  }

  drawSoftCard(
    ctx,
    96,
    474,
    528,
    86,
    22,
    shareMode ? '#3E9B6E' : '#FC9651',
    'rgba(255, 255, 255, 0.30)',
    1.5,
    0.18,
    6
  );
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 25px sans-serif';
  ctx.fillText(
    shareMode ? REWARD_UNLOCK_COPY.refill_lives.buttonLabel : '看激励视频恢复 +2 体力',
    360,
    526
  );

  drawSoftCard(ctx, 96, 584, 528, 82, 22, canBuy ? '#FFD147' : '#EAE3DA', 'rgba(90, 66, 52, 0.14)', 1.5, 0.1, 4);
  ctx.fillStyle = '#3B2D26';
  ctx.fillText(`花 ${LIFE_COIN_PRICE} 金币恢复 +1 体力 (余 ${coins})`, 360, 634);

  drawSoftCard(ctx, 180, 714, 360, 72, 20, '#F4EDE2', 'rgba(90, 66, 52, 0.14)', 1.4, 0.06, 2);
  ctx.fillText(deps.saveData.lives > 0 ? '返回' : '回首页休息', 360, 758);

  addHit(96, 474, 528, 86, () => {
    deps.setActiveModal('none');
    deps.onRunAd('refill_lives', () => {
      const next = grantLife(deps.saveData, 2, Date.now()).save;
      deps.setSaveData(next);
      deps.platform.saveProgress(next);
    });
  });
  addHit(96, 584, 528, 82, () => {
    const res = buyLifeWithCoins(deps.saveData, Date.now());
    if (res.ok) {
      deps.setSaveData(res.save);
      deps.platform.saveProgress(res.save);
      deps.onPlaySfx('meow_happy');
      deps.setActiveModal('none');
      deps.onShowToast('体力 +1!');
    }
  });
  addHit(180, 714, 360, 72, () => {
    deps.setActiveModal('none');
    if (deps.saveData.lives <= 0) {
      deps.onShowHomeWithTransition();
    }
  });
}

function renderSettingsModal(deps: ModalRenderDeps, addHit: AddHitFn): void {
  const { ctx } = deps;
  ctx.fillStyle = '#3B2D26';
  ctx.font = 'bold 31px sans-serif';
  ctx.fillText(deps.screen === 'game' ? '暂停与设置' : '系统设置', 360, 286);

  drawRoundRect(ctx, 606, 248, 44, 44, 22, '#F4EDE2', 'rgba(90, 66, 52, 0.14)', 1.2);
  ctx.fillStyle = '#7E6B61';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('×', 628, 278);
  addHit(606, 248, 44, 44, () => deps.setActiveModal('none'));

  ctx.font = 'bold 19px sans-serif';
  ctx.fillStyle = '#7E6B61';
  ctx.fillText(`管家编号 ${deps.saveData.userId}`, 360, 326);

  const prefTopY = deps.screen === 'game' ? 548 : 374;
  if (deps.screen === 'game') {
    drawSoftCard(ctx, 86, 356, 548, 76, 22, '#FC9651', 'rgba(255, 255, 255, 0.30)', 1.5, 0.18, 5);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 25px sans-serif';
    ctx.fillText('继续整理', 360, 403);

    drawSoftCard(ctx, 86, 448, 264, 68, 20, '#F4EDE2', 'rgba(90, 66, 52, 0.14)', 1.4, 0.06, 2);
    ctx.fillStyle = '#3B2D26';
    ctx.font = 'bold 21px sans-serif';
    ctx.fillText('重开 (-1体力)', 218, 490);

    drawSoftCard(ctx, 370, 448, 264, 68, 20, '#F4EDE2', 'rgba(90, 66, 52, 0.14)', 1.4, 0.06, 2);
    ctx.fillText('返回大厅', 502, 490);

    addHit(86, 356, 548, 76, () => deps.setActiveModal('none'));
    addHit(86, 448, 264, 68, () => {
      deps.onTryEnterLevel(deps.snap.levelNumber, { resetStreakOnRestart: true });
    });
    addHit(370, 448, 264, 68, () => deps.onShowHomeWithTransition());
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#7E6B61';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('游戏偏好', 94, prefTopY - 12);

  drawSoftCard(ctx, 86, prefTopY, 548, 152, 22, '#FAF5EC', 'rgba(90, 66, 52, 0.14)', 1.4, 0.05, 2);
  ctx.save();
  ctx.strokeStyle = 'rgba(90, 66, 52, 0.10)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(106, prefTopY + 76);
  ctx.lineTo(614, prefTopY + 76);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#3B2D26';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('游戏音效', 114, prefTopY + 46);
  const sfxOn = !deps.saveData.muted;
  drawRoundRect(ctx, 528, prefTopY + 19, 82, 40, 20, sfxOn ? '#4E8A5A' : '#CFC5BC');
  drawRoundRect(ctx, sfxOn ? 574 : 533, prefTopY + 24, 30, 30, 15, '#FFFFFF');

  ctx.fillStyle = '#3B2D26';
  ctx.fillText('触感震动反馈', 114, prefTopY + 122);
  const vibOn = deps.saveData.vibrationEnabled;
  drawRoundRect(ctx, 528, prefTopY + 95, 82, 40, 20, vibOn ? '#4E8A5A' : '#CFC5BC');
  drawRoundRect(ctx, vibOn ? 574 : 533, prefTopY + 100, 30, 30, 15, '#FFFFFF');

  addHit(520, prefTopY + 14, 96, 50, () => {
    const next = { ...deps.saveData, muted: !deps.saveData.muted };
    deps.setSaveData(next);
    deps.platform.saveProgress(next);
  });
  addHit(520, prefTopY + 90, 96, 50, () => {
    const next = { ...deps.saveData, vibrationEnabled: !deps.saveData.vibrationEnabled };
    deps.setSaveData(next);
    deps.platform.saveProgress(next);
    deps.onVibrate('light');
  });

  const footerY = prefTopY + 178;
  ctx.textAlign = 'center';
  drawSoftCard(ctx, 86, footerY, 548, 66, 18, '#F4EDE2', 'rgba(90, 66, 52, 0.14)', 1.4, 0.05, 2);
  ctx.fillStyle = '#3B2D26';
  ctx.font = 'bold 21px sans-serif';
  ctx.fillText('隐私保护指引', 360, footerY + 41);
  addHit(86, footerY, 548, 66, () => deps.setActiveModal('privacy'));

  if (deps.confirmReset) {
    drawRoundRect(ctx, 140, footerY + 84, 440, 56, 16, '#D9533B');
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('再次点击确认清空进度!', 360, footerY + 119);
  } else {
    ctx.fillStyle = '#B45A4A';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText('重置全部游戏进度', 360, footerY + 116);
  }
  addHit(140, footerY + 82, 440, 58, () => {
    if (!deps.confirmReset) {
      deps.setConfirmReset(true);
      return;
    }
    deps.onResetAllProgress();
  });
}

function renderRoomsModal(deps: ModalRenderDeps, addHit: AddHitFn): void {
  const { ctx } = deps;
  const maxUnlocked = Math.max(deps.saveData.highestLevel, deps.saveData.currentLevel);
  ctx.fillStyle = '#3B2D26';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('6 大色彩主题与关卡选择', 360, 286);
  ctx.font = 'bold 19px sans-serif';
  ctx.fillStyle = '#7E6B61';
  ctx.fillText(`已解锁至第 ${maxUnlocked} 关 · 进关耗 1 体力，通关回血 +1`, 360, 322);

  ROOM_ORDER.forEach((id, idx) => {
    const r = ROOM_CATALOG[id];
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const rx = 74 + col * 194;
    const ry = 348 + row * 68;
    const unlocked = maxUnlocked >= r.unlockLevel;
    drawSoftCard(
      ctx,
      rx,
      ry,
      182,
      56,
      14,
      unlocked ? r.badgeBg : '#EAE4DC',
      unlocked ? r.accentDeep : 'rgba(90, 66, 52, 0.14)',
      1.5,
      0.06,
      2
    );
    ctx.fillStyle = '#3B2D26';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(r.name, rx + 91, ry + 26);
    ctx.fillStyle = unlocked ? r.accentDeep : '#887B72';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(unlocked ? '已解锁' : `第${r.unlockLevel}关解锁`, rx + 91, ry + 47);
  });

  const startLv = Math.max(1, maxUnlocked - 5);
  for (let i = 0; i < 6 && startLv + i <= maxUnlocked; i++) {
    const lv = startLv + i;
    const col = i % 3;
    const row = Math.floor(i / 3);
    const bx = 94 + col * 182;
    const by = 508 + row * 136;
    const bw = 164;
    const bh = 118;
    const room = ROOM_CATALOG[ROOM_ORDER[(lv - 1) % ROOM_ORDER.length]];
    const stars = deps.saveData.levelStars[lv] ?? 0;
    drawSoftCard(
      ctx,
      bx,
      by,
      bw,
      bh,
      18,
      lv === deps.saveData.currentLevel ? room.badgeBg : '#FFF9F0',
      lv === deps.saveData.currentLevel ? room.accentDeep : 'rgba(90, 66, 52, 0.14)',
      1.6,
      0.08,
      3
    );
    ctx.fillStyle = '#3B2D26';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`第 ${lv} 关`, bx + bw / 2, by + 40);
    ctx.fillStyle = '#7E6B61';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(room.name, bx + bw / 2, by + 68);
    ctx.fillStyle = room.accentDeep;
    ctx.fillText(`${stars > 0 ? `${stars} 星` : '未通关'}`, bx + bw / 2, by + 98);
    addHit(bx, by, bw, bh, () => deps.onTryEnterLevel(lv));
  }

  drawSoftCard(ctx, 180, 920, 360, 72, 22, '#F4EDE2', 'rgba(90, 66, 52, 0.14)', 1.4, 0.06, 2);
  ctx.fillStyle = '#3B2D26';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('返回', 360, 964);
  addHit(180, 920, 360, 72, () => deps.setActiveModal('none'));
}

function renderHelpModal(deps: ModalRenderDeps, addHit: AddHitFn): void {
  const { ctx } = deps;
  ctx.fillStyle = '#3B2D26';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('玩法说明 · 5 大亮点', 360, 286);
  const lines = [
    '1. 5次体力条，每10分钟恢复1次；通关赠送 +1 体力',
    '2. 打包/金边物品赚金币，买猫条撸猫2下替你寻物',
    '3. 关卡支持双指缩放 & 右侧 +/- 放大（限1.0~2.2×）',
    isShareUnlockMode(deps.platform.platformName)
      ? '4. 分享给好友并收到平台确认后领 +1 猫条（每日3次）'
      : '4. 猫条小铺每日可领取免费猫条和金币',
    '5. 6 大色彩主题房间与专属物品，每5关里程碑大奖',
  ];
  ctx.textAlign = 'left';
  lines.forEach((line, i) => {
    drawSoftCard(ctx, 74, 336 + i * 102, 572, 84, 18, '#FAF5EC', 'rgba(90, 66, 52, 0.14)', 1.4, 0.05, 2);
    ctx.fillStyle = '#3B2D26';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText(line, 96, 386 + i * 102);
  });
  ctx.textAlign = 'center';
  drawSoftCard(ctx, 160, 896, 400, 76, 22, '#FC9651', 'rgba(255, 255, 255, 0.30)', 1.5, 0.18, 5);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('我知道了', 360, 942);
  addHit(160, 896, 400, 76, () => deps.setActiveModal('none'));
}

function renderPrivacyModal(deps: ModalRenderDeps, addHit: AddHitFn): void {
  const { ctx } = deps;
  ctx.fillStyle = '#3D2B24';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('隐私保护指引', 360, 300);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#755C50';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('1. 仅在本地缓存关卡进度、体力时间戳、金币、猫条与设置。', 78, 390);
  ctx.fillText('2. 震动反馈仅在开启设置时触发，不采集敏感隐私权限。', 78, 448);
  ctx.fillText(
    '3. 分享和激励视频均由玩家主动点击后发起。',
    78,
    506
  );
  ctx.textAlign = 'center';
  drawSoftCard(ctx, 180, 860, 360, 74, 22, '#FC9651', 'rgba(255, 255, 255, 0.30)', 1.5, 0.18, 5);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 25px sans-serif';
  ctx.fillText('返回设置', 360, 905);
  addHit(180, 860, 360, 74, () => deps.setActiveModal('settings'));
}

function renderDailyShopModal(deps: ModalRenderDeps, addHit: AddHitFn): void {
  const { ctx } = deps;
  const save = syncLives(syncDailyReset(deps.saveData), Date.now()).save;
  deps.setSaveData(save);

  const freeLeft = Math.max(0, DAILY_FREE_LIMIT - save.dailyFreeClaimed);
  const shareMode = isShareUnlockMode(deps.platform.platformName);
  const shareLeft = Math.max(0, DAILY_SHARE_LIMIT - (save.dailyShareClaimed ?? 0));
  const adLeft = Math.max(0, DAILY_AD_LIMIT - save.dailyAdClaimed);
  const clearsLeft = getClearsUntilNextPetReward(save);
  const coins = save.coins ?? 0;

  ctx.fillStyle = '#3B2D26';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('猫条小铺 & 补给站', 360, 280);
  ctx.font = 'bold 19px sans-serif';
  ctx.fillStyle = '#7E6B61';
  ctx.fillText(
    `金币: ${coins} · 猫条: ${save.petTreats} · 体力: ${save.lives}/${MAX_LIVES} · 再过${clearsLeft}关送猫条`,
    360,
    324
  );

  drawSoftCard(ctx, 86, 364, 548, 76, 20, coins >= CAT_TREAT_PRICE ? '#FFF5E0' : '#EEE9E2', 'rgba(90, 66, 52, 0.14)', 1.4, 0.06, 2);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#3B2D26';
  ctx.font = 'bold 21px sans-serif';
  ctx.fillText('买 1 根猫条 (撸猫2下寻物)', 110, 409);
  drawSoftCard(ctx, 480, 378, 134, 48, 24, coins >= CAT_TREAT_PRICE ? '#FFD147' : '#DFD8D0', 'rgba(90, 66, 52, 0.14)', 1.2, 0.08, 2);
  ctx.fillStyle = '#3B2D26';
  ctx.textAlign = 'center';
  ctx.fillText(`${CAT_TREAT_PRICE} 金币`, 547, 409);

  drawSoftCard(ctx, 86, 456, 548, 76, 20, coins >= CAT_TREAT_PACK3_PRICE ? '#FFF5E0' : '#EEE9E2', 'rgba(90, 66, 52, 0.14)', 1.4, 0.06, 2);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#3B2D26';
  ctx.fillText('买 3 根猫条礼盒 (省20金币)', 110, 501);
  drawSoftCard(ctx, 480, 470, 134, 48, 24, coins >= CAT_TREAT_PACK3_PRICE ? '#FFD147' : '#DFD8D0', 'rgba(90, 66, 52, 0.14)', 1.2, 0.08, 2);
  ctx.fillStyle = '#3B2D26';
  ctx.textAlign = 'center';
  ctx.fillText(`${CAT_TREAT_PACK3_PRICE} 金币`, 547, 501);

  const canBuyLife = coins >= LIFE_COIN_PRICE && save.lives < MAX_LIVES;
  drawSoftCard(ctx, 86, 548, 548, 76, 20, canBuyLife ? '#FFF2F4' : '#EEE9E2', 'rgba(90, 66, 52, 0.14)', 1.4, 0.06, 2);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#3B2D26';
  ctx.fillText('恢复 +1 点体力 (满5点不可购)', 110, 593);
  drawSoftCard(ctx, 480, 562, 134, 48, 24, canBuyLife ? '#FF8FAB' : '#DFD8D0', 'rgba(90, 66, 52, 0.14)', 1.2, 0.08, 2);
  ctx.fillStyle = '#3B2D26';
  ctx.textAlign = 'center';
  ctx.fillText(`${LIFE_COIN_PRICE} 金币`, 547, 593);

  drawSoftCard(ctx, 86, 650, 548, 74, 20, freeLeft > 0 ? '#FC9651' : '#CFC7BE', 'rgba(255, 255, 255, 0.25)', 1.4, freeLeft > 0 ? 0.14 : 0, 4);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(
    freeLeft > 0 ? `每日免费领 +1猫条 +${DAILY_FREE_COINS}金币 (余 ${freeLeft}/${DAILY_FREE_LIMIT})` : '今日免费补给已领完',
    360,
    695
  );

  const bonusLeft = shareMode ? shareLeft : adLeft;
  drawSoftCard(ctx, 86, 738, 548, 74, 20, bonusLeft > 0 ? (shareMode ? '#3E9B6E' : '#4FA1DA') : '#CFC7BE', 'rgba(255, 255, 255, 0.25)', 1.4, bonusLeft > 0 ? 0.14 : 0, 4);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(
    bonusLeft > 0
      ? `${shareMode ? '分享给好友' : '看广告'}领 +1 猫条（余 ${bonusLeft}/${shareMode ? DAILY_SHARE_LIMIT : DAILY_AD_LIMIT}）`
      : '今日额外补给已领完',
    360,
    783
  );

  const closeBtnY = 842;
  drawSoftCard(ctx, 180, closeBtnY, 360, 68, 20, '#F4EDE2', 'rgba(90, 66, 52, 0.14)', 1.4, 0.06, 2);
  ctx.fillStyle = '#3B2D26';
  ctx.fillText('返回', 360, closeBtnY + 42);

  addHit(86, 364, 548, 76, () => {
    const res = buyCatTreats(deps.saveData, 'single');
    if (res.ok) {
      deps.setSaveData(res.save);
      deps.platform.saveProgress(res.save);
      deps.onPlaySfx('meow_happy');
      deps.onShowToast('购入猫条 +1!');
    }
  });
  addHit(86, 456, 548, 76, () => {
    const res = buyCatTreats(deps.saveData, 'pack3');
    if (res.ok) {
      deps.setSaveData(res.save);
      deps.platform.saveProgress(res.save);
      deps.onPlaySfx('meow_happy');
      deps.onShowToast('购入猫条 +3!');
    }
  });
  addHit(86, 548, 548, 76, () => {
    const res = buyLifeWithCoins(deps.saveData, Date.now());
    if (res.ok) {
      deps.setSaveData(res.save);
      deps.platform.saveProgress(res.save);
      deps.onPlaySfx('booster');
      deps.onShowToast('体力 +1!');
    }
  });
  addHit(86, 650, 548, 74, () => {
    const res = claimDailyFree(deps.saveData);
    if (res.ok) {
      deps.setSaveData(res.save);
      deps.platform.saveProgress(res.save);
      deps.onPlaySfx('meow_happy');
      deps.onShowToast(`领取 +1猫条 +${DAILY_FREE_COINS}金币!`);
    }
  });
  addHit(86, 738, 548, 74, () => {
    if (bonusLeft <= 0) return;
    if (shareMode) {
      deps.setActiveModal('none');
      deps.onTriggerShare();
      return;
    }
    deps.onRunAd('daily_cat_bonus', () => {
      const res = claimDailyAdBonus(deps.saveData);
      if (res.ok) {
        deps.setSaveData(res.save);
        deps.platform.saveProgress(res.save);
      }
    });
  });
  addHit(180, closeBtnY, 360, 68, () => deps.setActiveModal('none'));
}

function renderCatAdModal(deps: ModalRenderDeps, addHit: AddHitFn): void {
  const { ctx } = deps;
  const coins = deps.saveData.coins ?? 0;
  const canBuy = coins >= CAT_TREAT_PRICE;
  const shareMode = isShareUnlockMode(deps.platform.platformName);
  const shareAvail = shareMode && canClaimShareReward(deps.saveData);

  ctx.fillStyle = '#3D2B24';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('补充猫条让橘猫寻物?', 360, 320);
  ctx.font = 'bold 21px sans-serif';
  ctx.fillStyle = '#755C50';
  ctx.fillText(
    `可用金币买猫条，或${shareMode ? '分享给好友' : '看激励视频'}请橘猫帮忙（金币 ${coins}）`,
    360,
    380
  );

  drawSoftCard(ctx, 96, 444, 528, 82, 22, canBuy ? '#FFD147' : '#DFD8D0', 'rgba(90, 66, 52, 0.14)', 1.4, 0.1, 3);
  ctx.fillStyle = '#3B2D26';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`花 ${CAT_TREAT_PRICE} 金币买 1 根猫条`, 360, 493);

  ctx.fillStyle = '#FFFFFF';
  if (shareAvail) {
    drawSoftCard(ctx, 96, 548, 528, 82, 22, '#3E9B6E', 'rgba(255, 255, 255, 0.25)', 1.4, 0.14, 4);
    ctx.fillText('分享给好友领 +1 猫条', 360, 597);
    addHit(96, 548, 528, 82, () => {
      deps.setActiveModal('none');
      deps.onTriggerShare();
    });
  }

  const extraY = shareAvail ? 652 : 548;
  drawSoftCard(
    ctx,
    96,
    extraY,
    528,
    82,
    22,
    shareMode ? '#3E9B6E' : '#FC9651',
    'rgba(255, 255, 255, 0.25)',
    1.4,
    0.14,
    4
  );
  ctx.fillText(
    shareMode ? '分享好友立刻替你找 1 件' : '看激励视频立刻替你找 1 件',
    360,
    extraY + 49
  );

  drawSoftCard(ctx, 180, 774, 360, 68, 20, '#F4EDE2', 'rgba(90, 66, 52, 0.14)', 1.4, 0.06, 2);
  ctx.fillStyle = '#3B2D26';
  ctx.fillText('自己找找', 360, 816);

  addHit(96, 444, 528, 82, () => {
    const bought = buyCatTreats(deps.saveData, 'single');
    if (bought.ok) {
      deps.setSaveData(bought.save);
      deps.platform.saveProgress(bought.save);
      deps.onPlaySfx('meow_happy');
      deps.setActiveModal('none');
      deps.onShowToast('购入猫条 +1 · 再点橘猫寻物!');
    }
  });
  addHit(96, extraY, 528, 82, () => {
    deps.setActiveModal('none');
    deps.onRunAd('cat_pet_extra', deps.onGrantAdCatGift);
  });
  addHit(180, 774, 360, 68, () => deps.setActiveModal('none'));
}

function renderWonModal(deps: ModalRenderDeps, addHit: AddHitFn): void {
  const { ctx, snap } = deps;
  const meta = deps.lastVictoryMeta;
  const totalCoinsRun = meta.clearCoinsAwarded + snap.coinsEarnedInSession;
  const unlockedRoom = meta.unlockedRoomId ? ROOM_CATALOG[meta.unlockedRoomId] : null;
  const shareReward = isShareUnlockMode(deps.platform.platformName) && canClaimShareReward(deps.saveData);

  ctx.fillStyle = '#3D2B24';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(`第 ${snap.levelNumber} 关 收纳大成功!`, 360, 310);
  ctx.font = 'bold 21px sans-serif';
  ctx.fillStyle = '#E87630';
  ctx.fillText(
    `金币 +${totalCoinsRun} · 通关回血 +${meta.lifeGranted}体力${meta.milestoneGranted > 0 ? ` · 猫条 +${meta.milestoneGranted}` : ''}`,
    360,
    372
  );
  ctx.fillStyle = '#755C50';
  ctx.fillText(
    unlockedRoom ? `解锁新主题：${unlockedRoom.name}!` : `累计通关 ${deps.saveData.totalLevelsCleared} 关 · 连胜 ${deps.saveData.winStreak} 场`,
    360,
    420
  );

  drawSoftCard(ctx, 100, 520, 520, 88, 24, '#FC9651', 'rgba(255, 255, 255, 0.25)', 1.5, 0.18, 6);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`进入第 ${snap.levelNumber + 1} 关 (-1体力)`, 360, 574);

  drawSoftCard(ctx, 100, 632, 520, 78, 22, '#3E9B6E', 'rgba(255, 255, 255, 0.25)', 1.5, 0.14, 4);
  ctx.fillText(shareReward ? '分享战绩 · 领 +1 猫条' : '分享战绩', 360, 680);

  drawSoftCard(ctx, 180, 740, 360, 68, 20, '#F4EDE2', 'rgba(90, 66, 52, 0.14)', 1.4, 0.06, 2);
  ctx.fillStyle = '#3B2D26';
  ctx.fillText('返回首页', 360, 782);

  addHit(100, 520, 520, 88, () => deps.onTryEnterLevel(snap.levelNumber + 1));
  addHit(100, 632, 520, 78, deps.onTriggerShare);
  addHit(180, 740, 360, 68, () =>
    deps.onShowHomeWithTransition(() => deps.onPrepareStandbyLevel(deps.saveData.currentLevel))
  );
}

function renderFailedTrayModal(deps: ModalRenderDeps, addHit: AddHitFn): void {
  const { ctx, snap } = deps;
  const shareMode = isShareUnlockMode(deps.platform.platformName);
  ctx.fillStyle = '#3B2D26';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('暂存槽满啦!', 360, 340);
  ctx.font = 'bold 21px sans-serif';
  ctx.fillStyle = '#7E6B61';
  ctx.fillText(
    shareMode
      ? '分享给好友移出3件继续整理（不扣额外体力）'
      : '看视频移出3件继续整理（不扣额外体力）',
    360,
    404
  );

  drawSoftCard(
    ctx,
    100,
    520,
    520,
    86,
    24,
    shareMode ? '#3E9B6E' : '#FC9651',
    'rgba(255, 255, 255, 0.25)',
    1.5,
    0.18,
    6
  );
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(
    shareMode ? REWARD_UNLOCK_COPY.revive_clear_tray.buttonLabel : '看广告复活（移出 3 件）',
    360,
    574
  );

  drawSoftCard(ctx, 180, 646, 360, 70, 20, '#F4EDE2', 'rgba(90, 66, 52, 0.14)', 1.4, 0.06, 2);
  ctx.fillStyle = '#3B2D26';
  ctx.fillText('重新开始 (-1体力)', 360, 688);

  drawSoftCard(ctx, 180, 740, 360, 68, 20, '#F4EDE2', 'rgba(90, 66, 52, 0.14)', 1.4, 0.06, 2);
  ctx.fillText('返回首页', 360, 782);

  addHit(100, 520, 520, 86, () => deps.onRunAd('revive_clear_tray', deps.onReviveClearTray));
  addHit(180, 646, 360, 70, () => {
    deps.onTryEnterLevel(snap.levelNumber, { resetStreakOnRestart: true });
  });
  addHit(180, 740, 360, 68, () => {
    deps.onShowHomeWithTransition(() => {
      const next = resetWinStreak(deps.saveData);
      deps.setSaveData(next);
      deps.platform.saveProgress(next);
    });
  });
}

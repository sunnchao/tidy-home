import { ROOM_CATALOG } from '@core/catalogs';
import type { GameSession } from '@core/gameSession';
import type { AdPlacement, SaveData, SessionSnapshot } from '@core/types';
import {
  buyCatTreats,
  buyLifeWithCoins,
  canClaimDailyAdBonus,
  canClaimDailyFree,
  CAT_TREAT_PACK3_PRICE,
  CAT_TREAT_PRICE,
  claimDailyAdBonus,
  claimDailyFree,
  CLEARS_PER_PET_REWARD,
  DAILY_AD_LIMIT,
  DAILY_FREE_COINS,
  DAILY_FREE_LIMIT,
  formatCountdownMmSs,
  getButlerRank,
  getClearsUntilNextPetReward,
  grantLife,
  LIFE_COIN_PRICE,
  MAX_LIVES,
  resetWinStreak,
  syncDailyReset,
  syncLives,
} from '@core/userProfile';
import type { MockPlatformAdapter } from '@platform/MockPlatformAdapter';
import { WEB_UI_ICONS } from '@shared/constants';
import type { VictoryDisplayMeta } from '@shared/hudViewModel';
import type { WebAudioPlayer } from '../audioPlayer';
import type { ShellElements } from '../shellTemplate';
import { spawnFloatToast } from '../webEffects';

export interface GameModalDeps {
  el: ShellElements;
  platform: MockPlatformAdapter;
  audio: WebAudioPlayer;
  getSaveData: () => SaveData;
  setSaveData: (next: SaveData) => void;
  getSession: () => GameSession;
  onRender: () => void;
  onHandleAdAction: (placement: AdPlacement, onRewarded: () => void) => Promise<void>;
  onTriggerVerifiedShare: () => Promise<void>;
  onTryEnterLevel: (levelNumber: number, opts?: { resetStreakOnRestart?: boolean }) => void;
  onShowHomeWithTransition: () => void;
  onShowHomeImmediate: () => void;
}

export function openNoLivesModal(deps: GameModalDeps, allowContinue = false): void {
  const { el } = deps;
  const synced = syncLives(deps.getSaveData(), Date.now());
  deps.setSaveData(synced.save);
  const save = synced.save;

  const timerText =
    synced.nextRegenInSec > 0 ? formatCountdownMmSs(synced.nextRegenInSec) : '已满';
  const canBuyLife = (save.coins ?? 0) >= LIFE_COIN_PRICE && save.lives < MAX_LIVES;

  el.subCardEl.innerHTML = `
    <h2><img class="ui-ico md" src="${WEB_UI_ICONS.heart}" alt="" /> ${save.lives <= 0 ? '体力已耗尽啦!' : '体力恢复中心'}</h2>
    <p class="modal-sub">
      当前体力 <strong>${save.lives}/${MAX_LIVES}</strong> · 每 10 分钟自动恢复 1 次
      ${save.lives < MAX_LIVES ? `<br/>下次恢复倒计时：<strong>${timerText}</strong>` : ''}
    </p>
    <button class="btn-primary" id="life-ad-btn">
      <img class="ui-ico" src="${WEB_UI_ICONS.ad}" alt="" /> 看广告恢复 +2 体力
    </button>
    <button class="btn-secondary" id="life-coin-btn" ${canBuyLife ? '' : 'disabled'}>
      <img class="ui-ico" src="${WEB_UI_ICONS.coin}" alt="" /> 花 ${LIFE_COIN_PRICE} 金币恢复 +1 体力（余 ${save.coins ?? 0}）
    </button>
    <button class="btn-secondary" id="life-close-btn">${allowContinue ? '返回' : '回首页休息'}</button>
  `;
  el.subBackdropEl.classList.add('open');

  el.subCardEl.querySelector('#life-ad-btn')?.addEventListener('click', () => {
    el.subBackdropEl.classList.remove('open');
    void deps.onHandleAdAction('refill_lives', () => {
      const next = grantLife(deps.getSaveData(), 2, Date.now()).save;
      deps.setSaveData(next);
      deps.platform.saveProgress(next);
    });
  });

  el.subCardEl.querySelector('#life-coin-btn')?.addEventListener('click', () => {
    const bought = buyLifeWithCoins(deps.getSaveData(), Date.now());
    if (bought.ok) {
      deps.setSaveData(bought.save);
      deps.platform.saveProgress(bought.save);
      deps.audio.play('meow_happy');
      el.subBackdropEl.classList.remove('open');
      deps.onRender();
    }
  });

  el.subCardEl.querySelector('#life-close-btn')?.addEventListener('click', () => {
    el.subBackdropEl.classList.remove('open');
    if (!allowContinue) {
      el.modalBackdropEl.classList.remove('open');
      deps.onShowHomeImmediate();
    }
  });
}

export function openCatAdPrompt(deps: GameModalDeps, reason: 'no_treats' | 'level_cap'): void {
  const { el } = deps;
  const save = deps.getSaveData();
  const title = reason === 'no_treats' ? '猫条库存不足' : '本局猫条帮忙已用完';
  const coins = save.coins ?? 0;
  const canBuy = reason === 'no_treats' && coins >= CAT_TREAT_PRICE;
  const desc =
    reason === 'no_treats'
      ? `当前猫条为 0（现有金币 ${coins}）。可用 ${CAT_TREAT_PRICE} 金币买猫条，或看广告让橘猫帮忙寻物。`
      : '本局猫条喂食次数已用完，看一段激励视频可让橘猫额外找出 1 件目标物。';

  el.modalCardEl.innerHTML = `
    <h2><img class="ui-ico md" src="${WEB_UI_ICONS.paw}" alt="" /> ${title}</h2>
    <p class="modal-sub">${desc}</p>
    ${
      reason === 'no_treats'
        ? `<button class="btn-primary" id="btn-cat-buy-treat" ${canBuy ? '' : 'disabled'}>
            <img class="ui-ico" src="${WEB_UI_ICONS.coin}" alt="" /> 花 ${CAT_TREAT_PRICE} 金币买 1 根猫条（余额 ${coins}）
          </button>`
        : ''
    }
    <button class="${reason === 'no_treats' ? 'btn-secondary' : 'btn-primary'}" id="btn-cat-ad">
      <img class="ui-ico" src="${WEB_UI_ICONS.ad}" alt="" /> 看广告让橘猫帮忙寻物 (+1次)
    </button>
    <button class="btn-secondary" id="btn-open-shop">
      <img class="ui-ico" src="${WEB_UI_ICONS.shop}" alt="" /> 打开猫条小铺与每日补给
    </button>
    <button class="btn-secondary" id="btn-cat-close">先自己找找</button>
  `;
  el.modalBackdropEl.classList.add('open');

  el.modalCardEl.querySelector('#btn-cat-buy-treat')?.addEventListener('click', () => {
    const bought = buyCatTreats(deps.getSaveData(), 'single');
    if (bought.ok) {
      deps.setSaveData(bought.save);
      deps.platform.saveProgress(bought.save);
      deps.audio.play('meow_happy');
      el.modalBackdropEl.classList.remove('open');
      spawnFloatToast(el.petEl.getBoundingClientRect(), '购入猫条 +1 · 点橘猫寻物!', '#FFD147');
      deps.onRender();
    }
  });
  el.modalCardEl.querySelector('#btn-cat-ad')?.addEventListener('click', () => {
    el.modalBackdropEl.classList.remove('open');
    void deps.onHandleAdAction('cat_pet_extra', () => {
      deps.getSession().grantAdCatGift();
    });
  });
  el.modalCardEl.querySelector('#btn-open-shop')?.addEventListener('click', () => {
    el.modalBackdropEl.classList.remove('open');
    openShopDailyModal(deps, 'shop');
  });
  el.modalCardEl.querySelector('#btn-cat-close')?.addEventListener('click', () => {
    el.modalBackdropEl.classList.remove('open');
  });
}

export function openShopDailyModal(deps: GameModalDeps, focus: 'shop' | 'daily' = 'shop'): void {
  const { el } = deps;
  const save = syncLives(syncDailyReset(deps.getSaveData()), Date.now()).save;
  deps.setSaveData(save);
  deps.platform.saveProgress(save);

  const freeLeft = Math.max(0, DAILY_FREE_LIMIT - save.dailyFreeClaimed);
  const adLeft = Math.max(0, DAILY_AD_LIMIT - save.dailyAdClaimed);
  const clearsLeft = getClearsUntilNextPetReward(save);
  const progressInCycle = CLEARS_PER_PET_REWARD - clearsLeft;
  const coins = save.coins ?? 0;

  el.profileCardEl.innerHTML = `
    <h2><img class="ui-ico md" src="${WEB_UI_ICONS.shop}" alt="" /> 猫条小铺 & 补给站</h2>
    <p class="modal-sub">${save.nickname} · ${getButlerRank(save.totalLevelsCleared).title}</p>

    <div class="profile-grid">
      <div class="profile-stat">
        <b>${coins}</b>
        <span>金币余额</span>
      </div>
      <div class="profile-stat">
        <b>${save.petTreats}</b>
        <span>猫条库存</span>
      </div>
      <div class="profile-stat">
        <b>${save.lives}/${MAX_LIVES}</b>
        <span>剩余体力</span>
      </div>
    </div>

    <div class="modal-scroll" style="max-height:52vh;">
      <div class="shop-grid">
        <div class="shop-item" style="${focus === 'shop' ? 'background:#FFF4DF;' : ''}">
          <div class="shop-item-left">
            <img class="ui-ico lg" src="${WEB_UI_ICONS.catTreat}" alt="" />
            <div>
              <strong>单根美味猫条 ×1</strong>
              <span>撸猫2下即可替你精准找出 1 件目标物</span>
            </div>
          </div>
          <button class="shop-buy-btn" id="buy-treat-1" ${coins >= CAT_TREAT_PRICE ? '' : 'disabled'}>
            <img class="ui-ico" src="${WEB_UI_ICONS.coin}" alt="" /> ${CAT_TREAT_PRICE}
          </button>
        </div>

        <div class="shop-item" style="${focus === 'shop' ? 'background:#FFF4DF;' : ''}">
          <div class="shop-item-left">
            <img class="ui-ico lg" src="${WEB_UI_ICONS.catTreat}" alt="" />
            <div>
              <strong>超值猫条礼盒 ×3</strong>
              <span>立省 20 金币，关卡内反复呼叫橘猫寻物</span>
            </div>
          </div>
          <button class="shop-buy-btn" id="buy-treat-3" ${coins >= CAT_TREAT_PACK3_PRICE ? '' : 'disabled'}>
            <img class="ui-ico" src="${WEB_UI_ICONS.coin}" alt="" /> ${CAT_TREAT_PACK3_PRICE}
          </button>
        </div>

        <div class="shop-item">
          <div class="shop-item-left">
            <img class="ui-ico lg" src="${WEB_UI_ICONS.heart}" alt="" />
            <div>
              <strong>元气体力补给 +1</strong>
              <span>立即恢复 1 次挑战机会（满 5 次不可购）</span>
            </div>
          </div>
          <button class="shop-buy-btn" id="buy-life-1" ${coins >= LIFE_COIN_PRICE && save.lives < MAX_LIVES ? '' : 'disabled'}>
            <img class="ui-ico" src="${WEB_UI_ICONS.coin}" alt="" /> ${LIFE_COIN_PRICE}
          </button>
        </div>
      </div>

      <div class="milestone-banner">
        <img class="ui-ico" src="${WEB_UI_ICONS.paw}" alt="" />
        <span>闯关进度 (${progressInCycle}/${CLEARS_PER_PET_REWARD})：再通关 <strong>${clearsLeft}</strong> 关送 +1 猫条</span>
      </div>

      <button class="btn-primary" id="btn-claim-free" ${freeLeft <= 0 ? 'disabled' : ''}>
        <img class="ui-ico" src="${WEB_UI_ICONS.dailyGift}" alt="" />
        ${freeLeft > 0 ? `每日免费领 +1 猫条 +${DAILY_FREE_COINS} 金币 (余 ${freeLeft}/${DAILY_FREE_LIMIT})` : `今日免费补给已领完 (${DAILY_FREE_LIMIT}/${DAILY_FREE_LIMIT})`}
      </button>

      <button class="btn-secondary" id="btn-claim-ad" ${adLeft <= 0 ? 'disabled' : ''}>
        <img class="ui-ico" src="${WEB_UI_ICONS.ad}" alt="" />
        ${adLeft > 0 ? `看广告额外领 +1 猫条 (今日余 ${adLeft}/${DAILY_AD_LIMIT})` : '今日广告补给已领完'}
      </button>
    </div>

    <button class="btn-secondary" id="btn-profile-close">返回</button>
  `;

  el.profileBackdropEl.classList.add('open');

  el.profileCardEl.querySelector('#buy-treat-1')?.addEventListener('click', () => {
    const res = buyCatTreats(deps.getSaveData(), 'single');
    if (res.ok) {
      deps.setSaveData(res.save);
      deps.platform.saveProgress(res.save);
      deps.audio.play('meow_happy');
      deps.onRender();
      openShopDailyModal(deps, 'shop');
    }
  });

  el.profileCardEl.querySelector('#buy-treat-3')?.addEventListener('click', () => {
    const res = buyCatTreats(deps.getSaveData(), 'pack3');
    if (res.ok) {
      deps.setSaveData(res.save);
      deps.platform.saveProgress(res.save);
      deps.audio.play('meow_happy');
      deps.onRender();
      openShopDailyModal(deps, 'shop');
    }
  });

  el.profileCardEl.querySelector('#buy-life-1')?.addEventListener('click', () => {
    const res = buyLifeWithCoins(deps.getSaveData(), Date.now());
    if (res.ok) {
      deps.setSaveData(res.save);
      deps.platform.saveProgress(res.save);
      deps.audio.play('booster');
      deps.onRender();
      openShopDailyModal(deps, 'shop');
    }
  });

  el.profileCardEl.querySelector('#btn-claim-free')?.addEventListener('click', () => {
    const claimed = claimDailyFree(deps.getSaveData());
    if (claimed.ok) {
      deps.setSaveData(claimed.save);
      deps.platform.saveProgress(claimed.save);
      deps.audio.play('meow_happy');
      deps.onRender();
      openShopDailyModal(deps, 'daily');
    }
  });

  el.profileCardEl.querySelector('#btn-claim-ad')?.addEventListener('click', () => {
    el.profileBackdropEl.classList.remove('open');
    void deps.onHandleAdAction('daily_cat_bonus', () => {
      const res = claimDailyAdBonus(deps.getSaveData());
      if (res.ok) {
        deps.setSaveData(res.save);
        deps.platform.saveProgress(res.save);
      }
    });
  });

  el.profileCardEl.querySelector('#btn-profile-close')?.addEventListener('click', () => {
    el.profileBackdropEl.classList.remove('open');
  });
}

export function renderOutcomeModal(
  deps: GameModalDeps,
  snap: SessionSnapshot,
  opts: {
    winModalShown: boolean;
    markWinModalShown: () => void;
    isWinReady: () => boolean;
    getLastVictoryMeta: () => VictoryDisplayMeta;
    getShots: () => { beforeShotUrl: string; afterShotUrl: string };
  }
): void {
  const { el } = deps;
  if (snap.status === 'playing') return;

  if (snap.status === 'failed_tray_full') {
    el.modalCardEl.innerHTML = `
      <h2>暂存槽满啦!</h2>
      <p class="modal-sub">槽位已满 ${snap.tray.length}/${snap.trayUnlockedSlots} 格。看一段激励视频移出最后 3 件杂物，继续整理。</p>
      <button class="btn-primary" id="btn-revive">
        <img class="ui-ico" src="${WEB_UI_ICONS.ad}" alt="" /> 看广告复活（移出 3 件）
      </button>
      <button class="btn-secondary" id="btn-restart">重新开始第 ${snap.levelNumber} 关 (-1体力)</button>
      <button class="btn-secondary" id="btn-fail-home">返回首页</button>
    `;
    el.modalBackdropEl.classList.add('open');
    el.modalCardEl.querySelector('#btn-revive')?.addEventListener('click', () => {
      void deps.onHandleAdAction('revive_clear_tray', () => deps.getSession().reviveClearTray(3));
    });
    el.modalCardEl.querySelector('#btn-restart')?.addEventListener('click', () => {
      deps.onTryEnterLevel(snap.levelNumber, { resetStreakOnRestart: true });
    });
    el.modalCardEl.querySelector('#btn-fail-home')?.addEventListener('click', () => {
      const next = resetWinStreak(deps.getSaveData());
      deps.setSaveData(next);
      deps.platform.saveProgress(next);
      el.modalBackdropEl.classList.remove('open');
      deps.onShowHomeWithTransition();
    });
    return;
  }

  if (snap.status === 'won' && !opts.winModalShown) {
    if (!opts.isWinReady()) return;
    opts.markWinModalShown();
    setTimeout(() => {
      const latest = deps.getSession().getSnapshot();
      if (latest.status !== 'won') return;
      const starsHtml = [0, 1, 2]
        .map(
          (i) =>
            `<img class="star-ico ${i < latest.starsEarned ? '' : 'dim'}" src="${WEB_UI_ICONS.star}" alt="star" />`
        )
        .join('');
      const meta = opts.getLastVictoryMeta();
      const totalCoinsRun = meta.clearCoinsAwarded + latest.coinsEarnedInSession;
      const unlockedRoom = meta.unlockedRoomId ? ROOM_CATALOG[meta.unlockedRoomId] : null;
      const { beforeShotUrl, afterShotUrl } = opts.getShots();

      const rewardsLine = `
        <div class="milestone-banner" style="flex-wrap:wrap;gap:8px;">
          <span><img class="ui-ico" src="${WEB_UI_ICONS.coin}" alt="" /> 金币 +${totalCoinsRun}${meta.streakBonusCoins > 0 ? ` (含连胜+${meta.streakBonusCoins})` : ''}</span>
          <span><img class="ui-ico" src="${WEB_UI_ICONS.heart}" alt="" /> 通关回血 +${meta.lifeGranted} 体力</span>
          ${meta.milestoneGranted > 0 ? `<span><img class="ui-ico" src="${WEB_UI_ICONS.catTreat}" alt="" /> 猫条 +${meta.milestoneGranted}</span>` : ''}
        </div>
        ${
          unlockedRoom
            ? `<div class="milestone-banner" style="background:linear-gradient(90deg, ${unlockedRoom.badgeBg}, #FFFDF9);">
                <img class="ui-ico" src="${WEB_UI_ICONS.crown}" alt="" />
                <span>新主题解锁：<strong>${unlockedRoom.name}</strong>（${unlockedRoom.tagline}）!</span>
              </div>`
            : ''
        }
      `;

      const compareHtml =
        beforeShotUrl && afterShotUrl
          ? `
          <div class="compare-grid">
            <div class="compare-box">
              <img src="${beforeShotUrl}" alt="整理前" />
              <div class="compare-label">整理前 · 杂乱满屋</div>
            </div>
            <div class="compare-box">
              <img src="${afterShotUrl}" alt="整理后" />
              <div class="compare-label">整理后 · 焕然一新</div>
            </div>
          </div>
        `
          : '';

      el.modalCardEl.innerHTML = `
        <div class="stars-row">${starsHtml}</div>
        <h2>第 ${latest.levelNumber} 关 收纳大成功!</h2>
        <p class="modal-sub">${latest.hostVictory}（用时 ${Math.round(latest.elapsedSec)} 秒）</p>
        ${rewardsLine}
        ${compareHtml}
        <button class="btn-primary" id="btn-next">进入第 ${latest.levelNumber + 1} 关 (-1体力)</button>
        <button class="btn-secondary" id="btn-win-share" style="background:#E5F8F2;">
          <img class="ui-ico" src="${WEB_UI_ICONS.share}" alt="" /> 分享战绩
        </button>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
          <button class="btn-secondary" style="margin-top:0;" id="btn-replay">再玩一次 (-1体力)</button>
          <button class="btn-secondary" style="margin-top:0;" id="btn-win-home">返回首页</button>
        </div>
      `;
      el.modalBackdropEl.classList.add('open');
      el.modalCardEl.querySelector('#btn-next')?.addEventListener('click', () => {
        deps.onTryEnterLevel(latest.levelNumber + 1);
      });
      el.modalCardEl.querySelector('#btn-win-share')?.addEventListener('click', () => {
        void deps.onTriggerVerifiedShare();
      });
      el.modalCardEl.querySelector('#btn-replay')?.addEventListener('click', () => {
        deps.onTryEnterLevel(latest.levelNumber);
      });
      el.modalCardEl.querySelector('#btn-win-home')?.addEventListener('click', () => {
        el.modalBackdropEl.classList.remove('open');
        deps.onShowHomeWithTransition();
      });
    }, 650);
  }
}

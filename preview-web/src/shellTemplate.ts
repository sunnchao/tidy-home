import { WEB_UI_ICONS } from '@shared/constants';

export interface ShellElements {
  shellEl: HTMLElement;
  homeScreenEl: HTMLElement;
  homeBgEl: HTMLImageElement;
  homeLivesPipsEl: HTMLElement;
  homeLivesTextEl: HTMLElement;
  homeLivesTimerEl: HTMLElement;
  homeCoinCountEl: HTMLElement;
  homeTreatCountEl: HTMLElement;
  homeRankTextEl: HTMLElement;
  homeCatStageEl: HTMLElement;
  homeCatBubbleEl: HTMLElement;
  homeCatCanvasEl: HTMLCanvasElement;
  homeNextThumbEl: HTMLImageElement;
  homeNextTitleEl: HTMLElement;
  homeNextSubEl: HTMLElement;
  homePlayLabelEl: HTMLElement;
  homeShopDotEl: HTMLElement;
  homePlayBtnEl: HTMLElement;
  homeLivesPillEl: HTMLElement;
  homeSettingsTopEl: HTMLElement;
  homeBackBtnEl: HTMLElement;
  gameSettingsBtnEl: HTMLElement;
  gmBtnEl: HTMLElement;

  boardEl: HTMLElement;
  boardViewportEl: HTMLElement;
  roomBgEl: HTMLImageElement;
  tintEl: HTMLElement;
  pileShadowsLayerEl: HTMLElement;
  feverAuraEl: HTMLElement;
  itemsLayerEl: HTMLElement;
  boxesLayerEl: HTMLElement;
  petEl: HTMLElement;
  petCanvasEl: HTMLCanvasElement;
  petBubbleEl: HTMLElement;
  petBadgeEl: HTMLElement;
  flashCanvas: HTMLCanvasElement;
  zoomInBtnEl: HTMLButtonElement;
  zoomOutBtnEl: HTMLButtonElement;
  zoomLabelEl: HTMLButtonElement;

  levelNumEl: HTMLElement;
  levelNameEl: HTMLElement;
  modifierBadgeEl: HTMLElement;
  progressFillEl: HTMLElement;
  progressTextEl: HTMLElement;
  hostTextEl: HTMLElement;
  ordersRowEl: HTMLElement;
  comboEl: HTMLElement;
  trayRackEl: HTMLElement;
  boostersRowEl: HTMLElement;
  gmDrawerEl: HTMLElement;

  modalBackdropEl: HTMLElement;
  modalCardEl: HTMLElement;
  profileBackdropEl: HTMLElement;
  profileCardEl: HTMLElement;
  subBackdropEl: HTMLElement;
  subCardEl: HTMLElement;
  shareModalBackdropEl: HTMLElement;
  shareModalCardEl: HTMLElement;
  adModalBackdropEl: HTMLElement;
  adModalCardEl: HTMLElement;

  transitionEl: HTMLElement;
  transitionCardEl: HTMLElement;
  transitionTitleEl: HTMLElement;
  transitionSubEl: HTMLElement;
}

export function mountShell(root: HTMLElement): ShellElements {
  root.innerHTML = `
    <div class="phone-shell">
      <div class="board-stage">
        <div class="board-viewport">
          <img class="room-bg" alt="room" />
          <div class="time-tint"></div>
          <div class="scene-vignette"></div>
          <div class="pile-shadows-layer"></div>
          <div class="items-layer"></div>
          <div class="boxes-layer"></div>
        </div>
        <canvas class="flashlight-canvas"></canvas>
        <div class="fever-aura"></div>
        <div class="fx-layer"></div>
        <div class="pet-cat">
          <canvas class="cat-canvas" width="220" height="220"></canvas>
          <div class="cat-bubble"></div>
          <div class="cat-pet-badge"></div>
        </div>
        <div class="zoom-controls">
          <button class="zoom-btn zoom-in-btn" type="button" title="放大房间">
            <img class="ui-ico md" src="${WEB_UI_ICONS.zoomIn}" alt="放大" />
          </button>
          <button class="zoom-label" type="button" title="重置缩放">1.0×</button>
          <button class="zoom-btn zoom-out-btn" type="button" title="缩小房间">
            <img class="ui-ico md" src="${WEB_UI_ICONS.zoomOut}" alt="缩小" />
          </button>
        </div>
      </div>

      <header class="hud-top">
        <div class="top-bar">
          <div style="display:flex;align-items:center;gap:4px;min-width:0">
            <button class="icon-pill home-back-btn" type="button" title="返回首页">
              <img class="ui-ico" src="${WEB_UI_ICONS.home}" alt="首页" />
            </button>
            <div class="level-pill">
              <span class="level-num">Lv.1</span>
              <span class="level-name">暖阳客厅</span>
            </div>
          </div>
          <div class="top-actions">
            <button class="icon-pill game-settings-btn" type="button" title="暂停与设置">
              <img class="ui-ico" src="${WEB_UI_ICONS.settings}" alt="设置" />
            </button>
            <button class="icon-pill gm-btn" type="button">GM</button>
          </div>
        </div>

        <div class="progress-row">
          <div class="progress-track"><div class="progress-fill"></div></div>
          <span class="modifier-badge" style="display:none;"></span>
          <div class="progress-text">0/18</div>
        </div>
        <div class="host-banner">
          <span class="host-tag">房主</span>
          <span class="host-text"></span>
        </div>
        <div class="orders-row"></div>
        <div class="tray-rack"></div>
      </header>

      <div class="combo-floating"></div>

      <footer class="hud-bottom">
        <div class="boosters-row"></div>
      </footer>

      <section class="home-screen">
        <img class="home-bg" src="/resources/rooms/living_room.jpg" alt="home room" />
        <div class="home-veil"></div>
        <div class="home-top">
          <div class="home-top-left">
            <button class="lives-pill home-lives-pill" type="button" title="默认5次机会 · 每10分钟恢复1次">
              <img class="ui-ico" src="${WEB_UI_ICONS.heart}" alt="体力" />
              <span class="life-pips home-lives-pips"></span>
              <span class="home-lives-text">5/5</span>
              <span class="life-timer home-lives-timer"></span>
            </button>
            <div class="coin-pill home-coin-pill stat-pill-static" title="当前金币">
              <img class="ui-ico" src="${WEB_UI_ICONS.coin}" alt="金币" />
              <span class="home-coin-count">100</span>
            </div>
            <div class="icon-pill treat-pill home-treat-pill stat-pill-static" title="当前猫条">
              <img class="ui-ico" src="${WEB_UI_ICONS.catTreat}" alt="猫条" />
              <span class="home-treat-count">2</span>
            </div>
          </div>
          <div class="top-actions">
            <button class="icon-pill home-settings-top" type="button" title="设置">
              <img class="ui-ico" src="${WEB_UI_ICONS.settings}" alt="设置" />
            </button>
          </div>
        </div>

        <div class="home-hero">
          <div class="home-title-card">
            <h1>我来收纳</h1>
            <p>暖系多主题整理 · 把混乱房间变整洁</p>
            <div class="home-rank-row">
              <img class="ui-ico" src="${WEB_UI_ICONS.crown}" alt="" />
              <span class="home-rank-text">见习整理员</span>
            </div>
          </div>
          <div class="home-cat-stage" title="点击撸猫互动">
            <div class="home-cat-bubble">
              <span class="bubble-measure"></span>
              <span class="bubble-live"><span class="bubble-txt"></span><span class="bubble-caret"></span></span>
            </div>
            <canvas class="home-cat-canvas" width="256" height="256"></canvas>
          </div>
          <div class="home-progress-card">
            <img class="home-room-thumb" src="/resources/rooms/living_room.jpg" alt="主题预览" />
            <div class="home-progress-left">
              <strong class="home-next-title">第 1 关 · 暖阳客厅</strong>
              <span class="home-next-sub">通关第 1 关解锁「泡沫浴室」新主题!</span>
            </div>
          </div>
        </div>

        <div class="home-actions-area">
          <button class="home-play-btn" type="button">
            <span class="home-play-main">
              <img class="ui-ico md" src="${WEB_UI_ICONS.check}" alt="" />
              <span class="home-play-label">开始整理 · 第 1 关</span>
            </span>
            <span class="cta-cost-pill">
              <img class="ui-ico" src="${WEB_UI_ICONS.heart}" alt="体力" />
              <span>-1</span>
            </span>
          </button>
          <div class="home-menu-grid">
            <button class="home-menu-btn" data-home-menu="shop" type="button">
              <span class="red-dot home-shop-dot"></span>
              <img class="ui-ico lg" src="${WEB_UI_ICONS.shop}" alt="猫条小铺" />
              <span>猫条小铺</span>
            </button>
            <button class="home-menu-btn" data-home-menu="share" type="button">
              <img class="ui-ico lg" src="${WEB_UI_ICONS.share}" alt="" />
              <span>分享游戏</span>
            </button>
            <button class="home-menu-btn" data-home-menu="help" type="button">
              <img class="ui-ico lg" src="${WEB_UI_ICONS.help}" alt="玩法说明" />
              <span>玩法说明</span>
            </button>
          </div>
        </div>
      </section>

      <aside class="gm-drawer">
        <div class="gm-title">GM 试玩控制台</div>
        <button class="gm-action" data-gm="flashlight">开关停电手电筒</button>
        <button class="gm-action" data-gm="cat">立即召唤橘猫捣乱</button>
        <button class="gm-action" data-gm="coins">金币 +200</button>
        <button class="gm-action" data-gm="treats">猫条 +3</button>
        <button class="gm-action" data-gm="spendLife">测试扣 1 点体力</button>
        <button class="gm-action" data-gm="fullLives">立即补满 5 点体力</button>
        <button class="gm-action" data-gm="unlockThemes">解锁全部 6 个主题房间</button>
        <button class="gm-action" data-gm="resetDaily">重置今日每日&分享状态</button>
        <button class="gm-action" data-gm="boosters">补满全部道具 (+3)</button>
        <button class="gm-action" data-gm="reset">清空全部档案重开 Lv.1</button>
      </aside>

      <div class="modal-backdrop"><div class="modal-card"></div></div>
      <div class="modal-backdrop profile-backdrop"><div class="modal-card profile-card"></div></div>
      <div class="modal-backdrop sub-backdrop"><div class="modal-card sub-card"></div></div>
      <div class="modal-backdrop share-backdrop"><div class="modal-card share-card"></div></div>
      <div class="modal-backdrop ad-backdrop"><div class="modal-card ad-card"></div></div>

      <div class="scene-transition">
        <div class="transition-card">
          <div class="transition-badge"><img class="ui-ico" src="${WEB_UI_ICONS.paw}" alt="" /> 准备整理中</div>
          <div class="transition-title">第 1 关</div>
          <div class="transition-sub">正在切换到房间...</div>
        </div>
      </div>
    </div>
  `;

  const q = <T extends Element>(sel: string) => root.querySelector(sel) as T;
  return {
    shellEl: q('.phone-shell'),
    homeScreenEl: q('.home-screen'),
    homeBgEl: q('.home-bg'),
    homeLivesPipsEl: q('.home-lives-pips'),
    homeLivesTextEl: q('.home-lives-text'),
    homeLivesTimerEl: q('.home-lives-timer'),
    homeCoinCountEl: q('.home-coin-count'),
    homeTreatCountEl: q('.home-treat-count'),
    homeRankTextEl: q('.home-rank-text'),
    homeCatStageEl: q('.home-cat-stage'),
    homeCatBubbleEl: q('.home-cat-bubble'),
    homeCatCanvasEl: q('.home-cat-canvas'),
    homeNextThumbEl: q('.home-room-thumb'),
    homeNextTitleEl: q('.home-next-title'),
    homeNextSubEl: q('.home-next-sub'),
    homePlayLabelEl: q('.home-play-label'),
    homeShopDotEl: q('.home-shop-dot'),
    homePlayBtnEl: q('.home-play-btn'),
    homeLivesPillEl: q('.home-lives-pill'),
    homeSettingsTopEl: q('.home-settings-top'),
    homeBackBtnEl: q('.home-back-btn'),
    gameSettingsBtnEl: q('.game-settings-btn'),
    gmBtnEl: q('.gm-btn'),

    boardEl: q('.board-stage'),
    boardViewportEl: q('.board-viewport'),
    roomBgEl: q('.room-bg'),
    tintEl: q('.time-tint'),
    pileShadowsLayerEl: q('.pile-shadows-layer'),
    feverAuraEl: q('.fever-aura'),
    itemsLayerEl: q('.items-layer'),
    boxesLayerEl: q('.boxes-layer'),
    petEl: q('.pet-cat'),
    petCanvasEl: q('.pet-cat canvas.cat-canvas'),
    petBubbleEl: q('.cat-bubble'),
    petBadgeEl: q('.cat-pet-badge'),
    flashCanvas: q('.flashlight-canvas'),
    zoomInBtnEl: q('.zoom-in-btn'),
    zoomOutBtnEl: q('.zoom-out-btn'),
    zoomLabelEl: q('.zoom-label'),

    levelNumEl: q('.level-num'),
    levelNameEl: q('.level-name'),
    modifierBadgeEl: q('.modifier-badge'),
    progressFillEl: q('.progress-fill'),
    progressTextEl: q('.progress-text'),
    hostTextEl: q('.host-text'),
    ordersRowEl: q('.orders-row'),
    comboEl: q('.combo-floating'),
    trayRackEl: q('.tray-rack'),
    boostersRowEl: q('.boosters-row'),
    gmDrawerEl: q('.gm-drawer'),

    modalBackdropEl: q('.modal-backdrop'),
    modalCardEl: q('.modal-card'),
    profileBackdropEl: q('.profile-backdrop'),
    profileCardEl: q('.profile-card'),
    subBackdropEl: q('.sub-backdrop'),
    subCardEl: q('.sub-card'),
    shareModalBackdropEl: q('.share-backdrop'),
    shareModalCardEl: q('.share-card'),
    adModalBackdropEl: q('.ad-backdrop'),
    adModalCardEl: q('.ad-card'),

    transitionEl: q('.scene-transition'),
    transitionCardEl: q('.transition-card'),
    transitionTitleEl: q('.transition-title'),
    transitionSubEl: q('.transition-sub'),
  };
}

import { ITEM_BY_ID, ROOM_CATALOG, ROOM_ORDER } from '@core/catalogs';
import { GameSession } from '@core/gameSession';
import type {
  AdPlacement,
  BoosterType,
  GameEvent,
  SaveData,
  SessionSnapshot,
} from '@core/types';
import {
  canClaimDailyAdBonus,
  canClaimDailyFree,
  claimDailyAdBonus,
  claimDailyFree,
  CLEARS_PER_PET_REWARD,
  DAILY_AD_LIMIT,
  DAILY_FREE_LIMIT,
  getClearsUntilNextPetReward,
  getLocalDateKey,
  recordLevelVictory,
  syncDailyReset,
  updateNickname,
} from '@core/userProfile';
import { MockPlatformAdapter } from '@platform/MockPlatformAdapter';
import { WebAudioPlayer } from './audioPlayer';

const AD_LABELS: Record<AdPlacement, string> = {
  unlock_order_box: '解锁第 3 个并行订单箱（本关永久生效）',
  unlock_tray_slot: '额外扩容 +1 个暂存槽（本关生效）',
  revive_clear_tray: '清空最后 3 件暂存杂物并复活继续',
  booster_magnet: '领取 1 个「强力磁铁」并立即吸附目标',
  booster_undo: '领取 1 个「撤销」并退回误点杂物',
  booster_hint: '领取 1 个「线索提示」定位目标物',
  booster_shuffle: '领取 1 个「重新洗牌」翻开底层物品',
  cat_pet_extra: '喂给橘猫一根专属猫条，让它立刻叼出 1 件目标物',
  daily_cat_bonus: '领取今日额外摸猫机会 +1',
};

const UI_ICON = {
  magnet: '/resources/ui/icon_magnet.png',
  undo: '/resources/ui/icon_undo.png',
  hint: '/resources/ui/icon_hint.png',
  shuffle: '/resources/ui/icon_shuffle.png',
  ad: '/resources/ui/icon_ad.png',
  star: '/resources/ui/icon_star.png',
  soundOn: '/resources/ui/icon_sound_on.png',
  soundOff: '/resources/ui/icon_sound_off.png',
  dailyGift: '/resources/ui/icon_daily_gift.png',
  catTreat: '/resources/ui/icon_cat_treat.png',
  flashlight: '/resources/ui/icon_flashlight.png',
  paw: '/resources/ui/icon_paw.png',
  check: '/resources/ui/icon_check.png',
  flame: '/resources/ui/icon_flame.png',
  home: '/resources/ui/icon_home.png',
  settings: '/resources/ui/icon_settings.png',
  rooms: '/resources/ui/icon_rooms.png',
  help: '/resources/ui/icon_help.png',
  vibrate: '/resources/ui/icon_vibrate.png',
  replay: '/resources/ui/icon_replay.png',
  shield: '/resources/ui/icon_shield.png',
};

class TidyHomeWebApp {
  private root: HTMLElement;
  private platform = new MockPlatformAdapter();
  private audio = new WebAudioPlayer();
  private saveData: SaveData;
  private session!: GameSession;

  private screen: 'home' | 'game' = 'home';
  private blackoutOverride: boolean | null = null;
  private flashNormX = 0.5;
  private flashNormY = 0.56;
  private flashBurstUids = new Set<string>();
  private beforeShotUrl = '';
  private afterShotUrl = '';
  private winModalShown = false;
  private lastMilestoneGranted = 0;
  private lastTickMs = performance.now();

  // DOM refs
  private shellEl!: HTMLElement;
  private homeScreenEl!: HTMLElement;
  private homeBgEl!: HTMLImageElement;
  private homeNickEl!: HTMLElement;
  private homeTreatCountEl!: HTMLElement;
  private homeStarCountEl!: HTMLElement;
  private homeNextTitleEl!: HTMLElement;
  private homeNextSubEl!: HTMLElement;
  private homePlayLabelEl!: HTMLElement;
  private homeDailyDotEl!: HTMLElement;

  private boardEl!: HTMLElement;
  private roomBgEl!: HTMLImageElement;
  private tintEl!: HTMLElement;
  private feverAuraEl!: HTMLElement;
  private itemsLayerEl!: HTMLElement;
  private boxesLayerEl!: HTMLElement;
  private petEl!: HTMLElement;
  private petImgEl!: HTMLImageElement;
  private petBubbleEl!: HTMLElement;
  private petBadgeEl!: HTMLElement;
  private flashCanvas!: HTMLCanvasElement;
  private levelNumEl!: HTMLElement;
  private levelNameEl!: HTMLElement;
  private treatCountEl!: HTMLElement;
  private dailyDotEl!: HTMLElement;
  private starBadgeEl!: HTMLElement;
  private progressFillEl!: HTMLElement;
  private progressTextEl!: HTMLElement;
  private hostTextEl!: HTMLElement;
  private ordersRowEl!: HTMLElement;
  private comboEl!: HTMLElement;
  private trayRackEl!: HTMLElement;
  private boostersRowEl!: HTMLElement;
  private gmDrawerEl!: HTMLElement;
  private modalBackdropEl!: HTMLElement;
  private modalCardEl!: HTMLElement;
  private profileBackdropEl!: HTMLElement;
  private profileCardEl!: HTMLElement;
  private subBackdropEl!: HTMLElement;
  private subCardEl!: HTMLElement;
  private adModalBackdropEl!: HTMLElement;
  private adModalCardEl!: HTMLElement;

  private unsubscribeSession: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.saveData = syncDailyReset(this.platform.loadSave());
    this.platform.saveProgress(this.saveData);
    this.audio.muted = this.saveData.muted;
    this.mountShell();
    this.setupAdOverlay();
    this.startLevel(this.saveData.currentLevel);
    this.showScreen('home');
    requestAnimationFrame(this.loop);
  }

  private mountShell(): void {
    this.root.innerHTML = `
      <div class="phone-shell">
        <div class="board-stage">
          <img class="room-bg" alt="room" />
          <div class="time-tint"></div>
          <div class="items-layer"></div>
          <div class="boxes-layer"></div>
          <div class="pet-cat">
            <img class="cat-sprite" src="/resources/sprites/cat_idle.png" alt="cat" />
            <div class="cat-bubble"></div>
            <div class="cat-pet-badge"></div>
          </div>
          <canvas class="flashlight-canvas"></canvas>
          <div class="fever-aura"></div>
          <div class="fx-layer"></div>
        </div>

        <header class="hud-top">
          <div class="top-bar">
            <div style="display:flex;align-items:center;gap:4px;min-width:0">
              <button class="icon-pill home-back-btn" type="button" title="返回首页">
                <img class="ui-ico" src="${UI_ICON.home}" alt="首页" />
              </button>
              <div class="level-pill">
                <span class="level-num">Lv.1</span>
                <span class="level-name">暖阳客厅</span>
              </div>
            </div>
            <div class="top-actions">
              <button class="icon-pill treat-pill" type="button" title="摸猫机会与档案">
                <img class="ui-ico" src="${UI_ICON.catTreat}" alt="猫条" />
                <span class="treat-count">2</span>
              </button>
              <button class="icon-pill gift-pill" type="button" title="每日领取">
                <img class="ui-ico" src="${UI_ICON.dailyGift}" alt="每日领取" />
                <span class="red-dot"></span>
              </button>
              <button class="icon-pill star-pill" type="button">
                <img class="ui-ico" src="${UI_ICON.star}" alt="星数" />
                <span class="star-badge">0</span>
              </button>
              <button class="icon-pill game-settings-btn" type="button" title="暂停与设置">
                <img class="ui-ico" src="${UI_ICON.settings}" alt="设置" />
              </button>
              <button class="icon-pill gm-btn" type="button">GM</button>
            </div>
          </div>
          <div class="progress-row">
            <div class="progress-track"><div class="progress-fill"></div></div>
            <div class="progress-text">0/18</div>
          </div>
          <div class="host-banner">
            <span class="host-tag">房主</span>
            <span class="host-text"></span>
          </div>
          <div class="orders-row"></div>
        </header>

        <div class="combo-floating"></div>

        <footer class="hud-bottom">
          <div class="tray-rack"></div>
          <div class="boosters-row"></div>
        </footer>

        <section class="home-screen">
          <img class="home-bg" src="/resources/rooms/living_room.png" alt="home room" />
          <div class="home-veil"></div>
          <div class="home-top">
            <button class="icon-pill home-profile-btn" type="button">
              <img class="ui-ico" src="${UI_ICON.paw}" alt="" />
              <span class="home-nick">收纳小管家</span>
            </button>
            <div class="top-actions">
              <button class="icon-pill treat-pill home-treat-pill" type="button">
                <img class="ui-ico" src="${UI_ICON.catTreat}" alt="猫条" />
                <span class="home-treat-count">2</span>
              </button>
              <button class="icon-pill star-pill home-star-pill" type="button">
                <img class="ui-ico" src="${UI_ICON.star}" alt="星数" />
                <span class="home-star-count">0</span>
              </button>
              <button class="icon-pill home-settings-top" type="button" title="设置">
                <img class="ui-ico" src="${UI_ICON.settings}" alt="设置" />
              </button>
            </div>
          </div>

          <div class="home-hero">
            <div class="home-title-card">
              <h1>收纳小当家</h1>
              <p>暖系无限找物整理 · 把混乱房间变整洁</p>
            </div>
            <div class="home-cat-stage">
              <div class="home-cat-bubble">喵~ 今天也一起把房间收拾得干干净净吧!</div>
              <img class="home-cat-img" src="/resources/sprites/cat_idle.png" alt="橘猫" />
            </div>
            <div class="home-progress-card">
              <div class="home-progress-left">
                <strong class="home-next-title">第 1 关 · 暖阳客厅</strong>
                <span class="home-next-sub">累计通关 0 关 · 再过 2 关送 +1 摸猫机会</span>
              </div>
              <button class="icon-pill home-rooms-quick" type="button">
                <img class="ui-ico" src="${UI_ICON.rooms}" alt="" /> 选关
              </button>
            </div>
          </div>

          <div class="home-actions-area">
            <button class="home-play-btn" type="button">
              <img class="ui-ico md" src="${UI_ICON.check}" alt="" />
              <span class="home-play-label">开始整理 · 第 1 关</span>
            </button>
            <div class="home-menu-grid">
              <button class="home-menu-btn" data-home-menu="daily" type="button">
                <span class="red-dot home-daily-dot"></span>
                <img class="ui-ico lg" src="${UI_ICON.dailyGift}" alt="每日领取" />
                <span>每日补给</span>
              </button>
              <button class="home-menu-btn" data-home-menu="rooms" type="button">
                <img class="ui-ico lg" src="${UI_ICON.rooms}" alt="房间选关" />
                <span>房间选关</span>
              </button>
              <button class="home-menu-btn" data-home-menu="help" type="button">
                <img class="ui-ico lg" src="${UI_ICON.help}" alt="玩法说明" />
                <span>玩法说明</span>
              </button>
              <button class="home-menu-btn" data-home-menu="settings" type="button">
                <img class="ui-ico lg" src="${UI_ICON.settings}" alt="系统设置" />
                <span>设置</span>
              </button>
            </div>
          </div>
        </section>

        <aside class="gm-drawer">
          <div class="gm-title">GM 试玩控制台</div>
          <button class="gm-action" data-gm="flashlight">开关停电手电筒</button>
          <button class="gm-action" data-gm="cat">立即召唤橘猫捣乱</button>
          <button class="gm-action" data-gm="treats">摸猫机会 +3</button>
          <button class="gm-action" data-gm="resetDaily">重置今日每日领取状态</button>
          <button class="gm-action" data-gm="boosters">补满全部道具 (+3)</button>
          <button class="gm-action" data-gm="reset">清空全部档案重开 Lv.1</button>
        </aside>

        <div class="modal-backdrop">
          <div class="modal-card"></div>
        </div>

        <div class="modal-backdrop profile-backdrop">
          <div class="modal-card profile-card"></div>
        </div>

        <div class="modal-backdrop sub-backdrop">
          <div class="modal-card sub-card"></div>
        </div>

        <div class="modal-backdrop ad-backdrop">
          <div class="modal-card ad-card"></div>
        </div>
      </div>
    `;

    const q = <T extends Element>(sel: string) => this.root.querySelector(sel) as T;
    this.shellEl = q('.phone-shell');
    this.homeScreenEl = q('.home-screen');
    this.homeBgEl = q('.home-bg');
    this.homeNickEl = q('.home-nick');
    this.homeTreatCountEl = q('.home-treat-count');
    this.homeStarCountEl = q('.home-star-count');
    this.homeNextTitleEl = q('.home-next-title');
    this.homeNextSubEl = q('.home-next-sub');
    this.homePlayLabelEl = q('.home-play-label');
    this.homeDailyDotEl = q('.home-daily-dot');

    this.boardEl = q('.board-stage');
    this.roomBgEl = q('.room-bg');
    this.tintEl = q('.time-tint');
    this.feverAuraEl = q('.fever-aura');
    this.itemsLayerEl = q('.items-layer');
    this.boxesLayerEl = q('.boxes-layer');
    this.petEl = q('.pet-cat');
    this.petImgEl = q('.pet-cat img.cat-sprite');
    this.petBubbleEl = q('.cat-bubble');
    this.petBadgeEl = q('.cat-pet-badge');
    this.flashCanvas = q('.flashlight-canvas');
    this.levelNumEl = q('.level-num');
    this.levelNameEl = q('.level-name');
    this.treatCountEl = q('.treat-count');
    this.dailyDotEl = q('.gift-pill .red-dot');
    this.starBadgeEl = q('.star-badge');
    this.progressFillEl = q('.progress-fill');
    this.progressTextEl = q('.progress-text');
    this.hostTextEl = q('.host-text');
    this.ordersRowEl = q('.orders-row');
    this.comboEl = q('.combo-floating');
    this.trayRackEl = q('.tray-rack');
    this.boostersRowEl = q('.boosters-row');
    this.gmDrawerEl = q('.gm-drawer');
    this.modalBackdropEl = q('.modal-backdrop');
    this.modalCardEl = q('.modal-card');
    this.profileBackdropEl = q('.profile-backdrop');
    this.profileCardEl = q('.profile-card');
    this.subBackdropEl = q('.sub-backdrop');
    this.subCardEl = q('.sub-card');
    this.adModalBackdropEl = q('.ad-backdrop');
    this.adModalCardEl = q('.ad-card');

    this.shellEl.addEventListener('pointerdown', (e) => {
      this.audio.unlockAndPreload();
      const target = e.target as HTMLElement;
      if (!target.closest('.gm-drawer') && !target.closest('.gm-btn')) {
        this.gmDrawerEl.classList.remove('open');
      }
    });
    this.boardEl.addEventListener('pointermove', this.onBoardPointerMove);
    this.boardEl.addEventListener('pointerdown', this.onBoardPointerMove);

    this.petEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.audio.unlockAndPreload();
      this.handlePetCatClick();
    });

    // Home interactions
    q('.home-play-btn').addEventListener('click', () => {
      this.enterGameAtLevel(this.saveData.currentLevel);
    });
    q('.home-profile-btn').addEventListener('click', () => this.openProfileDailyModal());
    q('.home-treat-pill').addEventListener('click', () => this.openProfileDailyModal());
    q('.home-star-pill').addEventListener('click', () => this.openRoomsModal());
    q('.home-settings-top').addEventListener('click', () => this.openSettingsModal(false));
    q('.home-rooms-quick').addEventListener('click', () => this.openRoomsModal());

    this.homeScreenEl.querySelectorAll<HTMLElement>('[data-home-menu]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.homeMenu;
        if (key === 'daily') this.openProfileDailyModal();
        else if (key === 'rooms') this.openRoomsModal();
        else if (key === 'help') this.openHelpModal();
        else if (key === 'settings') this.openSettingsModal(false);
      });
    });

    // In-game top actions
    q('.home-back-btn').addEventListener('click', () => {
      this.showScreen('home');
    });
    q('.treat-pill').addEventListener('click', () => this.openProfileDailyModal());
    q('.gift-pill').addEventListener('click', () => this.openProfileDailyModal());
    q('.star-pill').addEventListener('click', () => this.openRoomsModal());
    q('.game-settings-btn').addEventListener('click', () => this.openSettingsModal(true));

    q('.gm-btn').addEventListener('click', () => {
      this.gmDrawerEl.classList.toggle('open');
    });

    this.gmDrawerEl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-gm]');
      if (!btn) return;
      const action = btn.dataset.gm;
      this.gmDrawerEl.classList.remove('open');
      if (action === 'flashlight') {
        const currentBlackout = this.isBlackoutActive(this.session.getSnapshot());
        this.blackoutOverride = !currentBlackout;
        this.drawFlashlight();
      } else if (action === 'cat') {
        this.session.forceCatMischief();
        this.render();
      } else if (action === 'treats') {
        this.saveData.petTreats += 3;
        this.platform.saveProgress(this.saveData);
        this.audio.play('booster');
        this.render();
      } else if (action === 'resetDaily') {
        this.saveData.dailyClaimDate = getLocalDateKey();
        this.saveData.dailyFreeClaimed = 0;
        this.saveData.dailyAdClaimed = 0;
        this.platform.saveProgress(this.saveData);
        this.render();
        this.openProfileDailyModal();
      } else if (action === 'boosters') {
        this.session.refillBoosters(3);
        this.saveData.boosters = this.session.getBoosters();
        this.platform.saveProgress(this.saveData);
        this.audio.play('booster');
        this.render();
      } else if (action === 'reset') {
        this.platform.clearSave();
        this.saveData = syncDailyReset(this.platform.loadSave());
        this.audio.muted = this.saveData.muted;
        this.startLevel(1);
        this.showScreen('home');
      }
    });
  }

  private triggerVibrate(style: 'light' | 'medium' | 'heavy' = 'light'): void {
    if (!this.saveData.vibrationEnabled) return;
    this.platform.vibrateShort(style);
  }

  private isSimulationPaused(): boolean {
    if (this.screen !== 'game') return true;
    return (
      this.modalBackdropEl.classList.contains('open') ||
      this.profileBackdropEl.classList.contains('open') ||
      this.subBackdropEl.classList.contains('open') ||
      this.adModalBackdropEl.classList.contains('open')
    );
  }

  private showScreen(next: 'home' | 'game'): void {
    this.screen = next;
    this.homeScreenEl.classList.toggle('hidden', next !== 'home');
    this.gmDrawerEl.classList.remove('open');
    this.renderHome();
  }

  private enterGameAtLevel(levelNumber: number): void {
    const maxUnlocked = Math.max(this.saveData.highestLevel, this.saveData.currentLevel);
    const clampedLevel = Math.min(maxUnlocked, Math.max(1, Math.floor(levelNumber)));
    this.subBackdropEl.classList.remove('open');
    this.profileBackdropEl.classList.remove('open');
    this.modalBackdropEl.classList.remove('open');
    this.startLevel(clampedLevel);
    this.showScreen('game');
  }

  private renderHome(): void {
    const themeIdx = (this.saveData.currentLevel - 1) % ROOM_ORDER.length;
    const theme = ROOM_ORDER[themeIdx];
    const room = ROOM_CATALOG[theme];
    const clearsLeft = getClearsUntilNextPetReward(this.saveData);

    this.homeBgEl.src = room.bgWebUrl;
    this.homeNickEl.textContent = this.saveData.nickname;
    this.homeTreatCountEl.textContent = String(this.saveData.petTreats);
    this.homeStarCountEl.textContent = String(this.saveData.totalStars);
    this.homeNextTitleEl.textContent = `第 ${this.saveData.currentLevel} 关 · ${room.name}`;
    this.homeNextSubEl.textContent = `已通关 ${this.saveData.totalLevelsCleared} 关 · 再闯 ${clearsLeft} 关送 +1 摸猫机会`;
    this.homePlayLabelEl.textContent =
      this.saveData.totalLevelsCleared === 0 && this.saveData.currentLevel === 1
        ? '开始整理 · 第 1 关'
        : `继续整理 · 第 ${this.saveData.currentLevel} 关`;
    this.homeDailyDotEl.style.display = canClaimDailyFree(this.saveData) ? 'block' : 'none';
  }

  private openSettingsModal(inGame: boolean): void {
    let confirmReset = false;

    const draw = () => {
      const pauseButtons = inGame
        ? `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
            <button class="btn-primary" id="set-resume">继续整理</button>
            <button class="btn-secondary" style="margin-top:0;" id="set-replay">
              <img class="ui-ico" src="${UI_ICON.replay}" alt="" /> 重玩本关
            </button>
          </div>
          <button class="btn-secondary" style="margin-top:0;margin-bottom:10px;" id="set-home">
            <img class="ui-ico" src="${UI_ICON.home}" alt="" /> 返回首页大厅
          </button>
        `
        : '';

      this.subCardEl.innerHTML = `
        <h2><img class="ui-ico md" src="${UI_ICON.settings}" alt="" /> ${inGame ? '暂停与设置' : '系统设置'}</h2>
        <p class="modal-sub">管家编号：<strong>${this.saveData.userId}</strong></p>
        <div class="modal-scroll">
          ${pauseButtons}

          <div class="nick-row">
            <input class="nick-input" id="set-nick-input" maxlength="12" value="${this.saveData.nickname}" placeholder="输入管家昵称" />
            <button class="nick-save-btn" id="set-nick-save" type="button">保存</button>
          </div>

          <div class="setting-row">
            <span class="setting-label"><img class="ui-ico md" src="${this.saveData.muted ? UI_ICON.soundOff : UI_ICON.soundOn}" alt="" /> 游戏音效</span>
            <button class="toggle-btn ${this.saveData.muted ? 'off' : ''}" id="set-sfx" type="button">${this.saveData.muted ? '已关闭' : '已开启'}</button>
          </div>

          <div class="setting-row">
            <span class="setting-label"><img class="ui-ico md" src="${UI_ICON.vibrate}" alt="" /> 触感震动反馈</span>
            <button class="toggle-btn ${this.saveData.vibrationEnabled ? '' : 'off'}" id="set-vib" type="button">${this.saveData.vibrationEnabled ? '已开启' : '已关闭'}</button>
          </div>

          <div class="setting-row">
            <span class="setting-label"><img class="ui-ico md" src="${UI_ICON.soundOn}" alt="" /> 背景舒缓音乐 (预留)</span>
            <button class="toggle-btn ${this.saveData.bgmEnabled ? '' : 'off'}" id="set-bgm" type="button">${this.saveData.bgmEnabled ? '已开启' : '已关闭'}</button>
          </div>

          <button class="btn-secondary" id="set-privacy" type="button">
            <img class="ui-ico" src="${UI_ICON.shield}" alt="" /> 隐私保护指引
          </button>

          <button class="btn-danger ${confirmReset ? 'confirming' : ''}" id="set-reset" type="button">
            ${confirmReset ? '再次点击确认清空全部进度与星星' : '重置全部游戏进度'}
          </button>
        </div>

        <button class="btn-secondary" id="set-close" type="button">关闭</button>
      `;

      this.subCardEl.querySelector('#set-resume')?.addEventListener('click', () => {
        this.subBackdropEl.classList.remove('open');
      });
      this.subCardEl.querySelector('#set-replay')?.addEventListener('click', () => {
        this.subBackdropEl.classList.remove('open');
        this.startLevel(this.session.level.levelNumber);
      });
      this.subCardEl.querySelector('#set-home')?.addEventListener('click', () => {
        this.subBackdropEl.classList.remove('open');
        this.showScreen('home');
      });

      this.subCardEl.querySelector('#set-nick-save')?.addEventListener('click', () => {
        const input = this.subCardEl.querySelector<HTMLInputElement>('#set-nick-input');
        if (!input) return;
        this.saveData = updateNickname(this.saveData, input.value);
        this.platform.saveProgress(this.saveData);
        this.renderHome();
        this.spawnFloatToast(this.subCardEl.getBoundingClientRect(), '昵称已保存', '#FFD147');
        draw();
      });

      this.subCardEl.querySelector('#set-sfx')?.addEventListener('click', () => {
        this.saveData.muted = !this.saveData.muted;
        this.audio.muted = this.saveData.muted;
        this.platform.saveProgress(this.saveData);
        if (!this.saveData.muted) this.audio.play('pick');
        draw();
      });

      this.subCardEl.querySelector('#set-vib')?.addEventListener('click', () => {
        this.saveData.vibrationEnabled = !this.saveData.vibrationEnabled;
        this.platform.saveProgress(this.saveData);
        this.triggerVibrate('light');
        draw();
      });

      this.subCardEl.querySelector('#set-bgm')?.addEventListener('click', () => {
        this.saveData.bgmEnabled = !this.saveData.bgmEnabled;
        this.platform.saveProgress(this.saveData);
        draw();
      });

      this.subCardEl.querySelector('#set-privacy')?.addEventListener('click', () => {
        this.openPrivacyModal(() => this.openSettingsModal(inGame));
      });

      this.subCardEl.querySelector('#set-reset')?.addEventListener('click', () => {
        if (!confirmReset) {
          confirmReset = true;
          draw();
          return;
        }
        this.platform.clearSave();
        this.saveData = syncDailyReset(this.platform.loadSave());
        this.audio.muted = this.saveData.muted;
        this.subBackdropEl.classList.remove('open');
        this.startLevel(1);
        this.showScreen('home');
      });

      this.subCardEl.querySelector('#set-close')?.addEventListener('click', () => {
        this.subBackdropEl.classList.remove('open');
      });
    };

    draw();
    this.subBackdropEl.classList.add('open');
  }

  private openRoomsModal(): void {
    const maxUnlocked = Math.max(this.saveData.highestLevel, this.saveData.currentLevel);
    const roomCards = ROOM_ORDER.map((id) => {
      const r = ROOM_CATALOG[id];
      return `
        <div class="room-chip">
          <img src="${r.bgWebUrl}" alt="${r.name}" />
          <b>${r.name}</b>
        </div>
      `;
    }).join('');

    const teaserCards = ['阳光书房', '泡沫浴室']
      .map(
        (name) => `
        <div class="room-chip locked">
          <div class="room-chip-placeholder">敬请期待</div>
          <b>${name}</b>
        </div>
      `
      )
      .join('');

    const levelTiles = Array.from({ length: maxUnlocked }, (_, idx) => {
      const lv = idx + 1;
      const room = ROOM_CATALOG[ROOM_ORDER[(lv - 1) % ROOM_ORDER.length]];
      const earned = this.saveData.levelStars[lv] ?? 0;
      const stars = [0, 1, 2]
        .map(
          (i) =>
            `<img class="ui-ico" style="width:13px;height:13px;${i < earned ? '' : 'opacity:0.25;filter:grayscale(1);'}" src="${UI_ICON.star}" alt="" />`
        )
        .join('');
      const isCur = lv === this.saveData.currentLevel;
      return `
        <button class="level-tile ${isCur ? 'current' : ''}" data-pick-lv="${lv}" type="button">
          <strong>第 ${lv} 关</strong>
          <span>${room.name}</span>
          <div class="level-tile-stars">${stars}</div>
        </button>
      `;
    }).join('');

    this.subCardEl.innerHTML = `
      <h2><img class="ui-ico md" src="${UI_ICON.rooms}" alt="" /> 主题房间与关卡选择</h2>
      <p class="modal-sub">已解锁至第 ${maxUnlocked} 关 · 点击任意已解锁关卡可立即进入或重玩</p>
      <div class="modal-scroll">
        <div class="rooms-strip">${roomCards}${teaserCards}</div>
        <div class="levels-grid">${levelTiles}</div>
      </div>
      <button class="btn-secondary" id="rooms-close" type="button">关闭</button>
    `;

    this.subBackdropEl.classList.add('open');
    this.subCardEl.querySelectorAll<HTMLElement>('[data-pick-lv]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lv = Number(btn.dataset.pickLv || 1);
        this.enterGameAtLevel(lv);
      });
    });
    this.subCardEl.querySelector('#rooms-close')?.addEventListener('click', () => {
      this.subBackdropEl.classList.remove('open');
    });
  }

  private openHelpModal(): void {
    this.subCardEl.innerHTML = `
      <h2><img class="ui-ico md" src="${UI_ICON.help}" alt="" /> 玩法说明</h2>
      <p class="modal-sub">轻松上手 4 个核心技巧，把杂乱房间变回清爽样板间！</p>
      <div class="modal-scroll">
        <div class="help-card">
          <img class="ui-ico lg" src="${UI_ICON.check}" alt="" />
          <div>
            <h3>1. 目标直飞 vs 暂存槽</h3>
            <p>点中顶部订单需要的物品会直接飞入打包箱（不占槽位）；移开上层杂物会先放入下方暂存槽，后续订单出现时会自动吸出交付。</p>
          </div>
        </div>
        <div class="help-card">
          <img class="ui-ico lg" src="${UI_ICON.magnet}" alt="" />
          <div>
            <h3>2. 快递纸箱 & 四大道具</h3>
            <p>封口纸箱连点 2 次拆开会弹出新物品；遇到深层遮挡可随时使用磁铁、撤销、提示、洗牌破局。</p>
          </div>
        </div>
        <div class="help-card">
          <img class="ui-ico lg" src="${UI_ICON.paw}" alt="" />
          <div>
            <h3>3. 橘猫限次帮忙与猫条获取</h3>
            <p>每局可免费撸橘猫帮忙 1 次（需消耗 1 根猫条）；猫条可通过每日免费领取（每天 2 次）及每通关 2 关自动获得。</p>
          </div>
        </div>
        <div class="help-card">
          <img class="ui-ico lg" src="${UI_ICON.flashlight}" alt="" />
          <div>
            <h3>4. 停电夜灯手电筒</h3>
            <p>第 3 关及后续变体关会停电，按住或滑动屏幕移动暖光手电筒照亮房间，直接点击发光区域里的物品即可拾取。</p>
          </div>
        </div>
      </div>
      <button class="btn-primary" id="help-ok" type="button">我知道了，开始整理!</button>
    `;
    this.subBackdropEl.classList.add('open');
    this.subCardEl.querySelector('#help-ok')?.addEventListener('click', () => {
      this.subBackdropEl.classList.remove('open');
    });
  }

  private openPrivacyModal(onBack?: () => void): void {
    this.subCardEl.innerHTML = `
      <h2><img class="ui-ico md" src="${UI_ICON.shield}" alt="" /> 隐私保护指引</h2>
      <div class="modal-scroll" style="text-align:left;font-size:12.5px;color:var(--ink-soft);line-height:1.6;">
        <p style="margin-bottom:8px;">欢迎游玩《收纳小当家》！我们严格遵守平台小游戏隐私合规规范：</p>
        <p style="margin-bottom:8px;">1. <strong>本地存档数据</strong>：本游戏仅在您的设备本地存储中记录玩家昵称、随机管家编号、关卡进度、星级评价、摸猫机会余额及音效/震动偏好。</p>
        <p style="margin-bottom:8px;">2. <strong>权限说明</strong>：震动反馈仅在您开启设置且点中遮挡反馈时调用设备短震能力，不会采集通讯录、定位、相册或麦克风信息。</p>
        <p style="margin-bottom:8px;">3. <strong>广告说明</strong>：所有激励视频均需由您主动点击确认后触发，随时可在设置页管理偏好或重置本地档案。</p>
      </div>
      <button class="btn-primary" id="priv-ok" type="button">返回</button>
    `;
    this.subBackdropEl.classList.add('open');
    this.subCardEl.querySelector('#priv-ok')?.addEventListener('click', () => {
      if (onBack) onBack();
      else this.subBackdropEl.classList.remove('open');
    });
  }

  private handlePetCatClick(): void {
    this.saveData = syncDailyReset(this.saveData);
    const res = this.session.petCat(this.saveData.petTreats);
    if (res.status === 'petted') {
      this.spawnFloatToast(this.petEl.getBoundingClientRect(), '呼噜~ 再摸一下', '#FF8BA0');
      this.render();
      return;
    }

    if (res.status === 'gifted') {
      this.saveData.petTreats = Math.max(0, this.saveData.petTreats - res.treatsSpent);
      this.platform.saveProgress(this.saveData);
      this.spawnFloatToast(this.petEl.getBoundingClientRect(), '猫条 -1 · 橘猫叼回目标!', '#FFD147');
      this.render();
      return;
    }

    if (res.status === 'need_ad_level_cap' || res.status === 'need_ad_no_treats') {
      this.render();
      this.openCatAdPrompt(res.status === 'need_ad_no_treats' ? 'no_treats' : 'level_cap');
      return;
    }

    if (res.status === 'level_limit_reached') {
      this.spawnFloatToast(this.petEl.getBoundingClientRect(), '本局摸猫次数已达上限', '#FFF7EB');
      this.render();
    }
  }

  private openCatAdPrompt(reason: 'no_treats' | 'level_cap'): void {
    const title = reason === 'no_treats' ? '猫条库存不足' : '本局免费摸猫已用完';
    const desc =
      reason === 'no_treats'
        ? '当前摸猫机会为 0。可通过顶部「每日领取」或每通关 2 关获得，也可以直接看激励视频额外喂猫条！'
        : '每局免费摸猫上限 1 次，看一段激励视频可在本局再让橘猫帮忙叼出 1 件目标物！';

    this.modalCardEl.innerHTML = `
      <h2><img class="ui-ico md" src="${UI_ICON.paw}" alt="" /> ${title}</h2>
      <p class="modal-sub">${desc}</p>
      <button class="btn-primary" id="btn-cat-ad">
        <img class="ui-ico" src="${UI_ICON.ad}" alt="" /> 看广告让橘猫帮忙 (+1次)
      </button>
      <button class="btn-secondary" id="btn-open-daily">
        <img class="ui-ico" src="${UI_ICON.dailyGift}" alt="" /> 打开每日领取与档案
      </button>
      <button class="btn-secondary" id="btn-cat-close">先靠自己找找</button>
    `;
    this.modalBackdropEl.classList.add('open');

    this.modalCardEl.querySelector('#btn-cat-ad')?.addEventListener('click', () => {
      this.modalBackdropEl.classList.remove('open');
      void this.handleAdAction('cat_pet_extra', () => {
        this.session.grantAdCatGift();
      });
    });
    this.modalCardEl.querySelector('#btn-open-daily')?.addEventListener('click', () => {
      this.modalBackdropEl.classList.remove('open');
      this.openProfileDailyModal();
    });
    this.modalCardEl.querySelector('#btn-cat-close')?.addEventListener('click', () => {
      this.modalBackdropEl.classList.remove('open');
    });
  }

  private openProfileDailyModal(): void {
    this.saveData = syncDailyReset(this.saveData);
    this.platform.saveProgress(this.saveData);
    const freeLeft = Math.max(0, DAILY_FREE_LIMIT - this.saveData.dailyFreeClaimed);
    const adLeft = Math.max(0, DAILY_AD_LIMIT - this.saveData.dailyAdClaimed);
    const clearsLeft = getClearsUntilNextPetReward(this.saveData);
    const progressInCycle = CLEARS_PER_PET_REWARD - clearsLeft;

    this.profileCardEl.innerHTML = `
      <h2><img class="ui-ico md" src="${UI_ICON.catTreat}" alt="" /> 管家档案与每日摸猫补给</h2>
      <p class="modal-sub">${this.saveData.nickname} · ID: <strong>${this.saveData.userId}</strong></p>

      <div class="profile-grid">
        <div class="profile-stat">
          <b>${this.saveData.petTreats}</b>
          <span>摸猫机会</span>
        </div>
        <div class="profile-stat">
          <b>${this.saveData.totalLevelsCleared}</b>
          <span>累计通关</span>
        </div>
        <div class="profile-stat">
          <b>${this.saveData.totalStars}</b>
          <span>累计星星</span>
        </div>
      </div>

      <div class="milestone-banner">
        <img class="ui-ico" src="${UI_ICON.paw}" alt="" />
        <span>闯关奖励 (${progressInCycle}/${CLEARS_PER_PET_REWARD})：再通关 <strong>${clearsLeft}</strong> 关送 +1 摸猫机会</span>
      </div>

      <button class="btn-primary" id="btn-claim-free" ${freeLeft <= 0 ? 'disabled' : ''}>
        <img class="ui-ico" src="${UI_ICON.dailyGift}" alt="" />
        ${freeLeft > 0 ? `每日免费领取 +1 (今日剩余 ${freeLeft}/${DAILY_FREE_LIMIT})` : `今日免费次数已领完 (${DAILY_FREE_LIMIT}/${DAILY_FREE_LIMIT})`}
      </button>

      <button class="btn-secondary" id="btn-claim-ad" ${adLeft <= 0 ? 'disabled' : ''}>
        <img class="ui-ico" src="${UI_ICON.ad}" alt="" />
        ${adLeft > 0 ? `看广告额外领 +1 摸猫机会 (今日余 ${adLeft}/${DAILY_AD_LIMIT})` : '今日广告补给已领完'}
      </button>

      <button class="btn-secondary" id="btn-profile-close">返回</button>
    `;

    this.profileBackdropEl.classList.add('open');

    this.profileCardEl.querySelector('#btn-claim-free')?.addEventListener('click', () => {
      const claimed = claimDailyFree(this.saveData);
      if (claimed.ok) {
        this.saveData = claimed.save;
        this.platform.saveProgress(this.saveData);
        this.audio.play('meow_happy');
        this.render();
        this.renderHome();
        this.openProfileDailyModal();
      }
    });

    this.profileCardEl.querySelector('#btn-claim-ad')?.addEventListener('click', () => {
      this.profileBackdropEl.classList.remove('open');
      void this.handleAdAction('daily_cat_bonus', () => {
        const res = claimDailyAdBonus(this.saveData);
        if (res.ok) {
          this.saveData = res.save;
          this.platform.saveProgress(this.saveData);
        }
      });
    });

    this.profileCardEl.querySelector('#btn-profile-close')?.addEventListener('click', () => {
      this.profileBackdropEl.classList.remove('open');
    });
  }

  private setupAdOverlay(): void {
    this.platform.setAdOverlayHandler((placement) => {
      return new Promise<boolean>((resolve) => {
        const desc = AD_LABELS[placement] || '解锁额外奖励';
        this.adModalCardEl.innerHTML = `
          <h2><img class="ui-ico md" src="${UI_ICON.ad}" alt="" /> 模拟激励视频</h2>
          <p class="modal-sub">完成后即可：<strong>${desc}</strong></p>
          <div class="ad-progress-bar"><div class="ad-progress-fill" id="ad-fill"></div></div>
          <p class="modal-sub" id="ad-timer">奖励发放中... 1.5s</p>
          <button class="btn-secondary" id="ad-cancel">暂不领取</button>
        `;
        this.adModalBackdropEl.classList.add('open');

        let settled = false;
        const start = performance.now();
        const duration = 1500;
        const fillEl = this.adModalCardEl.querySelector('#ad-fill') as HTMLElement;
        const timerEl = this.adModalCardEl.querySelector('#ad-timer') as HTMLElement;
        const cancelBtn = this.adModalCardEl.querySelector('#ad-cancel') as HTMLButtonElement;

        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          this.adModalBackdropEl.classList.remove('open');
          resolve(ok);
        };

        cancelBtn.addEventListener('click', () => finish(false));

        const step = (now: number) => {
          if (settled) return;
          const elapsed = now - start;
          const pct = Math.min(100, (elapsed / duration) * 100);
          fillEl.style.width = `${pct}%`;
          const left = Math.max(0, (duration - elapsed) / 1000);
          timerEl.textContent = left > 0 ? `正在播放演示广告... ${left.toFixed(1)}s` : '奖励已到账!';
          if (elapsed >= duration) {
            finish(true);
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    });
  }

  private onBoardPointerMove = (e: PointerEvent): void => {
    const rect = this.boardEl.getBoundingClientRect();
    this.flashNormX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    this.flashNormY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    if (this.session && this.isBlackoutActive(this.session.getSnapshot())) {
      this.drawFlashlight();
    }
  };

  private isBlackoutActive(snap: SessionSnapshot): boolean {
    if (this.blackoutOverride !== null) return this.blackoutOverride;
    return snap.modifiers.includes('blackout_flashlight');
  }

  private startLevel(levelNumber: number): void {
    if (this.unsubscribeSession) this.unsubscribeSession();
    this.blackoutOverride = null;
    this.winModalShown = false;
    this.lastMilestoneGranted = 0;
    this.beforeShotUrl = '';
    this.afterShotUrl = '';
    this.flashBurstUids.clear();
    this.modalBackdropEl.classList.remove('open');

    this.session = GameSession.fromLevelNumber(levelNumber, undefined, {
      initialBoosters: this.saveData.boosters,
    });
    this.unsubscribeSession = this.session.onEvent((ev) => this.onGameEvent(ev));

    this.render();
    void this.captureBeforeAndAfterSnapshots();
  }

  private async captureBeforeAndAfterSnapshots(): Promise<void> {
    const snap = this.session.getSnapshot();
    const room = ROOM_CATALOG[snap.theme];
    const w = 270;
    const h = 390;

    const loadImg = (src: string): Promise<HTMLImageElement | null> =>
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });

    const bgImg = await loadImg(room.bgWebUrl);
    if (!bgImg) return;

    const afterCanvas = document.createElement('canvas');
    afterCanvas.width = w;
    afterCanvas.height = h;
    const actx = afterCanvas.getContext('2d');
    if (actx) {
      actx.drawImage(bgImg, 0, 0, w, h);
      this.afterShotUrl = afterCanvas.toDataURL('image/jpeg', 0.84);
    }

    const beforeCanvas = document.createElement('canvas');
    beforeCanvas.width = w;
    beforeCanvas.height = h;
    const bctx = beforeCanvas.getContext('2d');
    if (!bctx) return;
    bctx.drawImage(bgImg, 0, 0, w, h);

    const uniqueUrls = new Set<string>();
    snap.items.forEach((it) => uniqueUrls.add(ITEM_BY_ID[it.itemId].spriteWebUrl));
    if (snap.boxes.length > 0) uniqueUrls.add('/resources/sprites/cardboard_closed.png');

    const imgMap = new Map<string, HTMLImageElement>();
    await Promise.all(
      [...uniqueUrls].map(async (url) => {
        const im = await loadImg(url);
        if (im) imgMap.set(url, im);
      })
    );

    const sorted = [...snap.items]
      .filter((it) => it.state === 'on_board')
      .sort((a, b) => a.layer * 1000 + a.y - (b.layer * 1000 + b.y));
    for (const it of sorted) {
      const sp = imgMap.get(ITEM_BY_ID[it.itemId].spriteWebUrl);
      if (!sp) continue;
      const size = 50 * it.scale;
      bctx.save();
      bctx.translate(it.x * w, it.y * h);
      bctx.rotate((it.rotation * Math.PI) / 180);
      bctx.drawImage(sp, -size / 2, -size / 2, size, size);
      bctx.restore();
    }
    const boxImg = imgMap.get('/resources/sprites/cardboard_closed.png');
    if (boxImg) {
      for (const box of snap.boxes) {
        const size = 56 * box.scale;
        bctx.drawImage(boxImg, box.x * w - size / 2, box.y * h - size / 2, size, size);
      }
    }
    this.beforeShotUrl = beforeCanvas.toDataURL('image/jpeg', 0.84);
  }

  private onGameEvent(ev: GameEvent): void {
    const snap = this.session.getSnapshot();
    switch (ev.type) {
      case 'item_blocked': {
        this.audio.play('blocked');
        this.triggerVibrate('light');
        const uid = String(ev.payload?.uid ?? '');
        const blockers = (ev.payload?.blockedBy as string[] | undefined) ?? [];
        const el = this.itemsLayerEl.querySelector<HTMLElement>(`[data-uid="${uid}"]`);
        if (el) {
          el.classList.remove('shake');
          void el.offsetWidth;
          el.classList.add('shake');
          this.spawnFloatToast(el.getBoundingClientRect(), '先移开上面的物品!', '#FFE082');
        }
        blockers.forEach((bUid) => this.flashBurstUids.add(bUid));
        setTimeout(() => {
          blockers.forEach((bUid) => this.flashBurstUids.delete(bUid));
          this.renderItems(this.session.getSnapshot());
        }, 420);
        break;
      }

      case 'item_delivered': {
        const comboRate = 1 + Math.min(7, snap.comboCount) * 0.055;
        this.audio.play('deliver', comboRate);
        const itemId = String(ev.payload?.itemId ?? '');
        const slotIndex = Number(ev.payload?.slotIndex ?? 0);
        const fromTray = Boolean(ev.payload?.fromTray);
        const fx = Number(ev.payload?.fromX ?? 0.5);
        const fy = Number(ev.payload?.fromY ?? 0.6);
        const def = ITEM_BY_ID[itemId];
        if (def) {
          const boardRect = this.boardEl.getBoundingClientRect();
          const startRect = fromTray
            ? this.trayRackEl.getBoundingClientRect()
            : new DOMRect(
                boardRect.left + fx * boardRect.width - 32,
                boardRect.top + fy * boardRect.height - 32,
                64,
                64
              );
          const targetCard = this.ordersRowEl.querySelector<HTMLElement>(`[data-slot="${slotIndex}"]`);
          if (targetCard) {
            this.animateFly(def.spriteWebUrl, startRect, targetCard.getBoundingClientRect());
          }
        }
        break;
      }

      case 'item_to_tray': {
        this.audio.play('pick');
        const itemId = String(ev.payload?.itemId ?? '');
        const trayIdx = Number(ev.payload?.trayIndex ?? 0);
        const fx = Number(ev.payload?.fromX ?? 0.5);
        const fy = Number(ev.payload?.fromY ?? 0.6);
        const def = ITEM_BY_ID[itemId];
        if (def) {
          const boardRect = this.boardEl.getBoundingClientRect();
          const startRect = new DOMRect(
            boardRect.left + fx * boardRect.width - 30,
            boardRect.top + fy * boardRect.height - 30,
            60,
            60
          );
          const slotEl = this.trayRackEl.children[trayIdx] as HTMLElement | undefined;
          if (slotEl) {
            this.animateFly(def.spriteWebUrl, startRect, slotEl.getBoundingClientRect());
          }
        }
        break;
      }

      case 'order_completed': {
        this.audio.play('box_seal');
        const slotIdx = Number(ev.payload?.slotIndex ?? 0);
        requestAnimationFrame(() => {
          const card = this.ordersRowEl.querySelector<HTMLElement>(`[data-slot="${slotIdx}"]`);
          if (card) {
            card.classList.add('seal-pop');
            this.spawnFloatToast(card.getBoundingClientRect(), '打包完成! +1箱', '#FFD147');
          }
        });
        break;
      }

      case 'box_hit':
        this.audio.play('cardboard_hit');
        break;

      case 'box_opened': {
        this.audio.play('cardboard_open');
        const boxUid = String(ev.payload?.uid ?? '');
        const boxEl = this.boxesLayerEl.querySelector<HTMLElement>(`[data-box-uid="${boxUid}"]`);
        if (boxEl) {
          this.spawnFloatToast(boxEl.getBoundingClientRect(), '拆开快递箱!', '#FFE082');
        }
        break;
      }

      case 'fever_started':
        this.audio.play('fever');
        this.spawnFloatToast(this.comboEl.getBoundingClientRect(), '整理狂热 FEVER!', '#FFD147');
        break;

      case 'cat_mischief':
        this.audio.play('meow_mischief');
        break;

      case 'cat_gift_delivered':
        this.audio.play('meow_happy');
        break;

      case 'booster_used':
        this.audio.play('booster');
        break;

      case 'tray_full':
        this.audio.play('fail');
        break;

      case 'level_won': {
        this.audio.play('win');
        const victory = recordLevelVictory(
          this.saveData,
          snap.levelNumber,
          snap.starsEarned,
          this.session.getBoosters()
        );
        this.saveData = victory.save;
        this.lastMilestoneGranted = victory.milestonePetTreatsGranted;
        this.platform.saveProgress(this.saveData);
        break;
      }

      default:
        break;
    }
  }

  private animateFly(imgUrl: string, fromRect: DOMRect, toRect: DOMRect): void {
    const clone = document.createElement('div');
    clone.className = 'fly-clone';
    const size = 56;
    const startX = fromRect.left + fromRect.width / 2 - size / 2;
    const startY = fromRect.top + fromRect.height / 2 - size / 2;
    const endX = toRect.left + toRect.width / 2 - size / 2;
    const endY = toRect.top + toRect.height / 2 - size / 2;

    clone.style.left = `${startX}px`;
    clone.style.top = `${startY}px`;
    clone.style.width = `${size}px`;
    clone.style.height = `${size}px`;
    clone.innerHTML = `<img src="${imgUrl}" alt="" />`;
    document.body.appendChild(clone);

    const dx = endX - startX;
    const dy = endY - startY;
    const midY = Math.min(0, dy * 0.5) - 42;

    const anim = clone.animate(
      [
        { transform: 'translate(0px, 0px) scale(1.08)' },
        { transform: `translate(${dx * 0.5}px, ${midY}px) scale(1.18)`, offset: 0.48 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.56)` },
      ],
      { duration: 310, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    );
    anim.onfinish = () => clone.remove();
  }

  private spawnFloatToast(rect: DOMRect, text: string, color = '#FFFFFF'): void {
    const el = document.createElement('div');
    el.className = 'float-toast';
    el.textContent = text;
    el.style.left = `${rect.left + rect.width / 2}px`;
    el.style.top = `${Math.max(56, rect.top)}px`;
    el.style.color = color;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  private render(): void {
    const snap = this.session.getSnapshot();
    const room = ROOM_CATALOG[snap.theme];
    const tint = room.paletteTint[snap.timeOfDay];

    this.roomBgEl.src = room.bgWebUrl;
    this.tintEl.style.backgroundColor = tint.overlayColor;
    this.tintEl.style.opacity = String(tint.overlayOpacity);
    this.feverAuraEl.classList.toggle('active', snap.feverActive);

    this.levelNumEl.textContent = `Lv.${snap.levelNumber}`;
    this.levelNameEl.textContent = `${room.name} · ${tint.label}`;
    this.treatCountEl.textContent = String(this.saveData.petTreats);
    this.dailyDotEl.style.display = canClaimDailyFree(this.saveData) ? 'block' : 'none';
    this.starBadgeEl.textContent = String(this.saveData.totalStars);
    const pct = snap.progressTotal > 0 ? Math.round((snap.progressDone / snap.progressTotal) * 100) : 0;
    this.progressFillEl.style.width = `${pct}%`;
    this.progressTextEl.textContent = `${snap.distinctItemTypes}类 · ${snap.progressDone}/${snap.progressTotal}`;
    this.hostTextEl.textContent = snap.tutorialHint ?? snap.hostOpening;

    this.renderOrders(snap);
    this.renderItems(snap);
    this.renderBoxes(snap);
    this.renderPet(snap);
    this.renderTray(snap);
    this.renderBoosters(snap);
    this.renderComboBanner(snap);
    this.drawFlashlight();
    this.renderModals(snap);
    this.renderHome();
  }

  private renderOrders(snap: SessionSnapshot): void {
    this.ordersRowEl.innerHTML = snap.orderSlots
      .map((slot) => {
        if (!slot.unlocked && slot.isAdSlot) {
          return `
            <div class="order-card ad-locked" data-ad-order="1" data-slot="${slot.slotIndex}">
              <div style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:900">
                <img class="ui-ico" src="${UI_ICON.ad}" alt="广告" /> 广告箱
              </div>
              <div style="font-size:10px;opacity:0.86">点击解锁第3箱</div>
            </div>
          `;
        }
        if (!slot.order) {
          return `
            <div class="order-card" data-slot="${slot.slotIndex}" style="justify-content:center;background:#EDF6EC;">
              <div style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:900;color:#4E8A5A;">
                <img class="ui-ico" src="${UI_ICON.check}" alt="完成" /> 已清完
              </div>
            </div>
          `;
        }
        const def = ITEM_BY_ID[slot.order.itemId];
        const pips = Array.from({ length: slot.order.requiredCount }, (_, i) =>
          `<span class="pip ${i < slot.collectedCount ? 'filled' : ''}"></span>`
        ).join('');
        return `
          <div class="order-card" data-slot="${slot.slotIndex}">
            <div class="order-head">
              <img src="${def.spriteWebUrl}" alt="${def.name}" />
              <span class="order-name">${def.name}</span>
            </div>
            <div class="order-pips">${pips}</div>
            <div class="order-count">${slot.collectedCount}/${slot.order.requiredCount}</div>
          </div>
        `;
      })
      .join('');

    const adBox = this.ordersRowEl.querySelector<HTMLElement>('[data-ad-order="1"]');
    if (adBox) {
      adBox.addEventListener('click', () => {
        void this.handleAdAction('unlock_order_box', () => this.session.unlockAdOrderSlot());
      });
    }
  }

  private renderItems(snap: SessionSnapshot): void {
    const onBoard = snap.items
      .filter((it) => it.state === 'on_board')
      .sort((a, b) => a.layer * 1000 + a.y - (b.layer * 1000 + b.y));

    const activeIds = new Set(
      snap.orderSlots.filter((s) => s.unlocked && s.order).map((s) => s.order!.itemId)
    );

    this.itemsLayerEl.innerHTML = '';
    for (const item of onBoard) {
      const def = ITEM_BY_ID[item.itemId];
      const isBlocked = item.blockedBy.length > 0;
      const isHinted =
        snap.highlightedItemUid === item.uid ||
        (snap.levelNumber === 1 && !isBlocked && activeIds.has(item.itemId) && snap.progressDone === 0);
      const isBlockerFlash = this.flashBurstUids.has(item.uid) || snap.highlightedBlockerUids.includes(item.uid);

      const el = document.createElement('div');
      el.className = `board-item ${isBlocked ? 'blocked' : 'unblocked'} ${isHinted ? 'hint-target' : ''} ${
        isBlockerFlash ? 'blocker-flash' : ''
      }`;
      el.dataset.uid = item.uid;
      const sizePx = Math.round(82 * item.scale);
      el.style.width = `${sizePx}px`;
      el.style.height = `${sizePx}px`;
      el.style.left = `${item.x * 100}%`;
      el.style.top = `${item.y * 100}%`;
      el.style.transform = `translate(-50%, -50%) rotate(${item.rotation}deg)`;
      el.style.zIndex = String(10 + item.layer * 10);
      el.innerHTML = `<img src="${def.spriteWebUrl}" alt="${def.name}" />`;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.session.tapItem(item.uid);
        this.render();
      });

      this.itemsLayerEl.appendChild(el);
    }
  }

  private renderBoxes(snap: SessionSnapshot): void {
    this.boxesLayerEl.innerHTML = '';
    for (const box of snap.boxes) {
      if (box.opened) continue;
      const el = document.createElement('div');
      el.className = 'cardboard-box';
      el.dataset.boxUid = box.uid;
      const sizePx = Math.round(96 * box.scale);
      el.style.width = `${sizePx}px`;
      el.style.height = `${sizePx}px`;
      el.style.left = `${box.x * 100}%`;
      el.style.top = `${box.y * 100}%`;
      const imgUrl =
        box.hitsLeft < box.maxHits
          ? '/resources/sprites/cardboard_cracked.png'
          : '/resources/sprites/cardboard_closed.png';
      const label = box.maxHits >= 3 ? `加固箱·点${box.hitsLeft}次` : `点${box.hitsLeft}次拆箱`;
      el.innerHTML = `
        <img src="${imgUrl}" alt="快递箱" />
        <div class="cardboard-badge ${box.maxHits >= 3 ? 'heavy' : ''}">${label}</div>
      `;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.session.tapBox(box.uid);
        this.render();
      });
      this.boxesLayerEl.appendChild(el);
    }
  }

  private renderPet(snap: SessionSnapshot): void {
    const pet = snap.pet;
    this.petEl.style.display = pet.enabled ? 'block' : 'none';
    if (!pet.enabled) return;

    this.petEl.style.left = `${pet.x * 100}%`;
    this.petEl.style.top = `${pet.y * 100}%`;
    this.petEl.classList.toggle('mischief', pet.mood === 'mischief');

    this.petImgEl.src =
      pet.mood === 'mischief'
        ? '/resources/sprites/cat_mischief.png'
        : pet.mood === 'pleased'
          ? '/resources/sprites/cat_happy.png'
          : '/resources/sprites/cat_idle.png';

    if (pet.bubbleText) {
      this.petBubbleEl.style.display = 'block';
      this.petBubbleEl.textContent = pet.bubbleText;
      if (pet.x > 0.62) {
        this.petBubbleEl.style.left = 'auto';
        this.petBubbleEl.style.right = '-6px';
        this.petBubbleEl.style.transform = 'none';
      } else {
        this.petBubbleEl.style.left = '50%';
        this.petBubbleEl.style.right = 'auto';
        this.petBubbleEl.style.transform = 'translateX(-50%)';
      }
    } else {
      this.petBubbleEl.style.display = 'none';
    }

    const freeLeft = pet.maxFreeGiftsPerLevel - pet.freeGiftsUsedInLevel;
    const adLeft = pet.maxAdGiftsPerLevel - pet.adGiftsUsedInLevel;
    this.petBadgeEl.style.display = 'flex';
    this.petBadgeEl.classList.remove('ad-mode', 'done-mode');

    if (freeLeft > 0) {
      if (this.saveData.petTreats > 0) {
        this.petBadgeEl.innerHTML = `<img class="ui-ico" style="width:13px;height:13px" src="${UI_ICON.paw}" alt="" /> 摸猫(${pet.petsReceived}/${pet.petsNeeded})`;
      } else {
        this.petBadgeEl.classList.add('ad-mode');
        this.petBadgeEl.innerHTML = `<img class="ui-ico" style="width:13px;height:13px" src="${UI_ICON.ad}" alt="" /> 缺猫条`;
      }
    } else if (adLeft > 0) {
      this.petBadgeEl.classList.add('ad-mode');
      this.petBadgeEl.innerHTML = `<img class="ui-ico" style="width:13px;height:13px" src="${UI_ICON.ad}" alt="" /> 广告续摸`;
    } else {
      this.petBadgeEl.classList.add('done-mode');
      this.petBadgeEl.textContent = '本局已满';
    }
  }

  private renderTray(snap: SessionSnapshot): void {
    const cells: string[] = [];
    for (let i = 0; i < snap.trayMaxSlots; i++) {
      const unlocked = i < snap.trayUnlockedSlots;
      const item = snap.tray[i];
      if (!unlocked) {
        cells.push(
          `<div class="tray-slot ad-slot" data-ad-tray="1"><img class="ui-ico" src="${UI_ICON.ad}" alt="广告" /><span>+1格</span></div>`
        );
      } else if (item) {
        const def = ITEM_BY_ID[item.itemId];
        cells.push(
          `<div class="tray-slot occupied"><img class="tray-item-img" src="${def.spriteWebUrl}" alt="${def.name}" /></div>`
        );
      } else {
        cells.push(`<div class="tray-slot"></div>`);
      }
    }
    this.trayRackEl.innerHTML = cells.join('');
    this.trayRackEl.querySelectorAll<HTMLElement>('[data-ad-tray="1"]').forEach((el) => {
      el.addEventListener('click', () => {
        void this.handleAdAction('unlock_tray_slot', () => this.session.unlockAdTraySlot());
      });
    });
  }

  private renderBoosters(snap: SessionSnapshot): void {
    const defs: Array<{ type: BoosterType; iconUrl: string; name: string }> = [
      { type: 'magnet', iconUrl: UI_ICON.magnet, name: '磁铁' },
      { type: 'undo', iconUrl: UI_ICON.undo, name: '撤销' },
      { type: 'hint', iconUrl: UI_ICON.hint, name: '提示' },
      { type: 'shuffle', iconUrl: UI_ICON.shuffle, name: '洗牌' },
    ];
    this.boostersRowEl.innerHTML = defs
      .map((d) => {
        const count = snap.boosters[d.type];
        const badge =
          count > 0
            ? `<span class="booster-badge">${count}</span>`
            : `<span class="booster-badge ad"><img class="ui-ico" style="width:14px;height:14px" src="${UI_ICON.ad}" alt="广告" /></span>`;
        return `
          <button class="booster-btn" data-booster="${d.type}" type="button">
            ${badge}
            <div class="booster-icon-wrap">
              <img class="ui-ico lg" src="${d.iconUrl}" alt="${d.name}" />
            </div>
            <span>${d.name}</span>
          </button>
        `;
      })
      .join('');

    this.boostersRowEl.querySelectorAll<HTMLElement>('[data-booster]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.booster as BoosterType;
        void this.handleBoosterClick(type);
      });
    });
  }

  private renderComboBanner(snap: SessionSnapshot): void {
    if (snap.feverActive) {
      this.comboEl.classList.add('visible');
      this.comboEl.innerHTML = `<img class="ui-ico" src="${UI_ICON.flame}" alt="" /> 整理狂热 FEVER · ${snap.feverRemainingSec.toFixed(1)}s`;
    } else if (snap.comboCount >= 2) {
      this.comboEl.classList.add('visible');
      const left = 5 - snap.comboCount;
      this.comboEl.innerHTML = `<img class="ui-ico" src="${UI_ICON.flame}" alt="" /> ${snap.comboCount} 连击! (${left > 0 ? `再${left}次触发狂热` : '满格!'})`;
    } else {
      this.comboEl.classList.remove('visible');
    }
  }

  private drawFlashlight(): void {
    const snap = this.session.getSnapshot();
    const active = this.isBlackoutActive(snap) && snap.status === 'playing';
    this.flashCanvas.style.display = active ? 'block' : 'none';
    if (!active) return;

    const w = this.boardEl.clientWidth || 390;
    const h = this.boardEl.clientHeight || 693;
    if (this.flashCanvas.width !== w || this.flashCanvas.height !== h) {
      this.flashCanvas.width = w;
      this.flashCanvas.height = h;
    }
    const ctx = this.flashCanvas.getContext('2d');
    if (!ctx) return;

    const cx = this.flashNormX * w;
    const cy = this.flashNormY * h;
    const radius = Math.min(w, h) * 0.31;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(14, 13, 28, 0.90)';
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'destination-out';
    const hole = ctx.createRadialGradient(cx, cy, radius * 0.28, cx, cy, radius);
    hole.addColorStop(0, 'rgba(0,0,0,1)');
    hole.addColorStop(0.7, 'rgba(0,0,0,0.88)');
    hole.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
    const warmRing = ctx.createRadialGradient(cx, cy, radius * 0.35, cx, cy, radius);
    warmRing.addColorStop(0, 'rgba(255, 224, 130, 0.14)');
    warmRing.addColorStop(1, 'rgba(255, 190, 90, 0)');
    ctx.fillStyle = warmRing;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderModals(snap: SessionSnapshot): void {
    if (snap.status === 'playing') {
      return;
    }

    if (snap.status === 'failed_tray_full') {
      this.modalCardEl.innerHTML = `
        <h2>暂存槽满啦!</h2>
        <p class="modal-sub">槽位已满 ${snap.tray.length}/${snap.trayUnlockedSlots} 格。看一段激励视频移出最后 3 件杂物，立刻继续整理！</p>
        <button class="btn-primary" id="btn-revive">
          <img class="ui-ico" src="${UI_ICON.ad}" alt="" /> 看广告复活（移出 3 件）
        </button>
        <button class="btn-secondary" id="btn-restart">重新开始第 ${snap.levelNumber} 关</button>
        <button class="btn-secondary" id="btn-fail-home">返回首页</button>
      `;
      this.modalBackdropEl.classList.add('open');
      this.modalCardEl.querySelector('#btn-revive')?.addEventListener('click', () => {
        void this.handleAdAction('revive_clear_tray', () => this.session.reviveClearTray(3));
      });
      this.modalCardEl.querySelector('#btn-restart')?.addEventListener('click', () => {
        this.startLevel(snap.levelNumber);
      });
      this.modalCardEl.querySelector('#btn-fail-home')?.addEventListener('click', () => {
        this.modalBackdropEl.classList.remove('open');
        this.showScreen('home');
      });
      return;
    }

    if (snap.status === 'won' && !this.winModalShown) {
      this.winModalShown = true;
      setTimeout(() => {
        const latest = this.session.getSnapshot();
        if (latest.status !== 'won') return;
        const starsHtml = [0, 1, 2]
          .map(
            (i) =>
              `<img class="star-ico ${i < latest.starsEarned ? '' : 'dim'}" src="${UI_ICON.star}" alt="star" />`
          )
          .join('');
        const clearsLeft = getClearsUntilNextPetReward(this.saveData);
        const milestoneHtml =
          this.lastMilestoneGranted > 0
            ? `<div class="milestone-banner"><img class="ui-ico" src="${UI_ICON.catTreat}" alt="" /> 闯关里程碑达成！摸猫机会 +${this.lastMilestoneGranted}（余额 ${this.saveData.petTreats}）</div>`
            : `<div class="milestone-banner"><img class="ui-ico" src="${UI_ICON.paw}" alt="" /> 已累计通关 ${this.saveData.totalLevelsCleared} 关 · 再过 ${clearsLeft} 关送 +1 摸猫机会</div>`;

        const compareHtml =
          this.beforeShotUrl && this.afterShotUrl
            ? `
            <div class="compare-grid">
              <div class="compare-box">
                <img src="${this.beforeShotUrl}" alt="整理前" />
                <div class="compare-label">整理前 · 杂乱满屋</div>
              </div>
              <div class="compare-box">
                <img src="${this.afterShotUrl}" alt="整理后" />
                <div class="compare-label">整理后 · 焕然一新</div>
              </div>
            </div>
          `
            : '';

        this.modalCardEl.innerHTML = `
          <div class="stars-row">${starsHtml}</div>
          <h2>第 ${latest.levelNumber} 关 收纳大成功!</h2>
          <p class="modal-sub">${latest.hostVictory}（用时 ${Math.round(latest.elapsedSec)} 秒）</p>
          ${milestoneHtml}
          ${compareHtml}
          <button class="btn-primary" id="btn-next">进入第 ${latest.levelNumber + 1} 关</button>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
            <button class="btn-secondary" style="margin-top:0;" id="btn-replay">再玩一次</button>
            <button class="btn-secondary" style="margin-top:0;" id="btn-win-home">返回首页</button>
          </div>
        `;
        this.modalBackdropEl.classList.add('open');
        this.modalCardEl.querySelector('#btn-next')?.addEventListener('click', () => {
          this.startLevel(latest.levelNumber + 1);
        });
        this.modalCardEl.querySelector('#btn-replay')?.addEventListener('click', () => {
          this.startLevel(latest.levelNumber);
        });
        this.modalCardEl.querySelector('#btn-win-home')?.addEventListener('click', () => {
          this.modalBackdropEl.classList.remove('open');
          this.showScreen('home');
        });
      }, 650);
    }
  }

  private async handleBoosterClick(type: BoosterType): Promise<void> {
    const stock = this.session.getBoosters()[type];
    if (stock > 0) {
      const res = this.session.useBooster(type);
      if (!res.ok) {
        this.spawnFloatToast(this.boostersRowEl.getBoundingClientRect(), '当前无需使用该道具', '#FFF7EB');
      } else {
        this.saveData.boosters = this.session.getBoosters();
        this.platform.saveProgress(this.saveData);
      }
      this.render();
      return;
    }

    const placement = (`booster_${type}`) as AdPlacement;
    await this.handleAdAction(placement, () => {
      this.session.addBoosterStock(type, 1);
      this.session.useBooster(type);
      this.saveData.boosters = this.session.getBoosters();
      this.platform.saveProgress(this.saveData);
    });
  }

  private async handleAdAction(placement: AdPlacement, onRewarded: () => void): Promise<void> {
    const res = await this.platform.showRewardedAd(placement);
    if (res.rewarded) {
      onRewarded();
      this.render();
    }
  }

  private loop = (now: number): void => {
    const dt = Math.min(0.1, (now - this.lastTickMs) / 1000);
    this.lastTickMs = now;
    if (this.session && !this.isSimulationPaused()) {
      const beforePetMood = this.session.getSnapshot().pet.mood;
      const beforeFever = this.session.getSnapshot().feverActive;
      const beforeCombo = this.session.getSnapshot().comboCount;
      this.session.tick(dt);
      const after = this.session.getSnapshot();
      if (
        after.pet.mood !== beforePetMood ||
        after.feverActive !== beforeFever ||
        after.comboCount !== beforeCombo
      ) {
        this.render();
      } else if (after.feverActive) {
        this.renderComboBanner(after);
      }
    }
    requestAnimationFrame(this.loop);
  };
}

const mountEl = document.getElementById('app');
if (mountEl) {
  new TidyHomeWebApp(mountEl);
}

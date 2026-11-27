import { ROOM_CATALOG, ROOM_ORDER } from '@core/catalogs';
import type { SaveData } from '@core/types';
import { syncDailyReset, syncLives, updateNickname } from '@core/userProfile';
import type { MockPlatformAdapter } from '@platform/MockPlatformAdapter';
import { WEB_UI_ICONS } from '@shared/constants';
import type { WebAudioPlayer } from '../audioPlayer';
import type { ShellElements } from '../shellTemplate';
import { spawnFloatToast } from '../webEffects';

export interface InfoModalDeps {
  el: ShellElements;
  platform: MockPlatformAdapter;
  audio: WebAudioPlayer;
  getSaveData: () => SaveData;
  setSaveData: (next: SaveData) => void;
  getCurrentLevelNumber: () => number;
  onTryEnterLevel: (levelNumber: number, opts?: { resetStreakOnRestart?: boolean }) => void;
  onShowHomeWithTransition: () => void;
  onResetToHome: () => void;
  onRenderHome: () => void;
  onVibrate: (style?: 'light' | 'medium' | 'heavy') => void;
}

export function openSettingsModal(deps: InfoModalDeps, inGame: boolean): void {
  const { el } = deps;
  let confirmReset = false;

  const draw = () => {
    const save = deps.getSaveData();
    const pauseButtons = inGame
      ? `
        <div style="margin-bottom:10px;">
          <button class="btn-primary" id="set-resume">继续整理</button>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
            <button class="btn-secondary" style="margin-top:0;" id="set-replay">
              <img class="ui-ico" src="${WEB_UI_ICONS.replay}" alt="" /> 重开 (-1体力)
            </button>
            <button class="btn-secondary" style="margin-top:0;" id="set-home">
              <img class="ui-ico" src="${WEB_UI_ICONS.home}" alt="" /> 返回大厅
            </button>
          </div>
        </div>
      `
      : '';

    el.subCardEl.innerHTML = `
      <div class="modal-header-bar">
        <h2><img class="ui-ico md" src="${WEB_UI_ICONS.settings}" alt="" /> ${inGame ? '暂停与设置' : '系统设置'}</h2>
        <button class="modal-close-x" id="set-close" type="button" aria-label="关闭">×</button>
      </div>
      <p class="modal-sub">管家编号 <strong>${save.userId}</strong></p>
      <div class="modal-scroll">
        ${pauseButtons}

        <div class="settings-section-label">管家档案</div>
        <div class="settings-group">
          <div class="nick-row">
            <input class="nick-input" id="set-nick-input" maxlength="12" value="${save.nickname}" placeholder="输入管家昵称" />
            <button class="nick-save-btn" id="set-nick-save" type="button">保存</button>
          </div>
        </div>

        <div class="settings-section-label">游戏偏好</div>
        <div class="settings-group">
          <div class="setting-row">
            <span class="setting-label"><img class="ui-ico md" src="${save.muted ? WEB_UI_ICONS.soundOff : WEB_UI_ICONS.soundOn}" alt="" /> 游戏音效</span>
            <button class="switch-pill ${save.muted ? 'off' : ''}" id="set-sfx" type="button" aria-pressed="${!save.muted}" aria-label="游戏音效"></button>
          </div>
          <div class="setting-row">
            <span class="setting-label"><img class="ui-ico md" src="${WEB_UI_ICONS.vibrate}" alt="" /> 触感震动反馈</span>
            <button class="switch-pill ${save.vibrationEnabled ? '' : 'off'}" id="set-vib" type="button" aria-pressed="${save.vibrationEnabled}" aria-label="触感震动反馈"></button>
          </div>
        </div>

        <div class="settings-footer">
          <button class="btn-secondary" style="margin-top:0;" id="set-privacy" type="button">
            <img class="ui-ico" src="${WEB_UI_ICONS.shield}" alt="" /> 隐私保护指引
          </button>
          <button class="btn-danger-link ${confirmReset ? 'confirming' : ''}" id="set-reset" type="button">
            ${confirmReset ? '再次点击确认清空全部进度与星星' : '重置全部游戏进度'}
          </button>
        </div>
      </div>
    `;

    el.subCardEl.querySelector('#set-resume')?.addEventListener('click', () => {
      el.subBackdropEl.classList.remove('open');
    });
    el.subCardEl.querySelector('#set-replay')?.addEventListener('click', () => {
      el.subBackdropEl.classList.remove('open');
      deps.onTryEnterLevel(deps.getCurrentLevelNumber(), { resetStreakOnRestart: true });
    });
    el.subCardEl.querySelector('#set-home')?.addEventListener('click', () => {
      el.subBackdropEl.classList.remove('open');
      deps.onShowHomeWithTransition();
    });

    el.subCardEl.querySelector('#set-nick-save')?.addEventListener('click', () => {
      const input = el.subCardEl.querySelector<HTMLInputElement>('#set-nick-input');
      if (!input) return;
      const next = updateNickname(deps.getSaveData(), input.value);
      deps.setSaveData(next);
      deps.platform.saveProgress(next);
      deps.onRenderHome();
      spawnFloatToast(el.subCardEl.getBoundingClientRect(), '昵称已保存', '#FFD147');
      draw();
    });

    el.subCardEl.querySelector('#set-sfx')?.addEventListener('click', () => {
      const next = { ...deps.getSaveData(), muted: !deps.getSaveData().muted };
      deps.setSaveData(next);
      deps.audio.muted = next.muted;
      deps.platform.saveProgress(next);
      if (!next.muted) deps.audio.play('pick');
      draw();
    });

    el.subCardEl.querySelector('#set-vib')?.addEventListener('click', () => {
      const next = {
        ...deps.getSaveData(),
        vibrationEnabled: !deps.getSaveData().vibrationEnabled,
      };
      deps.setSaveData(next);
      deps.platform.saveProgress(next);
      deps.onVibrate('light');
      draw();
    });

    el.subCardEl.querySelector('#set-privacy')?.addEventListener('click', () => {
      openPrivacyModal(el, () => openSettingsModal(deps, inGame));
    });

    el.subCardEl.querySelector('#set-reset')?.addEventListener('click', () => {
      if (!confirmReset) {
        confirmReset = true;
        draw();
        return;
      }
      deps.platform.clearSave();
      const fresh = syncLives(syncDailyReset(deps.platform.loadSave()), Date.now()).save;
      deps.setSaveData(fresh);
      deps.audio.muted = fresh.muted;
      el.subBackdropEl.classList.remove('open');
      deps.onResetToHome();
    });

    el.subCardEl.querySelector('#set-close')?.addEventListener('click', () => {
      el.subBackdropEl.classList.remove('open');
    });
  };

  draw();
  el.subBackdropEl.classList.add('open');
}

export function openRoomsModal(
  el: ShellElements,
  save: SaveData,
  onTryEnterLevel: (levelNumber: number) => void
): void {
  const maxUnlocked = Math.max(save.highestLevel, save.currentLevel);
  const roomCards = ROOM_ORDER.map((id) => {
    const r = ROOM_CATALOG[id];
    const unlocked = maxUnlocked >= r.unlockLevel;
    return `
      <div class="room-chip ${unlocked ? '' : 'locked'}" style="border-color:${r.accentDeep}">
        <img src="${r.bgWebUrl}" alt="${r.name}" />
        <b>${r.name}</b>
        <div class="room-chip-tag">${unlocked ? r.tagline.split('·')[0] : `第${r.unlockLevel}关解锁`}</div>
      </div>
    `;
  }).join('');

  const levelTiles = Array.from({ length: maxUnlocked }, (_, idx) => {
    const lv = idx + 1;
    const room = ROOM_CATALOG[ROOM_ORDER[(lv - 1) % ROOM_ORDER.length]];
    const earned = save.levelStars[lv] ?? 0;
    const stars = [0, 1, 2]
      .map(
        (i) =>
          `<img class="ui-ico" style="width:13px;height:13px;${i < earned ? '' : 'opacity:0.25;filter:grayscale(1);'}" src="${WEB_UI_ICONS.star}" alt="" />`
      )
      .join('');
    const isCur = lv === save.currentLevel;
    return `
      <button class="level-tile ${isCur ? 'current' : ''}" style="border-color:${room.accentDeep};background:${isCur ? room.badgeBg : '#FFFDF9'}" data-pick-lv="${lv}" type="button">
        <strong>第 ${lv} 关</strong>
        <span>${room.name}</span>
        <div class="level-tile-stars">${stars}</div>
      </button>
    `;
  }).join('');

  el.subCardEl.innerHTML = `
    <h2><img class="ui-ico md" src="${WEB_UI_ICONS.rooms}" alt="" /> 6 大色彩主题与关卡选择</h2>
    <p class="modal-sub">每关不同主题房间与专属物品！进入关卡消耗 1 体力，通关返还 +1 体力</p>
    <div class="modal-scroll">
      <div class="rooms-strip">${roomCards}</div>
      <div class="levels-grid">${levelTiles}</div>
    </div>
    <button class="btn-secondary" id="rooms-close" type="button">关闭</button>
  `;

  el.subBackdropEl.classList.add('open');
  el.subCardEl.querySelectorAll<HTMLElement>('[data-pick-lv]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lv = Number(btn.dataset.pickLv || 1);
      onTryEnterLevel(lv);
    });
  });
  el.subCardEl.querySelector('#rooms-close')?.addEventListener('click', () => {
    el.subBackdropEl.classList.remove('open');
  });
}

export function openHelpModal(el: ShellElements): void {
  el.subCardEl.innerHTML = `
    <h2><img class="ui-ico md" src="${WEB_UI_ICONS.help}" alt="" /> 玩法说明</h2>
    <p class="modal-sub">轻松掌握 5 大亮点，玩转 6 大色彩主题房间！</p>
    <div class="modal-scroll">
      <div class="help-card">
        <img class="ui-ico lg" src="${WEB_UI_ICONS.heart}" alt="" />
        <div>
          <h3>1. 5次体力条 · 通关回血</h3>
          <p>默认拥有 5 次挑战机会，每 10 分钟自动恢复 1 次。开局与局内重开消耗 1 次，顺利通关返还赠送 1 次!</p>
        </div>
      </div>
      <div class="help-card">
        <img class="ui-ico lg" src="${WEB_UI_ICONS.coin}" alt="" />
        <div>
          <h3>2. 赚金币买猫条 · 撸猫寻物</h3>
          <p>打包订单、拾取闪光金色物品与通关都能赚金币；去「猫条小铺」买猫条后，关卡里摸橘猫 2 下它会替你精准找出隐藏或遮挡的目标物品!</p>
        </div>
      </div>
      <div class="help-card">
        <img class="ui-ico lg" src="${WEB_UI_ICONS.zoomIn}" alt="" />
        <div>
          <h3>3. 关卡放大镜（限 1.0× ~ 2.2×）</h3>
          <p>双指捏合、鼠标滚轮或点击右侧「+ / −」按钮可安全放大桌面细节、单指拖动查看，再点中间倍率即可快速复位。</p>
        </div>
      </div>
      <div class="help-card">
        <img class="ui-ico lg" src="${WEB_UI_ICONS.share}" alt="" />
        <div>
          <h3>4. 每日补给</h3>
          <p>在猫条小铺每天可以领取免费猫条和金币。</p>
        </div>
      </div>
      <div class="help-card">
        <img class="ui-ico lg" src="${WEB_UI_ICONS.rooms}" alt="" />
        <div>
          <h3>5. 6大主题房间 · 惊喜关卡</h3>
          <p>暖阳客厅、泡沫浴室、森林画室、樱花甜品屋(双倍金币)、温馨厨房、梦幻卧室轮番登场，每 5 关更有里程碑大奖!</p>
        </div>
      </div>
    </div>
    <button class="btn-primary" id="help-ok" type="button">我知道了，开始整理!</button>
  `;
  el.subBackdropEl.classList.add('open');
  el.subCardEl.querySelector('#help-ok')?.addEventListener('click', () => {
    el.subBackdropEl.classList.remove('open');
  });
}

export function openPrivacyModal(el: ShellElements, onBack?: () => void): void {
  el.subCardEl.innerHTML = `
    <h2><img class="ui-ico md" src="${WEB_UI_ICONS.shield}" alt="" /> 隐私保护指引</h2>
    <div class="modal-scroll" style="text-align:left;font-size:12.5px;color:var(--ink-soft);line-height:1.6;">
      <p style="margin-bottom:8px;">欢迎游玩《我来收纳》！我们严格遵守平台小游戏隐私合规规范：</p>
      <p style="margin-bottom:8px;">1. <strong>本地存档数据</strong>：仅在本地存储记录玩家昵称、随机管家编号、体力恢复时间戳、金币、猫条、关卡进度与偏好设置。</p>
      <p style="margin-bottom:8px;">2. <strong>权限说明</strong>：震动反馈仅在开启时触发。分享面板由玩家主动点击打开。</p>
    </div>
    <button class="btn-primary" id="priv-ok" type="button">返回</button>
  `;
  el.subBackdropEl.classList.add('open');
  el.subCardEl.querySelector('#priv-ok')?.addEventListener('click', () => {
    if (onBack) onBack();
    else el.subBackdropEl.classList.remove('open');
  });
}

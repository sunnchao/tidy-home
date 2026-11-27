import {
  buildHomeCatLines,
  drawAnimatedCat,
  HOME_DIALOGUE_INTERVAL_SEC,
  PET_REACTION_DURATION_SEC,
  pickTapReactionLine,
  sliceTypedText,
} from '@core/catAnimation';
import { ROOM_CATALOG, ROOM_ORDER } from '@core/catalogs';
import type { RoomThemeId, SaveData } from '@core/types';
import {
  canClaimDailyFree,
  formatCountdownMmSs,
  getButlerRank,
  getNextUnlockTeaser,
  MAX_LIVES,
  syncLives,
} from '@core/userProfile';
import { getHomePlayCtaLabel, getRoomForLevel } from '@shared/hudViewModel';
import type { ShellElements } from './shellTemplate';

export interface WebHomeViewDeps {
  el: ShellElements;
  getSaveData: () => SaveData;
  setSaveData: (next: SaveData) => void;
  getScreen: () => 'home' | 'game';
  getAnimTimeSec: () => number;
  onUnlockAudio: () => void;
  onPlayMeowHappy: () => void;
  onVibrate: (style?: 'light' | 'medium' | 'heavy') => void;
  onPlayClick: () => void;
  onOpenLivesOrShop: () => void;
  onOpenSettings: () => void;
  onOpenShop: () => void;
  onTriggerShare: () => void;
  onOpenHelp: () => void;
  onApplyRoomThemeColors: (theme: RoomThemeId) => void;
}

export class WebHomeView {
  private homeDialogueIdx = 0;
  private homeDialogueElapsedSec = 0;
  private homeCustomLine: string | null = null;
  private homeLastRenderedText = '';
  private homeTapCount = 0;
  private homePetReactSec = 0;

  constructor(private readonly deps: WebHomeViewDeps) {
    this.bindEvents();
  }

  tick(dtSec: number, animTimeSec: number): void {
    this.homePetReactSec = Math.max(0, this.homePetReactSec - dtSec);
    this.homeDialogueElapsedSec += dtSec;
    if (this.homeDialogueElapsedSec >= HOME_DIALOGUE_INTERVAL_SEC) {
      this.homeDialogueElapsedSec = 0;
      this.homeCustomLine = null;
      this.homeDialogueIdx += 1;
    }
    this.updateCatVisuals(animTimeSec);
  }

  decayReaction(dtSec: number): void {
    this.homePetReactSec = Math.max(0, this.homePetReactSec - dtSec);
  }

  updateLivesWidgets(): void {
    const { el } = this.deps;
    const synced = syncLives(this.deps.getSaveData(), Date.now());
    this.deps.setSaveData(synced.save);
    const save = synced.save;

    const pipsHtml = Array.from({ length: MAX_LIVES }, (_, i) =>
      `<span class="life-pip ${i < save.lives ? 'filled' : ''}"></span>`
    ).join('');
    const text = `${save.lives}/${MAX_LIVES}`;
    const timer =
      save.lives < MAX_LIVES && synced.nextRegenInSec > 0
        ? formatCountdownMmSs(synced.nextRegenInSec)
        : '';

    el.homeLivesPipsEl.innerHTML = pipsHtml;
    el.homeLivesTextEl.textContent = text;
    el.homeLivesTimerEl.textContent = timer;
  }

  render(animTimeSec: number): void {
    const { el } = this.deps;
    const save = this.deps.getSaveData();
    const { theme, room } = getRoomForLevel(save.currentLevel);
    if (this.deps.getScreen() === 'home') {
      this.deps.onApplyRoomThemeColors(theme);
    }

    const rank = getButlerRank(save.totalLevelsCleared);
    const teaser = getNextUnlockTeaser(save.currentLevel, save.highestLevel);

    el.homeBgEl.src = room.bgWebUrl;
    el.homeNextThumbEl.src = room.bgWebUrl;
    el.homeCoinCountEl.textContent = String(save.coins ?? 0);
    el.homeTreatCountEl.textContent = String(save.petTreats);
    el.homeRankTextEl.textContent =
      (save.winStreak ?? 0) >= 2 ? `${rank.title} · ${save.winStreak}连胜` : rank.title;
    this.updateLivesWidgets();

    el.homeNextTitleEl.textContent = `第 ${save.currentLevel} 关 · ${room.name}`;
    el.homeNextSubEl.textContent = teaser;
    el.homePlayLabelEl.textContent = getHomePlayCtaLabel(save);
    el.homeShopDotEl.style.display = canClaimDailyFree(save) ? 'block' : 'none';
    if (this.deps.getScreen() === 'home') {
      this.updateCatVisuals(animTimeSec);
    }
  }

  updateCatVisuals(animTimeSec: number): void {
    const { el } = this.deps;
    const save = this.deps.getSaveData();
    const themeIdx = (save.currentLevel - 1) % ROOM_ORDER.length;
    const homeLines = buildHomeCatLines({
      roomTheme: ROOM_ORDER[themeIdx],
      currentLevel: save.currentLevel,
      totalLevelsCleared: save.totalLevelsCleared,
      petTreats: save.petTreats,
      canClaimDailyFree: canClaimDailyFree(save),
      coins: save.coins,
      lives: save.lives,
    });
    const activeLine = this.homeCustomLine ?? homeLines[this.homeDialogueIdx % homeLines.length];
    if (activeLine !== this.homeLastRenderedText) {
      this.homeLastRenderedText = activeLine;
      el.homeCatBubbleEl.classList.remove('pop-in');
      void el.homeCatBubbleEl.offsetWidth;
      el.homeCatBubbleEl.classList.add('pop-in');
    }
    const typed = sliceTypedText(activeLine, this.homeDialogueElapsedSec);
    const measureEl = el.homeCatBubbleEl.querySelector<HTMLElement>('.bubble-measure');
    const txtEl = el.homeCatBubbleEl.querySelector<HTMLElement>('.bubble-txt');
    const caretEl = el.homeCatBubbleEl.querySelector<HTMLElement>('.bubble-caret');
    if (measureEl && measureEl.textContent !== activeLine) {
      measureEl.textContent = activeLine;
    }
    if (txtEl && txtEl.textContent !== typed.visibleText) {
      txtEl.textContent = typed.visibleText;
    }
    if (caretEl) {
      caretEl.style.display = typed.typing ? 'inline-block' : 'none';
    }

    const hctx = el.homeCatCanvasEl.getContext('2d');
    if (hctx) {
      hctx.clearRect(0, 0, el.homeCatCanvasEl.width, el.homeCatCanvasEl.height);
      const reactProgress =
        this.homePetReactSec > 0 ? 1 - this.homePetReactSec / PET_REACTION_DURATION_SEC : 0;
      drawAnimatedCat(hctx, 128, 132, 236, {
        timeSec: animTimeSec,
        mood: reactProgress > 0 ? 'pleased' : 'idle',
        talking: typed.typing,
        petReactionProgress: reactProgress,
      });
    }
  }

  private bindEvents(): void {
    const { el } = this.deps;

    el.homeCatStageEl.addEventListener('click', () => {
      this.deps.onUnlockAudio();
      this.homeCustomLine = pickTapReactionLine(this.homeTapCount++);
      this.homeDialogueElapsedSec = 0;
      this.homePetReactSec = PET_REACTION_DURATION_SEC;
      this.deps.onPlayMeowHappy();
      this.deps.onVibrate('light');
      this.updateCatVisuals(this.deps.getAnimTimeSec());
    });

    el.homePlayBtnEl.addEventListener('click', () => this.deps.onPlayClick());
    el.homeLivesPillEl.addEventListener('click', () => this.deps.onOpenLivesOrShop());
    el.homeSettingsTopEl.addEventListener('click', () => this.deps.onOpenSettings());

    el.homeScreenEl.querySelectorAll<HTMLElement>('[data-home-menu]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.homeMenu;
        if (key === 'shop') this.deps.onOpenShop();
        else if (key === 'share') this.deps.onTriggerShare();
        else if (key === 'help') this.deps.onOpenHelp();
      });
    });
  }
}

export { ROOM_CATALOG };

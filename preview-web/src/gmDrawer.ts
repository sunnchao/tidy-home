import type { GameSession } from '@core/gameSession';
import type { SaveData } from '@core/types';
import { consumeLife, getLocalDateKey, grantLife, MAX_LIVES, syncDailyReset, syncLives } from '@core/userProfile';
import type { MockPlatformAdapter } from '@platform/MockPlatformAdapter';
import type { WebAudioPlayer } from './audioPlayer';
import type { WebBoardView } from './boardView';
import type { ShellElements } from './shellTemplate';

export interface GmDrawerDeps {
  el: ShellElements;
  platform: MockPlatformAdapter;
  audio: WebAudioPlayer;
  boardView: WebBoardView;
  getSession: () => GameSession;
  getSaveData: () => SaveData;
  setSaveData: (next: SaveData) => void;
  onRender: () => void;
  onOpenRoomsModal: () => void;
  onOpenShopDailyModal: (focus: 'shop' | 'daily') => void;
  onResetToHome: () => void;
}

export function bindGmDrawer(deps: GmDrawerDeps): void {
  const { el } = deps;
  el.gmBtnEl.addEventListener('click', () => {
    el.gmDrawerEl.classList.toggle('open');
  });

  el.gmDrawerEl.addEventListener('click', (e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-gm]');
    if (!btn) return;
    const action = btn.dataset.gm;
    el.gmDrawerEl.classList.remove('open');

    const save = deps.getSaveData();
    if (action === 'flashlight') {
      deps.boardView.toggleBlackout();
    } else if (action === 'cat') {
      deps.getSession().forceCatMischief();
      deps.onRender();
    } else if (action === 'coins') {
      const next = { ...save, coins: (save.coins ?? 0) + 200 };
      deps.setSaveData(next);
      deps.platform.saveProgress(next);
      deps.audio.play('booster');
      deps.onRender();
    } else if (action === 'treats') {
      const next = { ...save, petTreats: save.petTreats + 3 };
      deps.setSaveData(next);
      deps.platform.saveProgress(next);
      deps.audio.play('booster');
      deps.onRender();
    } else if (action === 'spendLife') {
      const res = consumeLife(save, Date.now());
      deps.setSaveData(res.save);
      deps.platform.saveProgress(res.save);
      deps.onRender();
    } else if (action === 'fullLives') {
      const next = grantLife(save, MAX_LIVES, Date.now()).save;
      deps.setSaveData(next);
      deps.platform.saveProgress(next);
      deps.audio.play('booster');
      deps.onRender();
    } else if (action === 'unlockThemes') {
      const next = { ...save, highestLevel: Math.max(save.highestLevel, 6) };
      deps.setSaveData(next);
      deps.platform.saveProgress(next);
      deps.onRender();
      deps.onOpenRoomsModal();
    } else if (action === 'resetDaily') {
      const next = {
        ...save,
        dailyClaimDate: getLocalDateKey(),
        dailyFreeClaimed: 0,
        dailyAdClaimed: 0,
        dailyShareClaimed: 0,
      };
      deps.setSaveData(next);
      deps.platform.saveProgress(next);
      deps.onRender();
      deps.onOpenShopDailyModal('daily');
    } else if (action === 'boosters') {
      deps.getSession().refillBoosters(3);
      const next = { ...save, boosters: deps.getSession().getBoosters() };
      deps.setSaveData(next);
      deps.platform.saveProgress(next);
      deps.audio.play('booster');
      deps.onRender();
    } else if (action === 'reset') {
      deps.platform.clearSave();
      const fresh = syncLives(syncDailyReset(deps.platform.loadSave()), Date.now()).save;
      deps.setSaveData(fresh);
      deps.audio.muted = fresh.muted;
      deps.onResetToHome();
    }
  });
}

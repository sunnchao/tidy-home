import { evaluateExternalShare, type ShareResult } from '@core/shareVerifier';
import type { MockPlatformAdapter } from '@platform/MockPlatformAdapter';
import { AD_PLACEMENT_LABELS, WEB_UI_ICONS } from '@shared/constants';
import type { ShellElements } from '../shellTemplate';

export function bindWebShareOverlay(
  platform: MockPlatformAdapter,
  el: ShellElements
): void {
  platform.setShareHandler(async (req): Promise<ShareResult> => {
    const shareUrl = window.location.href;
    const shareText = `${req.title} ${shareUrl}`;

    return new Promise<ShareResult>((resolve) => {
      const canShare = typeof navigator.share === 'function';
      el.shareModalCardEl.innerHTML = `
        <h2><img class="ui-ico md" src="${WEB_UI_ICONS.share}" alt="" /> 分享游戏</h2>
        <div class="share-box-preview"></div>
        <button class="btn-primary" id="share-go-btn" type="button">
          <img class="ui-ico" src="${WEB_UI_ICONS.share}" alt="" /> ${canShare ? '打开分享面板' : '复制分享链接'}
        </button>
        <div class="share-status-note" id="share-status-msg" role="status"></div>
        <button class="btn-secondary" id="share-cancel-btn" type="button">关闭</button>
      `;
      el.shareModalCardEl.querySelector('.share-box-preview')!.textContent = shareText;
      el.shareModalBackdropEl.classList.add('open');

      const statusEl = el.shareModalCardEl.querySelector('#share-status-msg') as HTMLElement;
      const goBtn = el.shareModalCardEl.querySelector('#share-go-btn') as HTMLButtonElement;
      const cancelBtn = el.shareModalCardEl.querySelector('#share-cancel-btn') as HTMLButtonElement;

      let settled = false;

      const finish = (res: ShareResult) => {
        if (settled) return;
        settled = true;
        el.shareModalBackdropEl.classList.remove('open');
        resolve(res);
      };

      cancelBtn.addEventListener('click', () => finish(evaluateExternalShare('cancelled')));

      goBtn.addEventListener('click', async () => {
        goBtn.disabled = true;
        if (canShare) {
          try {
            await navigator.share({ title: '我来收纳', text: req.title, url: shareUrl });
            finish(evaluateExternalShare('unconfirmed'));
            return;
          } catch (err: unknown) {
            if ((err as { name?: string })?.name === 'AbortError') {
              finish(evaluateExternalShare('cancelled'));
              return;
            }
            statusEl.textContent = '无法打开分享面板，请手动复制上方文案。';
          }
        } else {
          try {
            await navigator.clipboard.writeText(shareText);
            statusEl.textContent = '已复制，可以粘贴到聊天中。';
          } catch {
            statusEl.textContent = '请手动复制上方文案。';
          }
        }
        goBtn.disabled = false;
      });
    });
  });
}

export function bindWebAdOverlay(platform: MockPlatformAdapter, el: ShellElements): void {
  platform.setAdOverlayHandler((placement) => {
    return new Promise<boolean>((resolve) => {
      const desc = AD_PLACEMENT_LABELS[placement] || '解锁额外奖励';
      el.adModalCardEl.innerHTML = `
        <h2><img class="ui-ico md" src="${WEB_UI_ICONS.ad}" alt="" /> 模拟激励视频</h2>
        <p class="modal-sub">完成后即可：<strong>${desc}</strong></p>
        <div class="ad-progress-bar"><div class="ad-progress-fill" id="ad-fill"></div></div>
        <p class="modal-sub" id="ad-timer">奖励发放中... 1.5s</p>
        <button class="btn-secondary" id="ad-cancel">暂不领取</button>
      `;
      el.adModalBackdropEl.classList.add('open');

      let settled = false;
      const start = performance.now();
      const duration = 1500;
      const fillEl = el.adModalCardEl.querySelector('#ad-fill') as HTMLElement;
      const timerEl = el.adModalCardEl.querySelector('#ad-timer') as HTMLElement;
      const cancelBtn = el.adModalCardEl.querySelector('#ad-cancel') as HTMLButtonElement;

      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        el.adModalBackdropEl.classList.remove('open');
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

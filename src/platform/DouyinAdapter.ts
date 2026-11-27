import { evaluateExternalShare, type ShareRequest, type ShareResult, type ShareVerifyReason } from '../core/shareVerifier';
import type { AdPlacement, SaveData } from '../core/types';
import {
  DEFAULT_SAVE_DATA,
  type IPlatformAdapter,
  normalizeSaveData,
  type RewardedAdResult,
} from './IPlatformAdapter';

const STORAGE_KEY = 'tidy_home_tt_save_v1';
const SHARE_CONFIRMATION_TIMEOUT_MS = 60_000;

declare const tt: any;

export interface DouyinAdConfig {
  rewardedVideoAdUnitId: string;
  interstitialAdUnitId?: string;
}

export class DouyinAdapter implements IPlatformAdapter {
  readonly platformName = 'douyin' as const;
  private readonly config: DouyinAdConfig;

  constructor(config: DouyinAdConfig = { rewardedVideoAdUnitId: 'tt-adunit-placeholder' }) {
    this.config = config;
  }

  loadSave(): SaveData {
    try {
      if (typeof tt !== 'undefined' && typeof tt.getStorageSync === 'function') {
        const raw = tt.getStorageSync(STORAGE_KEY);
        if (raw) {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return normalizeSaveData(parsed as Partial<SaveData>);
        }
      }
    } catch {
      // Ignore
    }
    return normalizeSaveData(DEFAULT_SAVE_DATA);
  }

  saveProgress(data: SaveData): void {
    const clean = normalizeSaveData(data);
    try {
      if (typeof tt !== 'undefined' && typeof tt.setStorageSync === 'function') {
        tt.setStorageSync(STORAGE_KEY, JSON.stringify(clean));
      }
    } catch {
      // Ignore
    }
  }

  clearSave(): void {
    try {
      if (typeof tt !== 'undefined' && typeof tt.removeStorageSync === 'function') {
        tt.removeStorageSync(STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
  }

  async showRewardedAd(_placement: AdPlacement): Promise<RewardedAdResult> {
    if (typeof tt === 'undefined' || typeof tt.createRewardedVideoAd !== 'function') {
      return { rewarded: false, reason: 'tt_unavailable' };
    }
    return new Promise<RewardedAdResult>((resolve) => {
      const videoAd = tt.createRewardedVideoAd({
        adUnitId: this.config.rewardedVideoAdUnitId,
      });

      const cleanup = () => {
        videoAd.offClose(onClose);
        videoAd.offError(onError);
      };

      const onClose = (res: { isEnded?: boolean } | undefined) => {
        cleanup();
        const rewarded = !res || Boolean(res.isEnded);
        resolve({ rewarded, reason: rewarded ? undefined : 'closed_early' });
      };

      const onError = () => {
        cleanup();
        resolve({ rewarded: false, reason: 'ad_load_failed' });
      };

      videoAd.onClose(onClose);
      videoAd.onError(onError);
      videoAd
        .show()
        .catch(() =>
          videoAd
            .load()
            .then(() => videoAd.show())
            .catch(() => {
              cleanup();
              resolve({ rewarded: false, reason: 'ad_show_failed' });
            })
        );
    });
  }

  async showInterstitialAd(): Promise<void> {
    if (
      typeof tt === 'undefined' ||
      typeof tt.createInterstitialAd !== 'function' ||
      !this.config.interstitialAdUnitId
    ) {
      return;
    }
    try {
      const interstitial = tt.createInterstitialAd({
        adUnitId: this.config.interstitialAdUnitId,
      });
      await interstitial.load();
      await interstitial.show();
    } catch {
      // Ignore
    }
  }

  vibrateShort(_style?: 'light' | 'medium' | 'heavy'): void {
    try {
      if (typeof tt !== 'undefined' && typeof tt.vibrateShort === 'function') {
        tt.vibrateShort();
      }
    } catch {
      // Ignore
    }
  }

  async shareResult(req: string | ShareRequest): Promise<ShareResult> {
    const normalized: ShareRequest = typeof req === 'string' ? { title: req } : req;
    if (typeof tt === 'undefined' || typeof tt.shareAppMessage !== 'function') {
      return evaluateExternalShare('unavailable');
    }

    return new Promise<ShareResult>((resolve) => {
      const timer = setTimeout(() => finish('unconfirmed'), SHARE_CONFIRMATION_TIMEOUT_MS);
      const finish = (reason: ShareVerifyReason) => {
        clearTimeout(timer);
        resolve(evaluateExternalShare(reason));
      };

      try {
        tt.shareAppMessage({
          channel: '',
          title: normalized.title,
          query: normalized.query,
          imageUrl: normalized.imageUrl,
          success: () => finish('sdk_confirmed'),
          fail: (error?: { errNo?: number }) => finish(error?.errNo === 10502 ? 'cancelled' : 'failed'),
          cancel: () => finish('cancelled'),
        });
      } catch {
        finish('failed');
      }
    });
  }
}

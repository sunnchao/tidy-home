import type { AdPlacement, SaveData } from '../core/types';
import {
  DEFAULT_SAVE_DATA,
  type IPlatformAdapter,
  normalizeSaveData,
  type RewardedAdResult,
} from './IPlatformAdapter';

const STORAGE_KEY = 'tidy_home_wx_save_v1';

declare const wx: any;

export interface WeChatAdConfig {
  rewardedVideoAdUnitId: string;
  interstitialAdUnitId?: string;
}

export class WeChatAdapter implements IPlatformAdapter {
  readonly platformName = 'wechat' as const;
  private readonly config: WeChatAdConfig;
  private levelAdCount = 0;
  private readonly maxAdsPerLevel = 3;

  constructor(config: WeChatAdConfig = { rewardedVideoAdUnitId: 'adunit-placeholder-rewarded' }) {
    this.config = config;
  }

  resetLevelAdCap(): void {
    this.levelAdCount = 0;
  }

  loadSave(): SaveData {
    try {
      if (typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function') {
        const raw = wx.getStorageSync(STORAGE_KEY);
        if (raw) {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return normalizeSaveData(parsed as Partial<SaveData>);
        }
      }
    } catch {
      // Ignore storage error
    }
    return normalizeSaveData(DEFAULT_SAVE_DATA);
  }

  saveProgress(data: SaveData): void {
    const clean = normalizeSaveData(data);
    try {
      if (typeof wx !== 'undefined' && typeof wx.setStorageSync === 'function') {
        wx.setStorageSync(STORAGE_KEY, JSON.stringify(clean));
      }
    } catch {
      // Ignore storage error
    }
  }

  clearSave(): void {
    try {
      if (typeof wx !== 'undefined' && typeof wx.removeStorageSync === 'function') {
        wx.removeStorageSync(STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
  }

  async showRewardedAd(_placement: AdPlacement): Promise<RewardedAdResult> {
    if (this.levelAdCount >= this.maxAdsPerLevel) {
      return { rewarded: false, reason: 'level_cap_reached' };
    }
    if (typeof wx === 'undefined' || typeof wx.createRewardedVideoAd !== 'function') {
      return { rewarded: false, reason: 'wx_unavailable' };
    }

    return new Promise<RewardedAdResult>((resolve) => {
      try {
        const videoAd = wx.createRewardedVideoAd({
          adUnitId: this.config.rewardedVideoAdUnitId,
        });

        const cleanup = () => {
          videoAd?.offClose?.(onClose);
          videoAd?.offError?.(onError);
        };

        const onClose = (res: { isEnded?: boolean } | undefined) => {
          cleanup();
          const rewarded = !res || Boolean(res.isEnded);
          if (rewarded) this.levelAdCount += 1;
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
      } catch {
        resolve({ rewarded: false, reason: 'ad_create_failed' });
      }
    });
  }

  async showInterstitialAd(): Promise<void> {
    if (
      typeof wx === 'undefined' ||
      typeof wx.createInterstitialAd !== 'function' ||
      !this.config.interstitialAdUnitId
    ) {
      return;
    }
    try {
      const interstitial = wx.createInterstitialAd({
        adUnitId: this.config.interstitialAdUnitId,
      });
      await interstitial.show();
    } catch {
      // Ignore interstitial rejection (cooldown / unsupported)
    }
  }

  vibrateShort(style: 'light' | 'medium' | 'heavy' = 'light'): void {
    try {
      if (typeof wx !== 'undefined' && typeof wx.vibrateShort === 'function') {
        wx.vibrateShort({ type: style });
      }
    } catch {
      // Ignore
    }
  }

  shareResult(title: string): void {
    try {
      if (typeof wx !== 'undefined' && typeof wx.shareAppMessage === 'function') {
        wx.shareAppMessage({ title });
      }
    } catch {
      // Ignore
    }
  }
}

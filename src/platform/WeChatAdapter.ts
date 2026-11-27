import { isSaveDataEquivalent, mergeSaveData } from '../core/saveMerge';
import { evaluateExternalShare, type ShareRequest, type ShareResult } from '../core/shareVerifier';
import type { AdPlacement, SaveData } from '../core/types';
import { CLOUD_ENV_ID, CLOUD_SAVE_COLLECTION } from '../shared/cloudConfig';
import {
  DEFAULT_SAVE_DATA,
  type IPlatformAdapter,
  normalizeSaveData,
  type RewardedAdResult,
} from './IPlatformAdapter';
import type { WxCloudDatabase, WxMiniGameGlobal } from './wxCloudTypes';

const STORAGE_KEY = 'tidy_home_wx_save_v1';
const CLOUD_PUSH_DEBOUNCE_MS = 1200;
const PLACEHOLDER_REWARDED_AD_UNIT_ID = 'adunit-placeholder-rewarded';

declare const wx: WxMiniGameGlobal | undefined;

export interface WeChatCloudConfig {
  envId: string;
  traceUser?: boolean;
  saveCollection?: string;
}

export interface WeChatAdConfig {
  rewardedVideoAdUnitId: string;
  interstitialAdUnitId?: string;
  cloud?: Partial<WeChatCloudConfig>;
  wxApi?: WxMiniGameGlobal;
}

function resolveWxGlobal(injected?: WxMiniGameGlobal): WxMiniGameGlobal | null {
  if (injected) return injected;
  if (typeof wx !== 'undefined' && wx) return wx;
  return null;
}

function buildCloudSavePayload(
  save: SaveData,
  db: WxCloudDatabase,
  useCommandSet: boolean
): Record<string, unknown> {
  const clean = normalizeSaveData(save);
  const cmdSet = useCommandSet && db.command && typeof db.command.set === 'function' ? db.command.set : null;
  // Never include `_id` or `_openid`; CloudBase manages `_openid` automatically.
  return {
    schemaVersion: 1,
    userId: clean.userId,
    nickname: clean.nickname,
    createdAt: clean.createdAt,
    currentLevel: clean.currentLevel,
    highestLevel: clean.highestLevel,
    totalStars: clean.totalStars,
    totalLevelsCleared: clean.totalLevelsCleared,
    petTreats: clean.petTreats,
    lives: clean.lives,
    lastLifeRegenAtMs: clean.lastLifeRegenAtMs,
    coins: clean.coins,
    winStreak: clean.winStreak,
    bestWinStreak: clean.bestWinStreak,
    dailyClaimDate: clean.dailyClaimDate,
    dailyFreeClaimed: clean.dailyFreeClaimed,
    dailyAdClaimed: clean.dailyAdClaimed,
    dailyShareClaimed: clean.dailyShareClaimed,
    totalSharesVerified: clean.totalSharesVerified,
    boosters: cmdSet ? cmdSet({ ...clean.boosters }) : { ...clean.boosters },
    muted: clean.muted,
    vibrationEnabled: clean.vibrationEnabled,
    bgmEnabled: clean.bgmEnabled,
    levelStars: cmdSet ? cmdSet({ ...clean.levelStars }) : { ...clean.levelStars },
    updatedAtMs: clean.updatedAtMs ?? Date.now(),
  };
}

export class WeChatAdapter implements IPlatformAdapter {
  readonly platformName = 'wechat' as const;
  private readonly config: WeChatAdConfig;
  private readonly cloudConfig: Required<WeChatCloudConfig>;
  private readonly wxApi: WxMiniGameGlobal | null;
  private levelAdCount = 0;
  private readonly maxAdsPerLevel = 3;

  private cloudInitialized = false;
  private cloudDocId: string | null = null;
  private pendingPushTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPushSave: SaveData | null = null;
  private syncInFlight: Promise<SaveData | null> | null = null;
  private pushInFlight: Promise<boolean> | null = null;

  constructor(config: WeChatAdConfig = { rewardedVideoAdUnitId: PLACEHOLDER_REWARDED_AD_UNIT_ID }) {
    this.config = config;
    this.wxApi = resolveWxGlobal(config.wxApi);
    this.cloudConfig = {
      envId:
        config.cloud && typeof config.cloud.envId === 'string' && config.cloud.envId.trim().length > 0
          ? config.cloud.envId.trim()
          : CLOUD_ENV_ID,
      traceUser: config.cloud && typeof config.cloud.traceUser === 'boolean' ? config.cloud.traceUser : true,
      saveCollection:
        config.cloud &&
        typeof config.cloud.saveCollection === 'string' &&
        config.cloud.saveCollection.trim().length > 0
          ? config.cloud.saveCollection.trim()
          : CLOUD_SAVE_COLLECTION,
    };

    this.initCloud();

    try {
      if (this.wxApi) {
        if (typeof this.wxApi.showShareMenu === 'function') {
          this.wxApi.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
        }
        if (typeof this.wxApi.onShareAppMessage === 'function') {
          this.wxApi.onShareAppMessage(() => ({
            title: '我来收纳 · 一起整理治愈系小屋，快来比比谁更快通关!',
          }));
        }
        if (typeof this.wxApi.onHide === 'function') {
          this.wxApi.onHide(() => {
            if (this.pendingPushSave) {
              void this.flushCloudSave(this.pendingPushSave);
            }
          });
        }
      }
    } catch (err) {
      console.warn('[TidyHome WeChat] share/lifecycle init skipped:', err);
    }
  }

  initCloud(): boolean {
    if (this.cloudInitialized) return true;
    const api = this.wxApi;
    if (!api || !api.cloud || typeof api.cloud.init !== 'function') {
      return false;
    }
    try {
      api.cloud.init({
        env: this.cloudConfig.envId,
        traceUser: this.cloudConfig.traceUser,
      });
      this.cloudInitialized = true;
      return true;
    } catch (err) {
      console.warn('[TidyHome Cloud] wx.cloud.init failed:', err);
      return false;
    }
  }

  isCloudReady(): boolean {
    return this.cloudInitialized && Boolean(this.wxApi && this.wxApi.cloud);
  }

  private getCloudDatabase(): WxCloudDatabase | null {
    if (!this.initCloud()) return null;
    const api = this.wxApi;
    if (!api || !api.cloud || typeof api.cloud.database !== 'function') {
      return null;
    }
    try {
      return api.cloud.database({ env: this.cloudConfig.envId });
    } catch (err) {
      console.warn('[TidyHome Cloud] wx.cloud.database failed:', err);
      return null;
    }
  }

  resetLevelAdCap(): void {
    this.levelAdCount = 0;
  }

  private writeLocalSave(clean: SaveData): void {
    try {
      if (this.wxApi && typeof this.wxApi.setStorageSync === 'function') {
        this.wxApi.setStorageSync(STORAGE_KEY, JSON.stringify(clean));
      }
    } catch (err) {
      console.warn('[TidyHome WeChat] local setStorageSync failed:', err);
    }
  }

  loadSave(): SaveData {
    try {
      if (this.wxApi && typeof this.wxApi.getStorageSync === 'function') {
        const raw = this.wxApi.getStorageSync(STORAGE_KEY);
        if (raw) {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return normalizeSaveData(parsed as Partial<SaveData>);
        }
      }
    } catch (err) {
      console.warn('[TidyHome WeChat] local getStorageSync failed:', err);
    }
    return normalizeSaveData(DEFAULT_SAVE_DATA);
  }

  saveProgress(data: SaveData): void {
    const clean = normalizeSaveData({
      ...data,
      updatedAtMs: Date.now(),
    });
    this.writeLocalSave(clean);
    this.scheduleCloudPush(clean);
  }

  private scheduleCloudPush(save: SaveData): void {
    if (!this.isCloudReady()) return;
    this.pendingPushSave = save;
    if (this.pendingPushTimer !== null) {
      clearTimeout(this.pendingPushTimer);
    }
    this.pendingPushTimer = setTimeout(() => {
      this.pendingPushTimer = null;
      const latest = this.pendingPushSave;
      this.pendingPushSave = null;
      if (latest) {
        void this.upsertCloudSave(latest);
      }
    }, CLOUD_PUSH_DEBOUNCE_MS);
  }

  async flushCloudSave(data: SaveData): Promise<boolean> {
    if (this.pendingPushTimer !== null) {
      clearTimeout(this.pendingPushTimer);
      this.pendingPushTimer = null;
    }
    this.pendingPushSave = null;
    const clean = normalizeSaveData({
      ...data,
      updatedAtMs: data.updatedAtMs ?? Date.now(),
    });
    this.writeLocalSave(clean);
    return this.upsertCloudSave(clean);
  }

  async syncCloudSave(localSave: SaveData): Promise<SaveData | null> {
    if (this.syncInFlight) {
      return this.syncInFlight;
    }
    const db = this.getCloudDatabase();
    if (!db) return null;

    const run = async (): Promise<SaveData | null> => {
      const cleanLocal = normalizeSaveData(localSave);
      try {
        const col = db.collection(this.cloudConfig.saveCollection);
        // Query on schemaVersion=1 (non-empty predicate avoids SDK full-scan warning;
        // CloudBase creator-only collection rule automatically scopes results to current _openid).
        const res = await col.where({ schemaVersion: 1 }).limit(10).get();
        const rows = Array.isArray(res && res.data) ? res.data : [];

        if (rows.length === 0) {
          const payload = buildCloudSavePayload(
            { ...cleanLocal, updatedAtMs: cleanLocal.updatedAtMs ?? Date.now() },
            db,
            false
          );
          const created = await col.add({ data: payload });
          if (created && typeof created._id === 'string' && created._id.length > 0) {
            this.cloudDocId = created._id;
          }
          return cleanLocal;
        }

        // Fold all existing docs for this user into one canonical merged state (self-heals any duplicates).
        const primaryDoc = rows[0];
        if (typeof primaryDoc._id === 'string' && primaryDoc._id.length > 0) {
          this.cloudDocId = primaryDoc._id;
        }

        let remoteSave = normalizeSaveData(primaryDoc as Partial<SaveData>);
        for (let i = 1; i < rows.length; i++) {
          remoteSave = normalizeSaveData(
            mergeSaveData(remoteSave, normalizeSaveData(rows[i] as Partial<SaveData>))
          );
        }

        const merged = normalizeSaveData(mergeSaveData(cleanLocal, remoteSave));
        this.writeLocalSave(merged);

        if ((!isSaveDataEquivalent(merged, remoteSave) || rows.length > 1) && this.cloudDocId) {
          const updatePayload = buildCloudSavePayload(merged, db, true);
          await col.doc(this.cloudDocId).update({ data: updatePayload });
        }

        // Clean up any duplicate docs left behind from concurrent offline/legacy writes.
        for (let i = 1; i < rows.length; i++) {
          const extraRow = rows[i];
          const extraId = typeof extraRow._id === 'string' ? extraRow._id : '';
          if (extraId && extraId !== this.cloudDocId) {
            try {
              await col.doc(extraId).remove();
            } catch (cleanupErr) {
              console.warn('[TidyHome Cloud] duplicate doc cleanup skipped:', cleanupErr);
            }
          }
        }

        return merged;
      } catch (err) {
        console.warn('[TidyHome Cloud] syncCloudSave failed (keeping local save):', err);
        return null;
      }
    };

    this.syncInFlight = run();
    try {
      return await this.syncInFlight;
    } finally {
      this.syncInFlight = null;
    }
  }

  private async upsertCloudSave(save: SaveData): Promise<boolean> {
    if (this.syncInFlight) {
      await this.syncInFlight;
    }
    if (this.pushInFlight) {
      await this.pushInFlight;
    }
    const db = this.getCloudDatabase();
    if (!db) return false;

    const run = async (): Promise<boolean> => {
      try {
        const col = db.collection(this.cloudConfig.saveCollection);
        if (!this.cloudDocId) {
          const existing = await col.where({ schemaVersion: 1 }).limit(1).get();
          const rows = Array.isArray(existing && existing.data) ? existing.data : [];
          if (rows.length > 0 && typeof rows[0]._id === 'string' && rows[0]._id.length > 0) {
            this.cloudDocId = rows[0]._id;
          }
        }

        if (this.cloudDocId) {
          const payload = buildCloudSavePayload(save, db, true);
          await col.doc(this.cloudDocId).update({ data: payload });
          return true;
        }

        const payload = buildCloudSavePayload(save, db, false);
        const created = await col.add({ data: payload });
        if (created && typeof created._id === 'string' && created._id.length > 0) {
          this.cloudDocId = created._id;
        }
        return true;
      } catch (err) {
        console.warn('[TidyHome Cloud] upsertCloudSave failed:', err);
        return false;
      }
    };

    this.pushInFlight = run();
    try {
      return await this.pushInFlight;
    } finally {
      this.pushInFlight = null;
    }
  }

  clearSave(): void {
    if (this.pendingPushTimer !== null) {
      clearTimeout(this.pendingPushTimer);
      this.pendingPushTimer = null;
    }
    this.pendingPushSave = null;

    try {
      if (this.wxApi && typeof this.wxApi.removeStorageSync === 'function') {
        this.wxApi.removeStorageSync(STORAGE_KEY);
      }
    } catch (err) {
      console.warn('[TidyHome WeChat] local removeStorageSync failed:', err);
    }

    void this.clearCloudSaveDoc();
  }

  private async clearCloudSaveDoc(): Promise<void> {
    if (this.syncInFlight) {
      await this.syncInFlight;
    }
    const db = this.getCloudDatabase();
    if (!db) return;
    try {
      const col = db.collection(this.cloudConfig.saveCollection);
      let docId = this.cloudDocId;
      if (!docId) {
        const existing = await col.where({ schemaVersion: 1 }).limit(1).get();
        const rows = Array.isArray(existing && existing.data) ? existing.data : [];
        if (rows.length > 0 && typeof rows[0]._id === 'string') {
          docId = rows[0]._id;
        }
      }
      if (docId) {
        await col.doc(docId).remove();
      }
      this.cloudDocId = null;
    } catch (err) {
      console.warn('[TidyHome Cloud] clearCloudSaveDoc failed:', err);
    }
  }

  async showRewardedAd(_placement: AdPlacement): Promise<RewardedAdResult> {
    if (this.levelAdCount >= this.maxAdsPerLevel) {
      return { rewarded: false, reason: 'level_cap_reached' };
    }
    if (!this.config.rewardedVideoAdUnitId || this.config.rewardedVideoAdUnitId === PLACEHOLDER_REWARDED_AD_UNIT_ID) {
      return { rewarded: false, reason: 'ad_unconfigured' };
    }
    if (!this.wxApi || typeof this.wxApi.createRewardedVideoAd !== 'function') {
      return { rewarded: false, reason: 'wx_unavailable' };
    }

    return new Promise<RewardedAdResult>((resolve) => {
      try {
        const videoAd = this.wxApi!.createRewardedVideoAd!({
          adUnitId: this.config.rewardedVideoAdUnitId,
        });

        const cleanup = () => {
          if (typeof videoAd.offClose === 'function') videoAd.offClose(onClose);
          if (typeof videoAd.offError === 'function') videoAd.offError(onError);
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
      } catch (err) {
        console.warn('[TidyHome WeChat] createRewardedVideoAd failed:', err);
        resolve({ rewarded: false, reason: 'ad_create_failed' });
      }
    });
  }

  async showInterstitialAd(): Promise<void> {
    if (
      !this.wxApi ||
      typeof this.wxApi.createInterstitialAd !== 'function' ||
      !this.config.interstitialAdUnitId
    ) {
      return;
    }
    try {
      const interstitial = this.wxApi.createInterstitialAd({
        adUnitId: this.config.interstitialAdUnitId,
      });
      await interstitial.show();
    } catch (err) {
      console.warn('[TidyHome WeChat] interstitial ad skipped:', err);
    }
  }

  vibrateShort(style: 'light' | 'medium' | 'heavy' = 'light'): void {
    try {
      if (this.wxApi && typeof this.wxApi.vibrateShort === 'function') {
        this.wxApi.vibrateShort({ type: style });
      }
    } catch (err) {
      console.warn('[TidyHome WeChat] vibrateShort failed:', err);
    }
  }

  async shareResult(req: string | ShareRequest): Promise<ShareResult> {
    const normalized: ShareRequest = typeof req === 'string' ? { title: req } : req;
    if (!this.wxApi || typeof this.wxApi.shareAppMessage !== 'function') {
      return evaluateExternalShare('unavailable');
    }

    try {
      this.wxApi.shareAppMessage({
        title: normalized.title,
        query: normalized.query,
        imageUrl: normalized.imageUrl,
      });
      return evaluateExternalShare('unconfirmed');
    } catch (err) {
      console.warn('[TidyHome WeChat] shareAppMessage failed:', err);
      return evaluateExternalShare('failed');
    }
  }
}

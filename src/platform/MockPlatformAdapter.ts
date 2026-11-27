import { evaluateExternalShare, type ShareRequest, type ShareResult } from '../core/shareVerifier';
import type { AdPlacement, SaveData } from '../core/types';
import {
  DEFAULT_SAVE_DATA,
  type IPlatformAdapter,
  normalizeSaveData,
  type RewardedAdResult,
} from './IPlatformAdapter';

const STORAGE_KEY = 'tidy_home_save_v1';

export type MockAdOverlayHandler = (placement: AdPlacement) => Promise<boolean>;
export type MockShareHandler = (req: ShareRequest) => Promise<ShareResult>;

export class MockPlatformAdapter implements IPlatformAdapter {
  readonly platformName = 'web-mock' as const;
  private memoryFallback: SaveData = normalizeSaveData(DEFAULT_SAVE_DATA);
  private adOverlayHandler: MockAdOverlayHandler | null = null;
  private shareHandler: MockShareHandler | null = null;

  setAdOverlayHandler(handler: MockAdOverlayHandler | null): void {
    this.adOverlayHandler = handler;
  }

  setShareHandler(handler: MockShareHandler | null): void {
    this.shareHandler = handler;
  }

  loadSave(): SaveData {
    try {
      if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
        const raw = globalThis.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          return normalizeSaveData(JSON.parse(raw) as Partial<SaveData>);
        }
      }
    } catch {
      // Ignore storage access errors in headless or restricted contexts
    }
    return normalizeSaveData(this.memoryFallback);
  }

  saveProgress(data: SaveData): void {
    const clean = normalizeSaveData(data);
    this.memoryFallback = clean;
    try {
      if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
        globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
      }
    } catch {
      // Fallback kept in memory
    }
  }

  clearSave(): void {
    this.memoryFallback = normalizeSaveData(DEFAULT_SAVE_DATA);
    try {
      if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
        globalThis.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
  }

  async showRewardedAd(placement: AdPlacement): Promise<RewardedAdResult> {
    if (this.adOverlayHandler) {
      const ok = await this.adOverlayHandler(placement);
      return ok ? { rewarded: true } : { rewarded: false, reason: 'cancelled' };
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { rewarded: true };
  }

  async showInterstitialAd(): Promise<void> {
    // No-op in MVP web preview
  }

  vibrateShort(_style?: 'light' | 'medium' | 'heavy'): void {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(14);
      }
    } catch {
      // Ignore
    }
  }

  async shareResult(req: string | ShareRequest): Promise<ShareResult> {
    const normalized: ShareRequest = typeof req === 'string' ? { title: req } : req;
    if (this.shareHandler) {
      return this.shareHandler(normalized);
    }
    return evaluateExternalShare('unavailable');
  }
}

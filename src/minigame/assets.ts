import { getAllSpriteResources, getItemSprite, ROOM_CATALOG, ROOM_ORDER } from '@core/catalogs';
import type { GeneratedLevel, RoomThemeId } from '@core/types';
import type { OcclusionTier } from '@core/visualDepth';
import type { WxMiniGameGlobal } from '@platform/wxCloudTypes';
import { AlphaMaskStore, type AlphaMask } from '@shared/alphaHitTest';
import type { CloudAssetManifest } from '@shared/cloudConfig';
import { MINIGAME_STATIC_SPRITE_PATHS, MINIGAME_UI_ICON_PATHS } from '@shared/constants';
import { CloudAssetCache } from './cloudAssetCache';

declare const wx: WxMiniGameGlobal | undefined;
declare const tt: unknown;

export class MiniGameAssetStore {
  private readonly images = new Map<string, any>();
  private readonly loadingKeys = new Set<string>();
  private readonly failedLocalKeys = new Set<string>();
  private readonly shadedSpriteCache = new Map<string, any>();
  private readonly audioCache = new Map<string, any>();
  private readonly alphaMaskStore: AlphaMaskStore;
  private readonly cloudCache: CloudAssetCache;
  private loadVersion = 0;

  constructor(private readonly api: any, options: { cloudCache?: CloudAssetCache } = {}) {
    this.alphaMaskStore = new AlphaMaskStore((w, h) => this.createOffscreenCanvas(w, h));
    this.cloudCache =
      options.cloudCache ??
      new CloudAssetCache((api as WxMiniGameGlobal | null) ?? null);
  }

  getLoadVersion(): number {
    return this.loadVersion;
  }

  getAlphaMask(key: string): AlphaMask | null {
    return this.alphaMaskStore.getMask(key, this.images.get(key));
  }

  getCloudManifest(): CloudAssetManifest {
    return this.cloudCache.getManifest();
  }

  async syncCloudManifest(): Promise<CloudAssetManifest | null> {
    return this.cloudCache.syncRemoteManifest();
  }

  /**
   * Loads lightweight static UI icons and mascot/cardboard sprites needed immediately at boot.
   */
  preloadCore(): void {
    const corePaths = [...MINIGAME_STATIC_SPRITE_PATHS, ...MINIGAME_UI_ICON_PATHS];
    for (const key of corePaths) {
      this.ensureImageLoaded(key);
    }
  }

  /**
   * Loads a single room theme background on demand (local-first with CloudBase Storage fallback).
   */
  preloadTheme(theme: RoomThemeId): void {
    const room = ROOM_CATALOG[theme];
    if (!room) return;
    this.ensureImageLoaded(`resources/${room.bgResource}`);
  }

  /**
   * Loads ONLY the room background and exact item sprite variants used by the target level,
   * and prunes stale offscreen shaded canvases from prior levels to keep memory flat across 100 levels.
   */
  preloadForLevel(
    level: Pick<GeneratedLevel, 'theme' | 'initialItems'>,
    options: { nextTheme?: RoomThemeId } = {}
  ): void {
    const keepKeys = new Set<string>();
    const room = ROOM_CATALOG[level.theme];
    if (room) {
      const bgKey = `resources/${room.bgResource}`;
      keepKeys.add(bgKey);
      this.ensureImageLoaded(bgKey);
    }

    for (const item of level.initialItems) {
      const sprite = getItemSprite(item.itemId, item.variantIndex ?? 0);
      const key = `resources/${sprite.spriteResource}.png`;
      keepKeys.add(key);
      this.ensureImageLoaded(key);
    }

    if (options.nextTheme && options.nextTheme !== level.theme) {
      this.preloadTheme(options.nextTheme);
    }

    this.pruneShadedCache(keepKeys);
  }

  /**
   * Releases offscreen desaturated/darkened canvases that are no longer needed by the active level.
   */
  pruneShadedCache(keepBaseKeys: ReadonlySet<string>): number {
    let removed = 0;
    for (const cacheKey of Array.from(this.shadedSpriteCache.keys())) {
      const sep = cacheKey.lastIndexOf('@t');
      const baseKey = sep > 0 ? cacheKey.slice(0, sep) : cacheKey;
      if (!keepBaseKeys.has(baseKey)) {
        this.shadedSpriteCache.delete(cacheKey);
        removed += 1;
      }
    }
    return removed;
  }

  /**
   * Legacy full preload helper: loads core assets plus all currently bundled (non-remote-only)
   * rooms and sprites while avoiding eager cloud downloads for remote-only expansion packs.
   */
  preloadAll(): void {
    this.preloadCore();
    for (const id of ROOM_ORDER) {
      const key = `resources/${ROOM_CATALOG[id].bgResource}`;
      if (!this.cloudCache.isRemoteOnly(key)) {
        this.ensureImageLoaded(key);
      }
    }
    for (const res of getAllSpriteResources()) {
      const key = `resources/${res}.png`;
      if (!this.cloudCache.isRemoteOnly(key)) {
        this.ensureImageLoaded(key);
      }
    }
  }

  /**
   * Idempotently loads a resource key into memory:
   * 1. If marked remote-only -> resolves via CloudAssetCache (USER_DATA_PATH cache or wx.cloud.downloadFile)
   * 2. Otherwise -> loads bundled local path first, falling back to CloudAssetCache on error.
   */
  ensureImageLoaded(key: string): void {
    if (!key) return;
    if (this.images.has(key) || this.loadingKeys.has(key)) {
      return;
    }

    if (this.cloudCache.isRemoteOnly(key) || this.failedLocalKeys.has(key)) {
      const cachedDiskPath = this.cloudCache.getCachedPath(key);
      if (cachedDiskPath) {
        this.loadingKeys.add(key);
        this.attachImage(key, cachedDiskPath, false);
        return;
      }
      if (!this.cloudCache.isCloudDownloadSupported() || !this.cloudCache.canAttemptDownload(key)) {
        return;
      }
      this.loadingKeys.add(key);
      void this.loadImageFromCloud(key);
      return;
    }

    this.loadingKeys.add(key);

    const cachedDiskPath = this.cloudCache.getCachedPath(key);
    if (cachedDiskPath) {
      this.attachImage(key, cachedDiskPath, false);
      return;
    }

    this.attachImage(key, key, true);
  }

  private attachImage(key: string, src: string, allowCloudFallback: boolean): void {
    if (!this.api || typeof this.api.createImage !== 'function') {
      this.loadingKeys.delete(key);
      return;
    }
    const img = this.api.createImage();
    img.onload = () => {
      this.loadingKeys.delete(key);
      this.failedLocalKeys.delete(key);
      this.images.set(key, img);
      this.loadVersion += 1;
    };
    img.onerror = () => {
      this.images.delete(key);
      if (allowCloudFallback) {
        this.failedLocalKeys.add(key);
        if (this.cloudCache.isCloudDownloadSupported() && this.cloudCache.canAttemptDownload(key)) {
          void this.loadImageFromCloud(key);
          return;
        }
      }
      this.loadingKeys.delete(key);
    };
    img.src = src;
    this.images.set(key, img);
  }

  private async loadImageFromCloud(key: string): Promise<void> {
    try {
      const localPath = await this.cloudCache.resolveToLocalPath(key);
      if (!localPath) {
        this.loadingKeys.delete(key);
        return;
      }
      this.attachImage(key, localPath, false);
    } catch (err) {
      this.loadingKeys.delete(key);
      console.warn(`[TidyHome Assets] Cloud fallback failed for ${key}:`, err);
    }
  }

  getImage(key: string): any | undefined {
    const existing = this.images.get(key);
    if (!existing && !this.loadingKeys.has(key)) {
      this.ensureImageLoaded(key);
      return this.images.get(key);
    }
    return existing;
  }

  playSfx(name: string, muted: boolean): void {
    if (muted) return;
    try {
      let audio = this.audioCache.get(name);
      if (!audio) {
        audio = this.api.createInnerAudioContext();
        audio.src = `resources/audio/${name}.wav`;
        this.audioCache.set(name, audio);
      }
      audio.stop();
      audio.play();
    } catch (err) {
      console.warn(`[TidyHome Audio] playSfx(${name}) failed:`, err);
    }
  }

  getItemDrawable(
    key: string,
    tier: OcclusionTier,
    shadeColor: string | null,
    grayscale: number,
    brightness: number
  ): any {
    const img = this.getImage(key);
    if (!img || !img.width || !img.height) return null;
    if (tier === 0 || (grayscale <= 0.001 && Math.abs(brightness - 1) <= 0.001 && !shadeColor)) {
      return img;
    }

    const cacheKey = `${key}@t${tier}`;
    const cached = this.shadedSpriteCache.get(cacheKey);
    if (cached) return cached;

    // Preserve natural sprite aspect ratio on offscreen shaded sprites for crisp outline fidelity.
    const maxDim = 256;
    const aspect = img.width / Math.max(1, img.height);
    const offW = img.width >= img.height ? maxDim : Math.max(32, Math.round(maxDim * aspect));
    const offH = img.height >= img.width ? maxDim : Math.max(32, Math.round(maxDim / Math.max(0.25, aspect)));
    const offscreen = this.createOffscreenCanvas(offW, offH);
    if (!offscreen) return img;
    const g = offscreen.getContext('2d');
    if (!g) return img;

    g.clearRect(0, 0, offW, offH);
    g.drawImage(img, 0, 0, offW, offH);
    let desaturated = false;
    try {
      const imgData = g.getImageData(0, 0, offW, offH);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        const r = data[i];
        const gr = data[i + 1];
        const b = data[i + 2];
        const lum = r * 0.299 + gr * 0.587 + b * 0.114;
        // Blend subtle warm-umber indoor shadow bias so buried items recede without turning cold/muddy
        const warmR = 1.03;
        const warmG = 0.97;
        const warmB = 0.9;
        data[i] = Math.min(255, Math.round((r + (lum - r) * grayscale) * brightness * warmR));
        data[i + 1] = Math.min(255, Math.round((gr + (lum - gr) * grayscale) * brightness * warmG));
        data[i + 2] = Math.min(255, Math.round((b + (lum - b) * grayscale) * brightness * warmB));
      }
      g.putImageData(imgData, 0, 0);
      desaturated = true;
    } catch {
      desaturated = false;
    }
    if (!desaturated && shadeColor) {
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = shadeColor;
      g.fillRect(0, 0, offW, offH);
      g.globalCompositeOperation = 'source-over';
    }
    this.shadedSpriteCache.set(cacheKey, offscreen);
    return offscreen;
  }

  createOffscreenCanvas(width: number, height: number): any {
    if (this.api && typeof this.api.createCanvas === 'function') {
      const c = this.api.createCanvas();
      c.width = width;
      c.height = height;
      return c;
    }
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      return c;
    }
    return null;
  }
}

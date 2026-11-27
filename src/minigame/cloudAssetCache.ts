import type { WxFileSystemManager, WxMiniGameGlobal } from '@platform/wxCloudTypes';
import {
  buildCloudFileId,
  CLOUD_DOWNLOAD_BASE_BACKOFF_MS,
  CLOUD_DOWNLOAD_MAX_PER_WINDOW,
  CLOUD_DOWNLOAD_MAX_RETRIES,
  CLOUD_DOWNLOAD_WINDOW_MS,
  CLOUD_FILE_ID_BASE,
  CLOUD_MANIFEST_PATH,
  type CloudAssetManifest,
  DEFAULT_CLOUD_MANIFEST,
  isAllowedCloudResourceKey,
  isRemoteOnlyResource,
  parseCloudAssetManifest,
  resourceKeyToCacheRelPath,
  resourceKeyToCloudFileId,
} from '@shared/cloudConfig';

function getParentDir(fullPath: string): string {
  const idx = fullPath.lastIndexOf('/');
  return idx > 0 ? fullPath.slice(0, idx) : '';
}

function ensureDir(fs: WxFileSystemManager, dirPath: string): void {
  if (!dirPath) return;
  try {
    fs.accessSync(dirPath);
  } catch {
    try {
      fs.mkdirSync(dirPath, true);
    } catch {
      // Directory may have been created concurrently.
    }
  }
}

function fileExists(fs: WxFileSystemManager, fullPath: string): boolean {
  try {
    fs.accessSync(fullPath);
    return true;
  } catch {
    return false;
  }
}

interface FailureRecord {
  failures: number;
  nextAllowedAtMs: number;
  circuitOpen: boolean;
}

export interface CloudAssetCacheOptions {
  fileIdBase?: string;
  initialManifest?: CloudAssetManifest;
  maxRetries?: number;
  baseBackoffMs?: number;
  windowMs?: number;
  maxDownloadsPerWindow?: number;
  nowFn?: () => number;
}

/**
 * Downloads remote resources from WeChat CloudBase Storage (`wx.cloud.downloadFile`)
 * and persists them into `wx.env.USER_DATA_PATH/tidy_home_cache/<version>/...`
 * with Plan-A anti-abuse guardrails:
 * 1. Strict resource path whitelist (rejects path traversal / arbitrary bucket probing)
 * 2. Persistent local disk cache (zero repeat cloud traffic)
 * 3. Concurrent in-flight deduplication
 * 4. Per-key exponential backoff & session circuit breaker (prevents 60fps retry loops)
 * 5. Rolling-window download burst rate limiter
 */
export class CloudAssetCache {
  private manifest: CloudAssetManifest = {
    ...DEFAULT_CLOUD_MANIFEST,
    bundledRooms: [...DEFAULT_CLOUD_MANIFEST.bundledRooms],
    remoteRooms: [...DEFAULT_CLOUD_MANIFEST.remoteRooms],
    remoteSprites: [...DEFAULT_CLOUD_MANIFEST.remoteSprites],
  };
  private readonly inFlight = new Map<string, Promise<string | null>>();
  private readonly failureState = new Map<string, FailureRecord>();
  private readonly downloadTimestamps: number[] = [];
  private readonly fileIdBase: string;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly windowMs: number;
  private readonly maxDownloadsPerWindow: number;
  private readonly nowFn: () => number;

  constructor(
    private readonly wxApi: WxMiniGameGlobal | null,
    options: CloudAssetCacheOptions = {}
  ) {
    this.fileIdBase = options.fileIdBase ?? CLOUD_FILE_ID_BASE;
    this.maxRetries = Math.max(0, options.maxRetries ?? CLOUD_DOWNLOAD_MAX_RETRIES);
    this.baseBackoffMs = Math.max(200, options.baseBackoffMs ?? CLOUD_DOWNLOAD_BASE_BACKOFF_MS);
    this.windowMs = Math.max(1000, options.windowMs ?? CLOUD_DOWNLOAD_WINDOW_MS);
    this.maxDownloadsPerWindow = Math.max(
      1,
      options.maxDownloadsPerWindow ?? CLOUD_DOWNLOAD_MAX_PER_WINDOW
    );
    this.nowFn = options.nowFn ?? (() => Date.now());

    if (options.initialManifest) {
      this.manifest = {
        ...options.initialManifest,
        bundledRooms: [...options.initialManifest.bundledRooms],
        remoteRooms: [...options.initialManifest.remoteRooms],
        remoteSprites: [...options.initialManifest.remoteSprites],
      };
    }
  }

  getManifest(): CloudAssetManifest {
    return this.manifest;
  }

  isRemoteOnly(resourceKey: string): boolean {
    return isRemoteOnlyResource(resourceKey, this.manifest);
  }

  isCloudDownloadSupported(): boolean {
    return Boolean(
      this.wxApi &&
        this.wxApi.cloud &&
        typeof this.wxApi.cloud.downloadFile === 'function'
    );
  }

  /**
   * Returns whether a resource key is currently allowed to attempt a cloud download
   * (passes whitelist, not cooling down, not circuit-broken, and within burst rate limit).
   */
  canAttemptDownload(resourceKey: string): boolean {
    if (!isAllowedCloudResourceKey(resourceKey)) {
      return false;
    }
    const now = this.nowFn();
    const fail = this.failureState.get(resourceKey);
    if (fail) {
      if (fail.circuitOpen) return false;
      if (now < fail.nextAllowedAtMs) return false;
    }
    this.pruneDownloadWindow(now);
    return this.downloadTimestamps.length < this.maxDownloadsPerWindow;
  }

  private pruneDownloadWindow(nowMs: number): void {
    const cutoff = nowMs - this.windowMs;
    while (this.downloadTimestamps.length > 0 && this.downloadTimestamps[0] <= cutoff) {
      this.downloadTimestamps.shift();
    }
  }

  private recordDownloadFailure(resourceKey: string): void {
    const now = this.nowFn();
    const prev = this.failureState.get(resourceKey);
    const failures = (prev ? prev.failures : 0) + 1;
    const circuitOpen = failures > this.maxRetries;
    const backoff = this.baseBackoffMs * Math.pow(3, Math.max(0, failures - 1));
    this.failureState.set(resourceKey, {
      failures,
      nextAllowedAtMs: circuitOpen ? Number.POSITIVE_INFINITY : now + backoff,
      circuitOpen,
    });
  }

  private clearDownloadFailure(resourceKey: string): void {
    this.failureState.delete(resourceKey);
  }

  private getFsAndRoot(): { fs: WxFileSystemManager; userDataPath: string } | null {
    if (!this.wxApi || typeof this.wxApi.getFileSystemManager !== 'function') {
      return null;
    }
    const userDataPath =
      this.wxApi.env && typeof this.wxApi.env.USER_DATA_PATH === 'string'
        ? this.wxApi.env.USER_DATA_PATH.replace(/\/+$/, '')
        : '';
    if (!userDataPath) return null;
    try {
      return { fs: this.wxApi.getFileSystemManager(), userDataPath };
    } catch (err) {
      console.warn('[TidyHome CloudCache] getFileSystemManager failed:', err);
      return null;
    }
  }

  getCachedPath(resourceKey: string): string | null {
    if (!isAllowedCloudResourceKey(resourceKey)) return null;
    const env = this.getFsAndRoot();
    if (!env) return null;
    const targetPath = `${env.userDataPath}/${resourceKeyToCacheRelPath(resourceKey, this.manifest.assetVersion)}`;
    return fileExists(env.fs, targetPath) ? targetPath : null;
  }

  /**
   * Resolves a resource key to a local playable file path by checking the persistent
   * USER_DATA_PATH cache first, then downloading from CloudBase Storage if allowed.
   */
  async resolveToLocalPath(resourceKey: string): Promise<string | null> {
    if (!isAllowedCloudResourceKey(resourceKey)) {
      console.warn(`[TidyHome CloudCache] rejected disallowed resource key: ${resourceKey}`);
      return null;
    }

    const cached = this.getCachedPath(resourceKey);
    if (cached) return cached;

    const existingPromise = this.inFlight.get(resourceKey);
    if (existingPromise) return existingPromise;

    if (!this.canAttemptDownload(resourceKey)) {
      return null;
    }

    const task = this.downloadAndCache(resourceKey);
    this.inFlight.set(resourceKey, task);
    try {
      return await task;
    } finally {
      this.inFlight.delete(resourceKey);
    }
  }

  private async downloadAndCache(resourceKey: string): Promise<string | null> {
    if (!this.isCloudDownloadSupported()) return null;

    const now = this.nowFn();
    this.pruneDownloadWindow(now);
    if (this.downloadTimestamps.length >= this.maxDownloadsPerWindow) {
      console.warn(`[TidyHome CloudCache] burst rate limit reached; deferring ${resourceKey}`);
      return null;
    }
    this.downloadTimestamps.push(now);

    const fileID = resourceKeyToCloudFileId(
      resourceKey,
      this.manifest.storagePrefix,
      this.fileIdBase
    );

    try {
      const res = await this.wxApi!.cloud!.downloadFile({ fileID });
      const tempPath = res && typeof res.tempFilePath === 'string' ? res.tempFilePath : '';
      if (!tempPath) {
        this.recordDownloadFailure(resourceKey);
        return null;
      }

      this.clearDownloadFailure(resourceKey);
      const env = this.getFsAndRoot();
      if (!env) {
        return tempPath;
      }

      const targetPath = `${env.userDataPath}/${resourceKeyToCacheRelPath(resourceKey, this.manifest.assetVersion)}`;
      ensureDir(env.fs, getParentDir(targetPath));

      if (typeof env.fs.copyFileSync === 'function') {
        try {
          env.fs.copyFileSync(tempPath, targetPath);
          return targetPath;
        } catch (copyErr) {
          console.warn('[TidyHome CloudCache] copyFileSync fallback to tempFilePath:', copyErr);
        }
      } else if (typeof env.fs.saveFileSync === 'function') {
        try {
          const saved = env.fs.saveFileSync(tempPath, targetPath);
          return saved || targetPath;
        } catch (saveErr) {
          console.warn('[TidyHome CloudCache] saveFileSync fallback to tempFilePath:', saveErr);
        }
      }

      return tempPath;
    } catch (err) {
      this.recordDownloadFailure(resourceKey);
      console.warn(`[TidyHome CloudCache] download failed for ${resourceKey} (${fileID}):`, err);
      return null;
    }
  }

  /**
   * Fetches `tidy-home/manifest.json` from CloudBase Storage to refresh remote asset routing
   * and cache-busting assetVersion without requiring a MiniGame resubmission.
   */
  async syncRemoteManifest(): Promise<CloudAssetManifest | null> {
    if (!this.isCloudDownloadSupported()) return null;
    const env = this.getFsAndRoot();
    if (!env) return null;

    const fileID = buildCloudFileId(CLOUD_MANIFEST_PATH, this.fileIdBase);
    try {
      const res = await this.wxApi!.cloud!.downloadFile({ fileID });
      const tempPath = res && typeof res.tempFilePath === 'string' ? res.tempFilePath : '';
      if (!tempPath) return null;
      const text = env.fs.readFileSync(tempPath, 'utf8');
      const parsed = parseCloudAssetManifest(JSON.parse(text));
      if (!parsed) return null;
      this.manifest = parsed;
      return parsed;
    } catch (err) {
      console.warn('[TidyHome CloudCache] syncRemoteManifest skipped:', err);
      return null;
    }
  }
}

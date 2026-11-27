import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateLevel } from '@core/levelGenerator';
import { isSaveDataEquivalent, mergeSaveData } from '@core/saveMerge';
import type { SaveData } from '@core/types';
import { createDefaultSaveData, normalizeSaveData } from '@platform/IPlatformAdapter';
import { WeChatAdapter } from '@platform/WeChatAdapter';
import type { WxFileSystemManager, WxMiniGameGlobal } from '@platform/wxCloudTypes';
import {
  buildCloudFileId,
  CLOUD_BUCKET_ID,
  CLOUD_ENV_ID,
  CLOUD_FILE_ID_BASE,
  DEFAULT_CLOUD_MANIFEST,
  isAllowedCloudResourceKey,
  isRemoteOnlyResource,
  parseCloudAssetManifest,
  resourceKeyToCacheRelPath,
  resourceKeyToCloudFileId,
} from '@shared/cloudConfig';
import { MiniGameAssetStore } from '../src/minigame/assets';
import { CloudAssetCache } from '../src/minigame/cloudAssetCache';

function makeSave(overrides: Partial<SaveData> = {}): SaveData {
  return normalizeSaveData({
    ...createDefaultSaveData(),
    ...overrides,
  });
}

function createMockWxEnv(initialDocs: Array<Record<string, unknown>> = []) {
  const storage = new Map<string, string>();
  const docs = initialDocs.map((d) => ({ ...d }));
  const files = new Map<string, string>();
  let nextId = 1;

  const initSpy = vi.fn();
  const addSpy = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const id = `doc_${nextId++}`;
    docs.push({ _id: id, _openid: 'mock_openid_user', ...data });
    return { _id: id };
  });
  const updateSpy = vi.fn(async (docId: string, data: Record<string, unknown>) => {
    const idx = docs.findIndex((d) => d._id === docId);
    if (idx !== -1) {
      docs[idx] = { ...docs[idx], ...data };
    }
    return { stats: { updated: idx !== -1 ? 1 : 0 } };
  });
  const removeSpy = vi.fn(async (docId: string) => {
    const idx = docs.findIndex((d) => d._id === docId);
    if (idx !== -1) docs.splice(idx, 1);
    return { stats: { removed: idx !== -1 ? 1 : 0 } };
  });
  const downloadSpy = vi.fn(async ({ fileID }: { fileID: string }) => {
    const tempPath = `/tmp/dl_${nextId++}`;
    if (fileID.endsWith('/tidy-home/manifest.json')) {
      files.set(
        tempPath,
        JSON.stringify({
          schemaVersion: 1,
          appName: 'tidy-home',
          envId: CLOUD_ENV_ID,
          storagePrefix: 'tidy-home/resources',
          assetVersion: 'v2',
          bundledRooms: ['living_room'],
          remoteRooms: ['arcade_den'],
          remoteSprites: ['retro_cartridge'],
        })
      );
    } else {
      files.set(tempPath, `binary:${fileID}`);
    }
    return { tempFilePath: tempPath, statusCode: 200 };
  });

  const fs: WxFileSystemManager = {
    accessSync(filePath: string) {
      if (!files.has(filePath)) {
        throw new Error(`ENOENT: ${filePath}`);
      }
    },
    mkdirSync(_dirPath: string, _recursive?: boolean) {
      // Virtual FS stores flat file keys
    },
    copyFileSync(srcPath: string, destPath: string) {
      const content = files.get(srcPath);
      if (content === undefined) throw new Error(`ENOENT src: ${srcPath}`);
      files.set(destPath, content);
    },
    readFileSync(filePath: string) {
      const content = files.get(filePath);
      if (content === undefined) throw new Error(`ENOENT read: ${filePath}`);
      return content;
    },
  };

  const makeQuery = (condition?: Record<string, unknown>) => {
    const q = {
      limit: () => q,
      get: async () => ({
        data: docs
          .filter((d) => {
            if (!condition) return true;
            return Object.entries(condition).every(([k, v]) => d[k] === v);
          })
          .map((d) => ({ ...d })),
      }),
    };
    return q;
  };

  const wxApi: WxMiniGameGlobal = {
    env: { USER_DATA_PATH: '/wxuser' },
    getFileSystemManager: () => fs,
    getStorageSync: (k: string) => storage.get(k) ?? '',
    setStorageSync: (k: string, v: string) => {
      storage.set(k, v);
    },
    removeStorageSync: (k: string) => {
      storage.delete(k);
    },
    cloud: {
      init: initSpy,
      database: () => ({
        collection: () => ({
          ...makeQuery(),
          where: (condition: Record<string, unknown>) => makeQuery(condition),
          add: addSpy,
          doc: (id: string) => ({
            get: async () => ({ data: docs.find((d) => d._id === id) }),
            update: ({ data }) => updateSpy(id, data),
            remove: () => removeSpy(id),
          }),
        }),
      }),
      downloadFile: downloadSpy,
    },
  };

  return { wxApi, storage, docs, files, initSpy, addSpy, updateSpy, removeSpy, downloadSpy };
}

describe('CloudBase Configuration & Save Merge', () => {
  it('builds canonical cloud:// FileIDs and cache paths without guessing bucket ids', () => {
    expect(CLOUD_ENV_ID).toBe('cloud1-d0gan532cb862dea5');
    expect(CLOUD_FILE_ID_BASE).toBe(`cloud://${CLOUD_ENV_ID}.${CLOUD_BUCKET_ID}`);
    expect(buildCloudFileId('/tidy-home/manifest.json')).toBe(
      `${CLOUD_FILE_ID_BASE}/tidy-home/manifest.json`
    );
    expect(resourceKeyToCloudFileId('resources/rooms/arcade_den.jpg')).toBe(
      `${CLOUD_FILE_ID_BASE}/tidy-home/resources/rooms/arcade_den.jpg`
    );
    expect(resourceKeyToCacheRelPath('resources/sprites/retro_cartridge.png', 'v2')).toBe(
      'tidy_home_cache/v2/sprites/retro_cartridge.png'
    );
  });

  it('detects remote-only rooms and sprites from manifest cleanly', () => {
    const manifest = parseCloudAssetManifest({
      ...DEFAULT_CLOUD_MANIFEST,
      remoteRooms: ['arcade_den'],
      remoteSprites: ['retro_cartridge'],
    });
    expect(manifest).not.toBeNull();
    expect(isRemoteOnlyResource('resources/rooms/living_room.jpg', manifest!)).toBe(false);
    expect(isRemoteOnlyResource('resources/rooms/arcade_den.jpg', manifest!)).toBe(true);
    expect(isRemoteOnlyResource('resources/sprites/retro_cartridge.png', manifest!)).toBe(true);
    expect(isRemoteOnlyResource('resources/ui/icon_star.png', manifest!)).toBe(false);
  });

  it('merges local and remote saves without regressing progress or stars', () => {
    const local = makeSave({
      userId: 'TH-111111',
      currentLevel: 4,
      highestLevel: 4,
      totalLevelsCleared: 3,
      totalStars: 7,
      coins: 220,
      levelStars: { 1: 3, 2: 2, 3: 2 },
      updatedAtMs: 2000,
    });
    const remote = makeSave({
      userId: 'TH-999999',
      currentLevel: 6,
      highestLevel: 6,
      totalLevelsCleared: 5,
      totalStars: 13,
      coins: 150,
      levelStars: { 1: 2, 2: 3, 3: 3, 4: 3, 5: 2 },
      updatedAtMs: 1000,
    });

    const merged = mergeSaveData(local, remote);
    expect(merged.highestLevel).toBe(6);
    expect(merged.totalLevelsCleared).toBe(5);
    // Level 1 keeps local 3 stars, Level 2 keeps remote 3 stars -> total 14 stars
    expect(merged.levelStars).toEqual({ 1: 3, 2: 3, 3: 3, 4: 3, 5: 2 });
    expect(merged.totalStars).toBe(14);
    // Newer timestamp wins for mutable wallet fields
    expect(merged.coins).toBe(220);
    expect(isSaveDataEquivalent(merged, remote)).toBe(false);
  });

  it('prefers real progress over a fresh default save regardless of timestamp', () => {
    const freshLocal = makeSave({ updatedAtMs: 999999 });
    const progressedRemote = makeSave({
      currentLevel: 5,
      highestLevel: 5,
      totalLevelsCleared: 4,
      totalStars: 12,
      levelStars: { 1: 3, 2: 3, 3: 3, 4: 3 },
      coins: 480,
      updatedAtMs: 1000,
    });

    const merged = mergeSaveData(freshLocal, progressedRemote);
    expect(merged.highestLevel).toBe(5);
    expect(merged.coins).toBe(480);
    expect(merged.levelStars[4]).toBe(3);
  });
});

describe('WeChatAdapter CloudBase Integration', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes wx.cloud once and creates a cloud save without manually setting _openid', async () => {
    const mock = createMockWxEnv();
    const adapter = new WeChatAdapter({
      rewardedVideoAdUnitId: 'adunit-test',
      wxApi: mock.wxApi,
    });

    expect(adapter.isCloudReady()).toBe(true);
    expect(mock.initSpy).toHaveBeenCalledTimes(1);
    expect(mock.initSpy).toHaveBeenCalledWith({
      env: CLOUD_ENV_ID,
      traceUser: true,
    });

    const local = makeSave({ highestLevel: 3, currentLevel: 3, totalLevelsCleared: 2, coins: 310 });
    const synced = await adapter.syncCloudSave(local);
    expect(synced?.highestLevel).toBe(3);
    expect(mock.addSpy).toHaveBeenCalledTimes(1);

    const addedPayload = mock.addSpy.mock.calls[0][0].data;
    expect(addedPayload).not.toHaveProperty('_openid');
    expect(addedPayload).not.toHaveProperty('_id');
    expect(addedPayload.highestLevel).toBe(3);
  });

  it('merges existing cloud doc, debounces saveProgress, flushes immediately, and removes on clearSave', async () => {
    vi.useFakeTimers();
    const remoteDoc = {
      _id: 'existing_save_1',
      _openid: 'openid_abc',
      schemaVersion: 1,
      ...makeSave({
        highestLevel: 5,
        currentLevel: 5,
        totalLevelsCleared: 4,
        totalStars: 11,
        levelStars: { 1: 3, 2: 3, 3: 2, 4: 3 },
        coins: 500,
        updatedAtMs: 500,
      }),
    };
    const duplicateDoc = {
      _id: 'dup_save_2',
      _openid: 'openid_abc',
      schemaVersion: 1,
      ...makeSave({
        highestLevel: 2,
        currentLevel: 2,
        totalLevelsCleared: 1,
        totalStars: 3,
        levelStars: { 1: 3 },
        coins: 120,
        updatedAtMs: 200,
      }),
    };
    const mock = createMockWxEnv([remoteDoc, duplicateDoc]);
    const adapter = new WeChatAdapter({
      rewardedVideoAdUnitId: 'adunit-test',
      wxApi: mock.wxApi,
    });

    const local = makeSave({
      highestLevel: 3,
      currentLevel: 3,
      totalLevelsCleared: 2,
      totalStars: 6,
      levelStars: { 1: 3, 3: 3 },
      coins: 650,
      updatedAtMs: 2000,
    });

    const merged = await adapter.syncCloudSave(local);
    expect(merged?.highestLevel).toBe(5);
    expect(merged?.levelStars[3]).toBe(3);
    expect(merged?.coins).toBe(650);
    expect(mock.updateSpy).toHaveBeenCalledTimes(1);
    expect(mock.docs.length).toBe(1);
    expect(mock.removeSpy).toHaveBeenCalledWith('dup_save_2');

    // Multiple rapid saveProgress calls should debounce into a single cloud write
    adapter.saveProgress({ ...merged!, coins: 660 });
    adapter.saveProgress({ ...merged!, coins: 675 });
    expect(mock.updateSpy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1300);
    expect(mock.updateSpy).toHaveBeenCalledTimes(2);
    expect(mock.docs[0].coins).toBe(675);

    // flushCloudSave pushes immediately without waiting for debounce
    const flushed = await adapter.flushCloudSave({ ...merged!, coins: 720, highestLevel: 6 });
    expect(flushed).toBe(true);
    expect(mock.docs[0].coins).toBe(720);
    expect(mock.docs[0].highestLevel).toBe(6);

    // clearSave removes local and cloud documents
    adapter.clearSave();
    await Promise.resolve();
    await Promise.resolve();
    expect(mock.removeSpy).toHaveBeenCalledWith('existing_save_1');
    expect(mock.docs.length).toBe(0);
  });
});

describe('CloudAssetCache & MiniGameAssetStore Lazy Loading', () => {
  it('caches downloaded Cloud Storage files into USER_DATA_PATH and deduplicates parallel fetches', async () => {
    const mock = createMockWxEnv();
    const cache = new CloudAssetCache(mock.wxApi);

    const [p1, p2] = await Promise.all([
      cache.resolveToLocalPath('resources/rooms/arcade_den.jpg'),
      cache.resolveToLocalPath('resources/rooms/arcade_den.jpg'),
    ]);

    expect(p1).toBe('/wxuser/tidy_home_cache/v1/rooms/arcade_den.jpg');
    expect(p2).toBe(p1);
    expect(mock.downloadSpy).toHaveBeenCalledTimes(1);

    // Second lookup hits persistent disk cache with zero cloud traffic
    const p3 = await cache.resolveToLocalPath('resources/rooms/arcade_den.jpg');
    expect(p3).toBe(p1);
    expect(mock.downloadSpy).toHaveBeenCalledTimes(1);

    // Syncing remote manifest refreshes assetVersion and remote-only lists
    const updatedManifest = await cache.syncRemoteManifest();
    expect(updatedManifest?.assetVersion).toBe('v2');
    expect(cache.isRemoteOnly('resources/rooms/arcade_den.jpg')).toBe(true);
  });

  it('preloads only active level room + sprites, falls back to cloud on local load error, and prunes shaded cache', async () => {
    const mock = createMockWxEnv();
    const createdImages: Array<{ src: string; width: number; height: number; onload?: () => void; onerror?: () => void }> = [];

    const mockRuntimeApi = {
      ...mock.wxApi,
      createImage() {
        const img: { src: string; width: number; height: number; onload?: () => void; onerror?: () => void } = {
          src: '',
          width: 0,
          height: 0,
        };
        createdImages.push(img);
        return img;
      },
      createCanvas() {
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            clearRect: vi.fn(),
            drawImage: vi.fn(),
            getImageData: () => ({ data: new Uint8ClampedArray(16) }),
            putImageData: vi.fn(),
          }),
        };
      },
    };

    const store = new MiniGameAssetStore(mockRuntimeApi);
    const lv1 = generateLevel(1);
    store.preloadForLevel(lv1);

    // Should load far fewer images than the entire 141+ sprite catalog
    expect(createdImages.length).toBeLessThan(30);
    const bgImg = createdImages.find((img) => img.src === 'resources/rooms/living_room.jpg');
    expect(bgImg).toBeDefined();

    // Simulate local missing file -> transparent CloudBase Storage fallback
    const firstSpriteImg = createdImages.find((img) => img.src.startsWith('resources/sprites/'))!;
    const expectedSpriteKey = firstSpriteImg.src;
    firstSpriteImg.onerror?.();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mock.downloadSpy).toHaveBeenCalledWith({
      fileID: resourceKeyToCloudFileId(expectedSpriteKey),
    });
    const fallbackImg = createdImages.find((img) => img.src.startsWith('/wxuser/tidy_home_cache/v1/sprites/'));
    expect(fallbackImg).toBeDefined();
    fallbackImg!.width = 128;
    fallbackImg!.height = 128;
    fallbackImg!.onload?.();
    expect(store.getLoadVersion()).toBeGreaterThan(0);

    // Prune shaded cache drops entries not in next level
    const keepEmpty = new Set<string>();
    const drawable = store.getItemDrawable(expectedSpriteKey, 1, null, 0.25, 0.85);
    expect(drawable).toBeTruthy();
    expect(store.pruneShadedCache(keepEmpty)).toBe(1);
  });

  it('enforces Plan-A anti-abuse guardrails: whitelist, backoff circuit-breaker, and burst rate limit', async () => {
    // 1. Whitelist rejects traversal, query strings, URLs, and arbitrary folders
    expect(isAllowedCloudResourceKey('resources/rooms/arcade_den.jpg')).toBe(true);
    expect(isAllowedCloudResourceKey('resources/sprites/retro_cartridge.png')).toBe(true);
    expect(isAllowedCloudResourceKey('resources/rooms/../../etc/passwd')).toBe(false);
    expect(isAllowedCloudResourceKey('resources/configs/secret.json')).toBe(false);
    expect(isAllowedCloudResourceKey('resources/sprites/foo.png?sig=1')).toBe(false);
    expect(isAllowedCloudResourceKey('https://evil.example/foo.png')).toBe(false);

    // 2. Failing remote asset backs off and circuit-breaks instead of 60fps self-DDoS
    let nowMs = 10_000;
    const mock = createMockWxEnv();
    mock.downloadSpy.mockRejectedValue(new Error('403 forbidden'));

    const cache = new CloudAssetCache(mock.wxApi, {
      maxRetries: 1,
      baseBackoffMs: 5_000,
      windowMs: 60_000,
      maxDownloadsPerWindow: 3,
      nowFn: () => nowMs,
    });

    // Disallowed key never triggers wx.cloud.downloadFile
    expect(await cache.resolveToLocalPath('resources/rooms/../secret.jpg')).toBeNull();
    expect(mock.downloadSpy).toHaveBeenCalledTimes(0);

    // First attempt fails -> enters 5s backoff
    expect(await cache.resolveToLocalPath('resources/sprites/missing_item.png')).toBeNull();
    expect(mock.downloadSpy).toHaveBeenCalledTimes(1);

    // Simulated 60fps render calls during cooldown make ZERO extra downloads
    for (let frame = 0; frame < 60; frame++) {
      nowMs += 16;
      expect(await cache.resolveToLocalPath('resources/sprites/missing_item.png')).toBeNull();
    }
    expect(mock.downloadSpy).toHaveBeenCalledTimes(1);

    // After 5s cooldown -> 1 retry allowed, fails again -> circuit opens for session
    nowMs += 6_000;
    expect(await cache.resolveToLocalPath('resources/sprites/missing_item.png')).toBeNull();
    expect(mock.downloadSpy).toHaveBeenCalledTimes(2);

    // Even hours later, circuit remains open for that missing key
    nowMs += 3_600_000;
    expect(await cache.resolveToLocalPath('resources/sprites/missing_item.png')).toBeNull();
    expect(mock.downloadSpy).toHaveBeenCalledTimes(2);

    // 3. Rolling-window burst limiter caps rapid distinct downloads
    mock.downloadSpy.mockClear();
    mock.downloadSpy.mockImplementation(async ({ fileID }: { fileID: string }) => {
      const tempPath = `/tmp/ok_${fileID}`;
      mock.files.set(tempPath, 'ok');
      return { tempFilePath: tempPath, statusCode: 200 };
    });

    expect(await cache.resolveToLocalPath('resources/sprites/item_a.png')).not.toBeNull();
    expect(await cache.resolveToLocalPath('resources/sprites/item_b.png')).not.toBeNull();
    expect(await cache.resolveToLocalPath('resources/sprites/item_c.png')).not.toBeNull();
    // 4th distinct download inside same 60s window is deferred by rate limiter
    expect(await cache.resolveToLocalPath('resources/sprites/item_d.png')).toBeNull();
    expect(mock.downloadSpy).toHaveBeenCalledTimes(3);

    // Once window advances past 60s, downloads resume cleanly
    nowMs += 61_000;
    expect(await cache.resolveToLocalPath('resources/sprites/item_d.png')).not.toBeNull();
    expect(mock.downloadSpy).toHaveBeenCalledTimes(4);
  });
});

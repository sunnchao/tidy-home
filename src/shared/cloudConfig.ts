/**
 * Canonical WeChat CloudBase configuration for Tidy Home (我来收纳).
 * Non-secret identifiers verified via WeChat DevTools MCP against wx3b65c276a0198972.
 */
export const CLOUD_ENV_ID = 'cloud1-d0gan532cb862dea5';
export const CLOUD_BUCKET_ID = '636c-cloud1-d0gan532cb862dea5-1253786277';
export const CLOUD_FILE_ID_BASE = `cloud://${CLOUD_ENV_ID}.${CLOUD_BUCKET_ID}`;
export const CLOUD_STORAGE_ROOT = 'tidy-home';
export const CLOUD_MANIFEST_PATH = `${CLOUD_STORAGE_ROOT}/manifest.json`;
export const CLOUD_RESOURCE_PREFIX = `${CLOUD_STORAGE_ROOT}/resources`;
export const CLOUD_DEFAULT_ASSET_VERSION = 'v1';
export const CLOUD_SAVE_COLLECTION = 'player_saves';

/** Client-side anti-abuse guardrails for CloudBase Storage downloads (Plan A). */
export const CLOUD_DOWNLOAD_MAX_RETRIES = 2;
export const CLOUD_DOWNLOAD_BASE_BACKOFF_MS = 5_000;
export const CLOUD_DOWNLOAD_WINDOW_MS = 60_000;
export const CLOUD_DOWNLOAD_MAX_PER_WINDOW = 48;

const ALLOWED_RESOURCE_PATTERNS: ReadonlyArray<RegExp> = [
  /^rooms\/[a-zA-Z0-9_-]+\.(jpg|jpeg|webp|png)$/,
  /^sprites\/[a-zA-Z0-9_-]+\.(png|webp)$/,
  /^ui\/[a-zA-Z0-9_-]+\.(png|webp)$/,
  /^audio\/[a-zA-Z0-9_-]+\.(wav|mp3|ogg)$/,
];

export interface CloudAssetManifest {
  schemaVersion: number;
  appName: string;
  envId: string;
  storagePrefix: string;
  assetVersion: string;
  bundledRooms: string[];
  remoteRooms: string[];
  remoteSprites: string[];
}

export const DEFAULT_CLOUD_MANIFEST: CloudAssetManifest = {
  schemaVersion: 1,
  appName: 'tidy-home',
  envId: CLOUD_ENV_ID,
  storagePrefix: CLOUD_RESOURCE_PREFIX,
  assetVersion: CLOUD_DEFAULT_ASSET_VERSION,
  bundledRooms: ['living_room', 'bathroom', 'study', 'cafe', 'kitchen', 'bedroom'],
  remoteRooms: [],
  remoteSprites: [],
};

function stripLeadingSlashes(input: string): string {
  return input.replace(/^\/+/, '');
}

/**
 * Strips a leading `resources/` prefix from a MiniGame resource key so both
 * `resources/rooms/living_room.jpg` and `rooms/living_room.jpg` normalize cleanly.
 */
export function normalizeResourceRelPath(resourceKey: string): string {
  const clean = stripLeadingSlashes(resourceKey.trim());
  if (clean.startsWith('resources/')) {
    return clean.slice('resources/'.length);
  }
  return clean;
}

/**
 * Strict client-side whitelist guard preventing path traversal, query injection,
 * or arbitrary Cloud Storage file probing.
 */
export function isAllowedCloudResourceKey(resourceKey: string): boolean {
  if (!resourceKey || typeof resourceKey !== 'string') return false;
  if (
    resourceKey.includes('..') ||
    resourceKey.includes('\\') ||
    resourceKey.includes('?') ||
    resourceKey.includes('#') ||
    resourceKey.includes('://')
  ) {
    return false;
  }
  const rel = normalizeResourceRelPath(resourceKey);
  return ALLOWED_RESOURCE_PATTERNS.some((pattern) => pattern.test(rel));
}

/**
 * Builds a canonical WeChat CloudBase `cloud://` FileID for any storage path.
 */
export function buildCloudFileId(cloudPath: string, fileIdBase = CLOUD_FILE_ID_BASE): string {
  const cleanBase = fileIdBase.replace(/\/+$/, '');
  const cleanPath = stripLeadingSlashes(cloudPath.trim());
  return `${cleanBase}/${cleanPath}`;
}

/**
 * Maps a MiniGame runtime resource key (e.g. `resources/rooms/arcade_den.jpg`)
 * to its CloudBase Storage FileID.
 */
export function resourceKeyToCloudFileId(
  resourceKey: string,
  storagePrefix = CLOUD_RESOURCE_PREFIX,
  fileIdBase = CLOUD_FILE_ID_BASE
): string {
  const rel = normalizeResourceRelPath(resourceKey);
  const cleanPrefix = stripLeadingSlashes(storagePrefix).replace(/\/+$/, '');
  return buildCloudFileId(`${cleanPrefix}/${rel}`, fileIdBase);
}

/**
 * Maps a MiniGame runtime resource key to its relative path inside `wx.env.USER_DATA_PATH`.
 */
export function resourceKeyToCacheRelPath(
  resourceKey: string,
  assetVersion = CLOUD_DEFAULT_ASSET_VERSION
): string {
  const rel = normalizeResourceRelPath(resourceKey);
  const safeVer = assetVersion.replace(/[^a-zA-Z0-9._-]/g, '_') || CLOUD_DEFAULT_ASSET_VERSION;
  return `tidy_home_cache/${safeVer}/${rel}`;
}

/**
 * Determines whether a resource key is configured as remote-only (not bundled in the 4MB main package).
 */
export function isRemoteOnlyResource(
  resourceKey: string,
  manifest: Pick<CloudAssetManifest, 'remoteRooms' | 'remoteSprites'>
): boolean {
  const rel = normalizeResourceRelPath(resourceKey);
  if (rel.startsWith('rooms/')) {
    const file = rel.slice('rooms/'.length);
    const roomId = file.replace(/\.(jpg|jpeg|png|webp)$/i, '');
    return manifest.remoteRooms.includes(roomId) || manifest.remoteRooms.includes(file);
  }
  if (rel.startsWith('sprites/')) {
    const file = rel.slice('sprites/'.length);
    const spriteId = file.replace(/\.(png|webp|jpg|jpeg)$/i, '');
    return manifest.remoteSprites.includes(spriteId) || manifest.remoteSprites.includes(file);
  }
  return false;
}

/**
 * Safely parses a JSON manifest payload downloaded from CloudBase Storage.
 */
export function parseCloudAssetManifest(raw: unknown): CloudAssetManifest | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const asStringArray = (value: unknown, fallback: string[]): string[] => {
    if (!Array.isArray(value)) return [...fallback];
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  };

  return {
    schemaVersion:
      typeof obj.schemaVersion === 'number' && Number.isFinite(obj.schemaVersion)
        ? obj.schemaVersion
        : DEFAULT_CLOUD_MANIFEST.schemaVersion,
    appName:
      typeof obj.appName === 'string' && obj.appName.trim().length > 0
        ? obj.appName.trim()
        : DEFAULT_CLOUD_MANIFEST.appName,
    envId:
      typeof obj.envId === 'string' && obj.envId.trim().length > 0
        ? obj.envId.trim()
        : CLOUD_ENV_ID,
    storagePrefix:
      typeof obj.storagePrefix === 'string' && obj.storagePrefix.trim().length > 0
        ? obj.storagePrefix.trim()
        : CLOUD_RESOURCE_PREFIX,
    assetVersion:
      typeof obj.assetVersion === 'string' && obj.assetVersion.trim().length > 0
        ? obj.assetVersion.trim()
        : CLOUD_DEFAULT_ASSET_VERSION,
    bundledRooms: asStringArray(obj.bundledRooms, DEFAULT_CLOUD_MANIFEST.bundledRooms),
    remoteRooms: asStringArray(obj.remoteRooms, DEFAULT_CLOUD_MANIFEST.remoteRooms),
    remoteSprites: asStringArray(obj.remoteSprites, DEFAULT_CLOUD_MANIFEST.remoteSprites),
  };
}

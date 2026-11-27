/**
 * Strict, minimal TypeScript contracts for WeChat MiniGame CloudBase & FileSystem APIs.
 * Avoids `any` so CloudBase integration stays type-checked under `strict: true`.
 */

export interface WxCloudInitOptions {
  env: string;
  traceUser?: boolean;
}

export interface WxCloudDbAddResult {
  _id: string;
}

export interface WxCloudDbUpdateResult {
  stats?: {
    updated?: number;
  };
}

export interface WxCloudDbRemoveResult {
  stats?: {
    removed?: number;
  };
}

export interface WxCloudDbGetResult<T> {
  data: T[];
}

export interface WxCloudDocRef {
  get(): Promise<{ data?: Record<string, unknown> }>;
  update(options: { data: Record<string, unknown> }): Promise<WxCloudDbUpdateResult>;
  set?(options: { data: Record<string, unknown> }): Promise<WxCloudDbUpdateResult>;
  remove(): Promise<WxCloudDbRemoveResult>;
}

export interface WxCloudQuery {
  limit(n: number): WxCloudQuery;
  get(): Promise<WxCloudDbGetResult<Record<string, unknown>>>;
}

export interface WxCloudCollection extends WxCloudQuery {
  add(options: { data: Record<string, unknown> }): Promise<WxCloudDbAddResult>;
  doc(id: string): WxCloudDocRef;
  where(condition: Record<string, unknown>): WxCloudQuery;
}

export interface WxCloudDatabase {
  collection(name: string): WxCloudCollection;
  command?: {
    set?: (value: unknown) => unknown;
  };
}

export interface WxCloudDownloadFileResult {
  tempFilePath: string;
  statusCode?: number;
}

export interface WxCloudApi {
  init(options: WxCloudInitOptions): void;
  database(options?: { env?: string }): WxCloudDatabase;
  downloadFile(options: { fileID: string }): Promise<WxCloudDownloadFileResult>;
  callFunction?(options: { name: string; data?: Record<string, unknown> }): Promise<{ result?: unknown }>;
}

export interface WxFileSystemManager {
  accessSync(path: string): void;
  mkdirSync(dirPath: string, recursive?: boolean): void;
  copyFileSync?(srcPath: string, destPath: string): void;
  saveFileSync?(tempFilePath: string, filePath?: string): string;
  readFileSync(filePath: string, encoding: 'utf8'): string;
  unlinkSync?(filePath: string): void;
}

export interface WxMiniGameEnv {
  USER_DATA_PATH?: string;
}

export interface WxRewardedVideoAd {
  show(): Promise<void>;
  load(): Promise<void>;
  onClose(cb: (res?: { isEnded?: boolean }) => void): void;
  offClose?(cb: (res?: { isEnded?: boolean }) => void): void;
  onError(cb: (err?: unknown) => void): void;
  offError?(cb: (err?: unknown) => void): void;
}

export interface WxInterstitialAd {
  show(): Promise<void>;
}

export interface WxMiniGameGlobal {
  cloud?: WxCloudApi;
  env?: WxMiniGameEnv;
  getFileSystemManager?: () => WxFileSystemManager;
  getStorageSync?: (key: string) => unknown;
  setStorageSync?: (key: string, value: string) => void;
  removeStorageSync?: (key: string) => void;
  showShareMenu?: (opts: { withShareTicket?: boolean; menus?: string[] }) => void;
  onShareAppMessage?: (cb: () => { title: string }) => void;
  shareAppMessage?: (opts: { title: string; query?: string; imageUrl?: string }) => void;
  onHide?: (cb: () => void) => void;
  offHide?: (cb: () => void) => void;
  onShow?: (cb: () => void) => void;
  offShow?: (cb: () => void) => void;
  vibrateShort?: (opts: { type: 'light' | 'medium' | 'heavy' }) => void;
  createRewardedVideoAd?: (opts: { adUnitId: string }) => WxRewardedVideoAd;
  createInterstitialAd?: (opts: { adUnitId: string }) => WxInterstitialAd;
}

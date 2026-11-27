const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const windowInfo = () => ({
  windowWidth: window.innerWidth,
  windowHeight: window.innerHeight,
  pixelRatio: window.devicePixelRatio,
  statusBarHeight: 0,
  safeArea: { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth },
});
(globalThis as any).wx = {
  createCanvas: () => canvas,
  createImage: () => new Image(),
  getWindowInfo: windowInfo,
  getSystemInfoSync: windowInfo,
  getMenuButtonBoundingClientRect: () => ({ bottom: 0 }),
  getStorageSync: (key: string) => window.localStorage.getItem(key) ?? '',
  setStorageSync: (key: string, value: string) => window.localStorage.setItem(key, value),
  removeStorageSync: (key: string) => window.localStorage.removeItem(key),
  vibrateShort: () => undefined,
  showShareMenu: () => undefined,
  onShareAppMessage: () => undefined,
  createInnerAudioContext: () => ({ src: '', play: () => undefined, stop: () => undefined, destroy: () => undefined }),
  onWindowResize: () => undefined,
};
void import('../src/minigame/main');

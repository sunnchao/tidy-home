import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.resolve(ROOT, 'minigame');
const RESOURCES_SRC = path.resolve(ROOT, 'assets/resources');
const DEFAULT_APPID = 'wx3b65c276a0198972';

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// Vite empties OUT_DIR, so capture locally configured DevTools settings first.
const existingProjectConfig = readJson(path.join(OUT_DIR, 'project.config.json'));
const existingPrivateConfig = readJson(path.join(OUT_DIR, 'project.private.config.json'));

await build({
  configFile: false,
  root: ROOT,
  resolve: {
    alias: {
      '@core': path.resolve(ROOT, 'src/core'),
      '@platform': path.resolve(ROOT, 'src/platform'),
      '@shared': path.resolve(ROOT, 'src/shared'),
    },
  },
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    minify: 'esbuild',
    lib: {
      entry: path.resolve(ROOT, 'src/minigame/main.ts'),
      name: 'TidyHomeMiniGame',
      formats: ['iife'],
      fileName: () => 'game.js',
    },
  },
});

const gameJson = {
  deviceOrientation: 'portrait',
  showStatusBar: false,
  networkTimeout: {
    request: 5000,
  },
};

const appid =
  (process.env.WX_MINIGAME_APPID || '').trim() || existingProjectConfig?.appid || DEFAULT_APPID;

const projectConfig = {
  ...existingProjectConfig,
  description: existingProjectConfig?.description || '我来收纳 (Tidy Home) 微信原生小游戏工程',
  packOptions: {
    ...(existingProjectConfig?.packOptions || {}),
    ignore: existingProjectConfig?.packOptions?.ignore || [],
  },
  setting: {
    urlCheck: false,
    es6: true,
    enhance: true,
    postcss: true,
    minified: true,
    ...(existingProjectConfig?.setting || {}),
  },
  compileType: 'game',
  libVersion: existingProjectConfig?.libVersion || 'latest',
  appid,
  projectname: existingProjectConfig?.projectname || '我来收纳',
};

fs.writeFileSync(path.join(OUT_DIR, 'game.json'), JSON.stringify(gameJson, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'project.config.json'), JSON.stringify(projectConfig, null, 2));
if (existingPrivateConfig) {
  fs.writeFileSync(
    path.join(OUT_DIR, 'project.private.config.json'),
    JSON.stringify(existingPrivateConfig, null, 2)
  );
}
// Room PNGs are editing sources; the runtime uses the much smaller JPGs.
// Remote-only rooms & sprites declared in cloud-manifest.json stay in CloudBase Storage (out of the 4MB main package).
const cloudManifest = readJson(path.join(RESOURCES_SRC, 'configs/cloud-manifest.json')) || {};
const remoteRooms = new Set(Array.isArray(cloudManifest.remoteRooms) ? cloudManifest.remoteRooms : []);
const remoteSprites = new Set(Array.isArray(cloudManifest.remoteSprites) ? cloudManifest.remoteSprites : []);
const roomSourceDir = `${path.join(RESOURCES_SRC, 'rooms')}${path.sep}`;
const spriteSourceDir = `${path.join(RESOURCES_SRC, 'sprites')}${path.sep}`;

fs.cpSync(RESOURCES_SRC, path.join(OUT_DIR, 'resources'), {
  recursive: true,
  filter: (src) => {
    if (src.endsWith('.meta')) return false;
    if (src.startsWith(roomSourceDir)) {
      if (src.endsWith('.png')) return false;
      const base = path.basename(src);
      const id = base.replace(/\.(jpg|jpeg|webp)$/i, '');
      if (remoteRooms.has(base) || remoteRooms.has(id)) return false;
    }
    if (src.startsWith(spriteSourceDir)) {
      const base = path.basename(src);
      const id = base.replace(/\.(png|webp|jpg|jpeg)$/i, '');
      if (remoteSprites.has(base) || remoteSprites.has(id)) return false;
    }
    return true;
  },
});

if (cloudManifest.envId) {
  console.log(
    `[build:minigame] CloudBase env: ${cloudManifest.envId} ` +
      `(remoteRooms=${remoteRooms.size}, remoteSprites=${remoteSprites.size})`
  );
}

function calcDirSize(dir) {
  let total = 0;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    total += ent.isDirectory() ? calcDirSize(p) : fs.statSync(p).size;
  }
  return total;
}

const totalBytes = calcDirSize(OUT_DIR);
console.log(`Built WeChat MiniGame bundle in ${OUT_DIR} (${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
if (totalBytes > 4 * 1024 * 1024) {
  console.warn(
    `\n[build:minigame] WARNING: package is ${(totalBytes / 1024 / 1024).toFixed(2)} MB, ` +
      'above the 4 MB WeChat main-package limit.'
  );
}

if (appid === 'touristappid') {
  console.warn(
    '\n[build:minigame] WARNING: appid is still "touristappid".\n' +
      'Recent WeChat DevTools versions reject this AppID and open a lite window whose\n' +
      'simulator does not forward mouse/touch input to mini games. Log in to DevTools,\n' +
      'import this project as a 小游戏 and use 测试号, or set WX_MINIGAME_APPID.\n' +
      'The configured AppID is preserved across subsequent builds.'
  );
} else {
  console.log(`[build:minigame] Preserving appid: ${appid}`);
}

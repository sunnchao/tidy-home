import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.resolve(ROOT, 'minigame');
const RESOURCES_SRC = path.resolve(ROOT, 'assets/resources');

await build({
  configFile: false,
  root: ROOT,
  resolve: {
    alias: {
      '@core': path.resolve(ROOT, 'src/core'),
      '@platform': path.resolve(ROOT, 'src/platform'),
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

const projectConfig = {
  description: '收纳小当家 (Tidy Home) 微信原生小游戏工程',
  packOptions: {
    ignore: [],
  },
  setting: {
    urlCheck: false,
    es6: true,
    enhance: true,
    postcss: true,
    minified: true,
  },
  compileType: 'game',
  libVersion: 'latest',
  appid: 'touristappid',
  projectname: 'tidy-home',
};

fs.writeFileSync(path.join(OUT_DIR, 'game.json'), JSON.stringify(gameJson, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'project.config.json'), JSON.stringify(projectConfig, null, 2));
fs.cpSync(RESOURCES_SRC, path.join(OUT_DIR, 'resources'), { recursive: true });

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

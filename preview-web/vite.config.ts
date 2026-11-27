import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const RESOURCES_DIR = path.resolve(PROJECT_ROOT, 'assets/resources');

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.wav': 'audio/wav',
  '.json': 'application/json',
};

function sharedResourcesPlugin(): Plugin {
  return {
    name: 'tidy-home-shared-resources',
    configureServer(server) {
      server.middlewares.use('/resources', (req, res, next) => {
        const cleanUrl = (req.url || '/').split('?')[0];
        const abs = path.resolve(RESOURCES_DIR, `.${cleanUrl}`);
        if (!abs.startsWith(RESOURCES_DIR) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
          next();
          return;
        }
        const ext = path.extname(abs).toLowerCase();
        res.setHeader('Content-Type', MIME_BY_EXT[ext] || 'application/octet-stream');
        fs.createReadStream(abs).pipe(res);
      });
    },
    closeBundle() {
      const outResources = path.resolve(__dirname, 'dist/resources');
      if (fs.existsSync(RESOURCES_DIR)) {
        fs.cpSync(RESOURCES_DIR, outResources, { recursive: true, filter: (src) => !src.endsWith('.meta') });
      }
    },
  };
}

export default defineConfig({
  root: __dirname,
  plugins: [sharedResourcesPlugin()],
  resolve: {
    alias: {
      '@core': path.resolve(PROJECT_ROOT, 'src/core'),
      '@platform': path.resolve(PROJECT_ROOT, 'src/platform'),
      '@shared': path.resolve(PROJECT_ROOT, 'src/shared'),
    },
  },
  server: {
    fs: {
      allow: [PROJECT_ROOT],
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
});

import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
      '@platform': path.resolve(__dirname, 'src/platform'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});

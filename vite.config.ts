import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Every mini-game is its own HTML page under games/. Add new ones to `input`.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 6000,
    rollupOptions: {
      input: {
        home: resolve(__dirname, 'index.html'),
        sailing: resolve(__dirname, 'games/sailing/index.html'),
        workshop: resolve(__dirname, 'tools/workshop/index.html'),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});

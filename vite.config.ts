import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/** The version shown in the game's settings: the commit and the day it was built. */
function buildLabel(): string {
  let sha = process.env.GITHUB_SHA ?? '';
  try {
    sha ||= execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    // not a git checkout
  }
  return `${sha.slice(0, 7) || 'dev'} · ${new Date().toISOString().slice(0, 10)}`;
}

// Every mini-game is its own HTML page under games/. Add new ones to `input`.
export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(buildLabel()) },
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

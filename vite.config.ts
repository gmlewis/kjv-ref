import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
  },
  css: {
    postcss: './postcss.config.js',
  },
  base: './',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    exclude: [
      'node_modules/**',
      'e2e/**',   // Playwright specs — run via `bun run e2e`, not vitest
      'dist/**',
    ],
  },
});

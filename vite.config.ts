import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
    // Fail loudly instead of silently moving to 3001 when 3000 is taken. A
    // stray dev server from an earlier session holding 3000 used to push this
    // one aside, and since `run.sh` hardcodes http://localhost:3000 and opens
    // Chrome there, you could end up looking at a different project's server —
    // or at a months-old build of this one (its dep-optimizer URLs no longer
    // match node_modules/.vite, which shows up as 504 "Outdated Optimize Dep").
    strictPort: true,
  },
  css: {
    postcss: './postcss.config.js',
  },
  base: '/kjv-ref/',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    exclude: [
      'node_modules/**',
      'e2e/**',
      'dist/**',
    ],
  },
});

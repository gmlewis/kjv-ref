import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'fs';

const STATE_FILE = 'e2e/.auth/state.json';
const stateExists = existsSync(STATE_FILE);

if (!stateExists) {
  console.warn(`
╔══════════════════════════════════════════════════════════════╗
║  Auth state not found — run setup first:                     ║
║                                                              ║
║    bun run e2e:setup                                         ║
║                                                              ║
║  A browser will open for you to sign in with Google.         ║
║  Session is saved for 7 days, then you re-run setup once.    ║
╚══════════════════════════════════════════════════════════════╝
`);
}

/**
 * ─── How to run ───────────────────────────────────────────────────
 *
 *  First time (one-time Google sign-in):
 *    bun run e2e:setup
 *
 *  All tests, headless (default):
 *    bun run e2e
 *
 *  All tests, headed (watch the browser):
 *    bun run e2e:headed
 *
 *  Interactive UI (pick / replay individual tests):
 *    bun run e2e:ui
 *
 *  Single spec file:
 *    bunx playwright test e2e/practice.spec.ts --headed
 *
 *  Single test by name grep:
 *    bunx playwright test --grep "Word Bank" --headed
 *
 *  View last HTML report:
 *    bun run e2e:report
 */
export default defineConfig({
  testDir: './e2e',

  /* Run tests sequentially — 1 browser against the live site */
  workers: 1,
  fullyParallel: false,

  /* Retry once on flakiness (network latency, live site warmup) */
  retries: 1,

  timeout: 60_000,

  use: {
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    baseURL: 'https://preview.prophet.do',
    /* Reuse saved Google OAuth session */
    storageState: stateExists ? STATE_FILE : undefined,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/report', open: 'never' }],
  ],
});

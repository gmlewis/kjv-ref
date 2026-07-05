import { defineConfig, devices } from '@playwright/test';

/**
 * ─── How to run ───────────────────────────────────────────────────
 *
 *  All tests, headless (default):
 *    bun run e2e
 *
 *  All tests, headed (watch the browser):
 *    bun run e2e:headed
 *
 *  Interactive UI (pick / replay tests):
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
 *
 * The config auto-starts `vite preview` (serving ./dist) and targets the
 * /kjv-ref/ subpath to match the production GitHub Pages URL. There is no
 * authentication step — the static site is fully public.
 */
export default defineConfig({
  testDir: './e2e',

  /* Run tests sequentially against the local preview server */
  workers: 1,
  fullyParallel: false,

  /* Retry once on flakiness */
  retries: 1,

  timeout: 60_000,

  /* Auto-build and serve the production bundle for e2e */
  webServer: {
    command: 'bun run build && bun run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/kjv-ref/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },

  use: {
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    baseURL: 'http://localhost:4173',
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

/**
 * One-time auth setup for Google OAuth.
 *
 * Because Google OAuth cannot be automated (CAPTCHA, bot detection), this
 * script opens a REAL headed Chromium browser and waits for YOU to click
 * "Continue with Google" and complete the login. It then saves the session
 * cookies so all subsequent headless test runs reuse them automatically.
 *
 * Run once (or whenever the session expires):
 *
 *   bun run e2e:setup
 *
 * The session is saved to e2e/.auth/state.json (gitignored) and is reused
 * for up to 7 days before you need to re-run setup.
 */
import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const STATE_FILE = path.join(import.meta.dirname, '.auth/state.json');
const SESSION_MAX_AGE_DAYS = 7;

async function main() {
  // Skip if session is still fresh
  if (fs.existsSync(STATE_FILE)) {
    const stats = fs.statSync(STATE_FILE);
    const ageDays = (Date.now() - stats.mtimeMs) / 86_400_000;
    if (ageDays < SESSION_MAX_AGE_DAYS) {
      console.log(`\n✓ Auth session is fresh (${ageDays.toFixed(1)} days old). No need to log in again.`);
      console.log('  To force re-login: delete e2e/.auth/state.json and re-run.\n');
      return;
    }
    console.log(`\n⚠ Auth session is ${ageDays.toFixed(1)} days old — refreshing.\n`);
  }

  console.log('\n─────────────────────────────────────────────────────────');
  console.log('  KJV Memorize — one-time auth setup');
  console.log('─────────────────────────────────────────────────────────');
  console.log('  A browser window will open.');
  console.log('  → Click "Continue with Google" and complete sign-in.');
  console.log('  → The window will close automatically when done.');
  console.log('─────────────────────────────────────────────────────────\n');

  // Always launch headed so the user can interact with Google OAuth
  const browser = await chromium.launch({
    headless: false,
    channel: 'chromium',
    args: ['--window-size=900,700'],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://preview.prophet.do/exp/kjv-memorize');

  console.log('  Waiting for you to sign in… (up to 3 minutes)');

  // Wait for the redirect back to preview.prophet.do AFTER sign-in completes.
  // The auth flow redirects from authkit.app → prophet-platform...workers.dev → preview.prophet.do
  await page.waitForURL(
    (url) => url.hostname === 'preview.prophet.do' && !url.pathname.includes('auth'),
    { timeout: 180_000 }
  );

  // Give the app a moment to finish initialising (sets cookies etc.)
  await page.waitForTimeout(2_000);

  // Save session state
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  await context.storageState({ path: STATE_FILE });
  await browser.close();

  console.log('\n✓ Signed in successfully!');
  console.log(`  Session saved to ${STATE_FILE}`);
  console.log('  You can now run: bun run e2e  (headless)');
  console.log('              or: bun run e2e:headed\n');
}

main().catch((err) => {
  console.error('\n✗ Auth setup failed:', err.message, '\n');
  process.exit(1);
});

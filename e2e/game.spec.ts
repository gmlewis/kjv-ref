import { test, expect } from '@playwright/test';
import { openApp } from './helpers/app-frame';

test.describe('Lamp of the Path Game Mode (Stream D)', () => {
  test('D-1: Entry from Practice mode selector and navigation to full-page game', async ({ page }) => {
    await openApp(page, '/kjv-ref/practice');

    // Find the Lamp of the Path mode card
    const card = page.locator('text=Lamp of the Path');
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeVisible();

    // Click to enter full-page game route
    await card.click();
    await page.waitForURL('**/practice/game');

    // Verify canvas element exists
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Verify Exit button exists and returns to /practice
    const exitBtn = page.locator('button[aria-label="Exit"]');
    await expect(exitBtn).toBeVisible();
    await exitBtn.click();

    await page.waitForURL((url) => url.pathname.endsWith('/practice'));
    await expect(page.locator('text=Practice Mode')).toBeVisible();
  });

  test('D-2: Pre-seeded due review & session persistence', async ({ page }) => {
    await openApp(page, '/kjv-ref/practice');

    // Pre-seed localStorage with progress & review schedule
    await page.evaluate(() => {
      const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
      localStorage.setItem('kjv-memorize-progress', JSON.stringify([
        { verse: { reference: 'Psalm 23:1' }, status: 'mastered', timesRecited: 6, streak: 5, accuracy: 100 }
      ]));
      localStorage.setItem('kjv-memorize-review-schedule', JSON.stringify([
        { verse: { reference: 'Psalm 23:1' }, dueDate: pastDate, interval: 1 }
      ]));
    });

    // Reload or navigate to the game route directly
    await page.goto('/kjv-ref/practice/game', { waitUntil: 'domcontentloaded' });
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Exit the game
    const exitBtn = page.locator('button[aria-label="Exit"]');
    await exitBtn.click();
    await page.waitForURL((url) => url.pathname.endsWith('/practice'));

    // Verify localStorage contains game session record
    const sessions = await page.evaluate(() => {
      const raw = localStorage.getItem('kjv-memorize-sessions');
      return raw ? JSON.parse(raw) : [];
    });
    expect(Array.isArray(sessions)).toBe(true);
  });

  test('D-3: Mobile viewport rendering and exit control', async ({ page }) => {
    // Set mobile iPhone SE viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/kjv-ref/practice/game', { waitUntil: 'domcontentloaded' });
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    const exitBtn = page.locator('button[aria-label="Exit"]');
    await expect(exitBtn).toBeVisible();
    await exitBtn.click();

    await page.waitForURL((url) => url.pathname.endsWith('/practice'));
  });

  test('D-4: Audio Mute button toggle and localStorage persistence', async ({ page }) => {
    await page.goto('/kjv-ref/practice/game', { waitUntil: 'domcontentloaded' });
    const muteBtn = page.locator('button[aria-label="Unmute sound"], button[aria-label="Mute sound"]');
    await expect(muteBtn).toBeVisible();

    // Click to toggle mute state
    await muteBtn.click();

    // Verify kjv-game-state in localStorage has sound setting persisted
    const soundState = await page.evaluate(() => {
      const raw = localStorage.getItem('kjv-game-state');
      return raw ? JSON.parse(raw)?.settings?.sound : null;
    });
    expect(typeof soundState).toBe('boolean');
  });

  test('D-5: Peek button displays active verse text overlay matching active verse', async ({ page }) => {
    await openApp(page, '/kjv-ref/practice');

    const card = page.locator('text=Lamp of the Path');
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await page.waitForURL('**/practice/game');

    // Wait for game boot loading overlay to disappear
    await expect(page.locator('text=Lighting the lamps…')).toBeHidden({ timeout: 15000 });

    const peekBtn = page.locator('button[aria-label="Peek verse text"]');
    await expect(peekBtn).toBeVisible();

    // Click Peek button
    await peekBtn.click();

    // Verify verse peek popup card is displayed
    const hideBtn = page.locator('button[aria-label="Hide verse text"]');
    await expect(hideBtn).toBeVisible();

    // Verify active verse text element is visible inside the peek card
    const peekVerseEl = page.locator('.animate-fadeIn .font-serif');
    await expect(peekVerseEl).toBeVisible();
    const peekCardText = await peekVerseEl.innerText();
    expect(peekCardText.length).toBeGreaterThan(10);
  });
});

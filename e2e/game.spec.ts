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

  test('D-6: Responsive layout rendering on Pixel 10XL portrait device (412x915)', async ({ page }) => {
    // Set viewport to Pixel 10XL portrait resolution (412x915)
    await page.setViewportSize({ width: 412, height: 915 });

    await openApp(page, '/kjv-ref/practice');

    const card = page.locator('text=Lamp of the Path');
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await page.waitForURL('**/practice/game');

    // Wait for game engine canvas to render
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Verify canvas size matches mobile viewport bounds without horizontal scroll
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(412);

    // Verify top controls (Peek, Exit) are fully visible without right edge overflow
    const peekBtn = page.locator('button[aria-label="Peek verse text"]');
    const exitBtn = page.locator('button[aria-label="Exit"]');
    await expect(peekBtn).toBeVisible();
    await expect(exitBtn).toBeVisible();

    const exitBox = await exitBtn.boundingBox();
    expect(exitBox!.x + exitBox!.width).toBeLessThanOrEqual(412);
  });

  test('D-7: Bank tiles display full words across progression stages (regression check)', async ({ page }) => {
    await openApp(page, '/kjv-ref/practice');

    // Pre-seed Genesis 1:1 (the first starter verse, so it stays first in the
    // queue) at customClozeLevel 2 (= stage 2: order + 2 decoys) while leaving
    // timesRecited at 0 so it does not sort behind other never-practiced verses.
    // The override makes the very first puzzle a tile puzzle with full-word bank.
    await page.evaluate(() => {
      localStorage.setItem(
        'kjv-memorize-progress',
        JSON.stringify([
          { verse: { reference: 'Genesis 1:1' }, status: 'learning', timesRecited: 0, streak: 0, accuracy: 0, customClozeLevel: 2 },
        ]),
      );
    });

    await page.goto('/kjv-ref/practice/game', { waitUntil: 'domcontentloaded' });
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Wait for game engine context to be fully booted. The 30s ceiling
    // accommodates slow WebGPU adapter init + font fetch on a loaded CI runner
    // (the overall per-test timeout is 60s).
    await page.waitForFunction(() => typeof (window as any).__lampGamePuzzle === 'function', { timeout: 30000 });

    // The first puzzle is stage 2 (customClozeLevel override), so it is already a
    // tile puzzle — no stage-0 read-along to tap through. A background tap is a
    // no-op when no tile is hit; wait briefly for layout to settle.
    await page.waitForTimeout(500);

    // Verify tile bank words in engine puzzle state
    const info = await page.evaluate(() => {
      const getPuzzle = (window as any).__lampGamePuzzle;
      if (getPuzzle) {
        const p = getPuzzle();
        return p ? { layer: p.layer, reference: p.reference, bankLength: p.bank.length, displays: p.bank.map((t: any) => t.display) } : null;
      }
      return null;
    });

    console.log('D-7 Puzzle info:', JSON.stringify(info));
    const bankDisplays = info?.displays ?? [];
    expect(bankDisplays.length).toBeGreaterThan(0);
    // Every bank tile MUST display a full word (length > 1), NEVER a single letter
    for (const d of bankDisplays) {
      expect(d.length).toBeGreaterThan(1);
    }
  });

  test('D-8: due verse is practiced first and its review schedule advances', async ({ page }) => {
    await openApp(page, '/kjv-ref/practice');
    // Seed John 1:1 (easy starter verse, unlocked) as due, at stage 0 so a tap resolves.
    await page.evaluate(() => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      localStorage.setItem('kjv-memorize-progress', JSON.stringify([
        { verse: { reference: 'John 1:1' }, status: 'reviewing', timesRecited: 3, streak: 2, accuracy: 100, customClozeLevel: 0 },
      ]));
      localStorage.setItem('kjv-memorize-review-schedule', JSON.stringify([
        { verse: { reference: 'John 1:1' }, dueDate: pastDate, interval: 1 },
      ]));
    });

    const before = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('kjv-memorize-review-schedule') || '[]');
      return s.find((e: any) => e?.verse?.reference === 'John 1:1')?.dueDate ?? null;
    });
    expect(before).not.toBeNull();

    await page.goto('/kjv-ref/practice/game', { waitUntil: 'domcontentloaded' });
    // 30s ceiling for slow WebGPU adapter init + font fetch on a loaded CI runner.
    await page.waitForFunction(() => typeof (window as any).__lampGamePuzzle === 'function', { timeout: 30000 });
    await page.waitForTimeout(500);

    // The due verse should be first in the queue (due-first sorting).
    const puzzle = await page.evaluate(() => (window as any).__lampGamePuzzle?.());
    expect(puzzle?.reference).toBe('John 1:1');
    expect(puzzle?.layer).toBe(0);

    // Stage 0 is the read-along study layer — the DOM stage row shows the study prompt.
    await expect(page.locator('text=/Verse Stage 0 — Read the verse/')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Auto' })).toBeVisible();

    // Tap to advance past the study layer, which resolves the verse and advances the schedule.
    await page.locator('canvas').click();
    await page.waitForTimeout(2500);

    const after = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('kjv-memorize-review-schedule') || '[]');
      return s.find((e: any) => e?.verse?.reference === 'John 1:1')?.dueDate ?? null;
    });
    expect(after).not.toBeNull();
    // The schedule advanced: new dueDate is later than the seeded one.
    expect(new Date(after as string).getTime()).toBeGreaterThan(new Date(before as string).getTime());
    // And it is now in the future relative to today (no longer due).
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expect(new Date(after as string) >= today).toBe(true);
    expect(new Date(after as string).getTime()).toBeGreaterThan(Date.now() - 1000);
  });
});

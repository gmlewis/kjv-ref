import { test, expect } from '@playwright/test';
import { openApp } from './helpers/app-frame';

// John 1:1 is an easy starter verse (unlocked). Seed it due + stage 0 so a tap resolves.
// Genesis 1:1 is also easy but NOT due. Due-first sorting should put John 1:1 first.
test('investigate: due verse sorts first and gets cleared', async ({ page }) => {
  await openApp(page, '/kjv-ref/practice');
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
  console.log('BEFORE dueDate:', before);

  await page.goto('/kjv-ref/practice/game', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof (window as any).__lampGamePuzzle === 'function', { timeout: 15000 });
  await page.waitForTimeout(500);
  const puzzle = await page.evaluate(() => (window as any).__lampGamePuzzle?.());
  console.log('FIRST puzzle:', puzzle ? { ref: puzzle.reference, layer: puzzle.layer, bankLen: puzzle.bank.length } : null);

  await page.locator('canvas').click();
  await page.waitForTimeout(2500);

  const after = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('kjv-memorize-review-schedule') || '[]');
    return s.find((e: any) => e?.verse?.reference === 'John 1:1')?.dueDate ?? null;
  });
  console.log('AFTER dueDate:', after);

  const progressAfter = await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('kjv-memorize-progress') || '[]');
    return p.find((e: any) => e?.verse?.reference === 'John 1:1') ?? null;
  });
  console.log('AFTER progress:', JSON.stringify(progressAfter));
});
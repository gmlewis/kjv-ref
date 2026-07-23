import { test, expect } from '@playwright/test';
import { openApp, navigateTo } from './helpers/app-frame';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Set up bookmarks in localStorage before the page loads */
async function setupBookmarks(page: import('@playwright/test').Page, refs: string[]) {
  await page.addInitScript((references) => {
    const bookmarks = references.map((ref: string, i: number) => ({
      id: `test-${i}`,
      user: { id: 'anonymous' },
      reference: ref,
      addedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    localStorage.setItem('kjv-memorize-bookmarks', JSON.stringify(bookmarks));
    // Initialize other storage keys so the app doesn't try to overwrite
    if (!localStorage.getItem('kjv-memorize-progress')) localStorage.setItem('kjv-memorize-progress', '[]');
    if (!localStorage.getItem('kjv-memorize-sessions')) localStorage.setItem('kjv-memorize-sessions', '[]');
    if (!localStorage.getItem('kjv-memorize-achievements')) localStorage.setItem('kjv-memorize-achievements', '[]');
    if (!localStorage.getItem('kjv-memorize-review-schedule')) localStorage.setItem('kjv-memorize-review-schedule', '[]');
    if (!localStorage.getItem('kjv-memorize-daily-goal')) {
      localStorage.setItem('kjv-memorize-daily-goal', JSON.stringify({
        date: new Date().toISOString().split('T')[0],
        targetVerses: 5, completedVerses: 0, completed: false,
      }));
    }
  }, refs);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Favorites page', () => {
  test('shows empty state when no bookmarks exist', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Favorites', 'Your Favorites');
    await expect(frame.getByText(/haven't favorited any verses yet/i)).toBeVisible();
  });

  test('shows favorited verses sorted in Bible order', async ({ page }) => {
    // Add bookmarks out of order — should be sorted by Bible book order
    await setupBookmarks(page, ['John 3:16', 'Genesis 1:1', 'Psalms 23:1']);
    const frame = await openApp(page);
    await navigateTo(frame, 'Favorites', 'Your Favorites');

    // Wait for entries to load
    await expect(frame.getByText('Genesis 1:1')).toBeVisible({ timeout: 15_000 });
    await expect(frame.getByText('Psalms 23:1')).toBeVisible();
    await expect(frame.getByText('John 3:16')).toBeVisible();

    // Verify Bible order: Genesis before Psalms before John
    const genesis = frame.locator('text=Genesis 1:1').first();
    const psalms = frame.locator('text=Psalms 23:1').first();
    const john = frame.locator('text=John 3:16').first();
    const genesisBox = await genesis.boundingBox();
    const psalmsBox = await psalms.boundingBox();
    const johnBox = await john.boundingBox();
    expect(genesisBox?.y).toBeLessThan(psalmsBox?.y ?? 0);
    expect(psalmsBox?.y).toBeLessThan(johnBox?.y ?? 0);
  });

  test('shows verse text for single verse favorites', async ({ page }) => {
    await setupBookmarks(page, ['John 3:16']);
    const frame = await openApp(page);
    await navigateTo(frame, 'Favorites', 'Your Favorites');
    await expect(frame.getByText('John 3:16')).toBeVisible({ timeout: 15_000 });
    // The verse text should contain "God so loved"
    await expect(frame.getByText(/God so loved/i)).toBeVisible();
  });

  test('shows verse range favorites with all verses', async ({ page }) => {
    await setupBookmarks(page, ['Psalms 23:1-6']);
    const frame = await openApp(page);
    await navigateTo(frame, 'Favorites', 'Your Favorites');
    await expect(frame.getByText('Psalms 23:1-6')).toBeVisible({ timeout: 15_000 });
    // Should show "6 verses" badge
    await expect(frame.getByText('6 verses')).toBeVisible();
    // Should show verse numbers 1 through 6
    for (const v of ['1', '2', '3', '4', '5', '6']) {
      await expect(frame.locator(`span:has-text("${v}")`).first()).toBeVisible();
    }
  });

  test('removes a favorite when star is clicked', async ({ page }) => {
    await setupBookmarks(page, ['John 3:16', 'Genesis 1:1']);
    const frame = await openApp(page);
    await navigateTo(frame, 'Favorites', 'Your Favorites');
    await expect(frame.getByText('John 3:16')).toBeVisible({ timeout: 15_000 });

    // Click the star button to unfavorite John 3:16
    // The star buttons have title="Remove from favorites"
    const starButtons = frame.locator('button[title="Remove from favorites"]');
    const count = await starButtons.count();
    expect(count).toBe(2);

    // Click the second star (John 3:16, which is below Genesis 1:1 in sorted order)
    await starButtons.nth(1).click();

    // John 3:16 should disappear
    await expect(frame.getByText('John 3:16')).not.toBeVisible({ timeout: 10_000 });
    // Genesis 1:1 should still be there
    await expect(frame.getByText('Genesis 1:1')).toBeVisible();
  });

  test('arrow keys navigate between favorites', async ({ page }) => {
    await setupBookmarks(page, ['Genesis 1:1', 'Psalms 23:1', 'John 3:16']);
    const frame = await openApp(page);
    await navigateTo(frame, 'Favorites', 'Your Favorites');
    await expect(frame.getByText('Genesis 1:1')).toBeVisible({ timeout: 15_000 });

    // Press right arrow to move to the second favorite
    await frame.locator('body').press('ArrowRight');
    // Psalms 23:1 should be highlighted (verse-selected class)
    await expect(frame.locator('.verse-selected')).toBeVisible({ timeout: 5_000 });

    // Press right arrow again to move to the third
    await frame.locator('body').press('ArrowRight');
    // Press left arrow to go back
    await frame.locator('body').press('ArrowLeft');
    // Should be back on the second favorite
    await expect(frame.locator('.verse-selected')).toBeVisible();
  });

  test('read in context link navigates to chapter view', async ({ page }) => {
    await setupBookmarks(page, ['John 3:16']);
    const frame = await openApp(page);
    await navigateTo(frame, 'Favorites', 'Your Favorites');
    await expect(frame.getByText('John 3:16')).toBeVisible({ timeout: 15_000 });

    // Click the "Read in context" button
    const readBtn = frame.locator('button[title="Read in context"]');
    await readBtn.click();
    // Should navigate to /books/John/3
    await expect(frame.getByText('John Chapter 3')).toBeVisible({ timeout: 15_000 });
  });

  test('read in context for verse range preserves the range', async ({ page }) => {
    await setupBookmarks(page, ['Psalms 23:1-6']);
    const frame = await openApp(page);
    await navigateTo(frame, 'Favorites', 'Your Favorites');
    await expect(frame.getByText('Psalms 23:1-6')).toBeVisible({ timeout: 15_000 });

    // Click the "Read in context" button
    const readBtn = frame.locator('button[title="Read in context"]');
    await readBtn.click();
    // Should navigate to /books/Psalms/23#v1-6
    await expect(frame.getByText('Psalms Chapter 23')).toBeVisible({ timeout: 15_000 });
    // The URL should contain #v1-6
    await expect(frame).toHaveURL(/#v1-6/);
    // All 6 verses should be highlighted with verse-selected
    const selected = frame.locator('.verse-selected');
    expect(await selected.count()).toBe(6);
  });

  test('practice button appears for verse ranges', async ({ page }) => {
    await setupBookmarks(page, ['Psalms 23:1-6']);
    const frame = await openApp(page);
    await navigateTo(frame, 'Favorites', 'Your Favorites');
    await expect(frame.getByText('Psalms 23:1-6')).toBeVisible({ timeout: 15_000 });
    // Should have a Practice button
    await expect(frame.locator('button:has-text("Practice")')).toBeVisible();
  });

  test('practice button appears for single verses', async ({ page }) => {
    await setupBookmarks(page, ['John 3:16']);
    const frame = await openApp(page);
    await navigateTo(frame, 'Favorites', 'Your Favorites');
    await expect(frame.getByText('John 3:16')).toBeVisible({ timeout: 15_000 });
    // Should have a Practice button
    await expect(frame.locator('button:has-text("Practice")')).toBeVisible();
  });

  test('count display shows correct numbers', async ({ page }) => {
    await setupBookmarks(page, ['Genesis 1:1', 'John 3:16', 'Psalms 23:1-6']);
    const frame = await openApp(page);
    await navigateTo(frame, 'Favorites', 'Your Favorites');
    await expect(frame.getByText('Genesis 1:1')).toBeVisible({ timeout: 15_000 });
    // Should show "3 favorites · 1 range"
    await expect(frame.getByText(/3 favorites/i)).toBeVisible();
    await expect(frame.getByText(/1 range/i)).toBeVisible();
  });

  test('favorites nav button is in the navigation bar', async ({ page }) => {
    const frame = await openApp(page);
    // The nav should have a Favorites link
    const favLink = frame.locator('nav a:has-text("Favorites")');
    await expect(favLink).toBeVisible();
    // Clicking it should navigate to /favorites
    await favLink.click();
    await expect(frame.getByText('Your Favorites')).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Regression: single-verse practice from Favorites must show 4 choices ───
// Bug: practising a single favourited verse produced a 1-verse session, so the
// multiple-choice / reference-match distractor set was empty and only the
// correct answer was shown. Distractors should fall back to the full
// KJV_VERSES pool when the session has fewer than 4 verses.

test.describe('Favorites → Practice single verse shows 4 options', () => {
  // Locator for the A/B/C/D labelled option buttons used by both modes.
  function optionButtons(frame: import('@playwright/test').Page) {
    return frame.locator('button').filter({ has: frame.locator('span:text-matches("^[ABCD]$")') });
  }

  test('Multiple Choice shows 4 options for a single favourited verse', async ({ page }) => {
    await setupBookmarks(page, ['John 3:16']);
    const frame = await openApp(page);
    await navigateTo(frame, 'Favorites', 'Your Favorites');
    await expect(frame.getByText('John 3:16')).toBeVisible({ timeout: 15_000 });

    // Click the Practice button on the single favourite
    await frame.locator('button:has-text("Practice")').first().click();
    // Mode selector should appear
    await frame.locator('text=Multiple Choice').first().waitFor({ state: 'visible', timeout: 15_000 });
    await frame.locator('text=Multiple Choice').first().click();
    await frame.locator('text=Verse 1 of').first().waitFor({ state: 'visible', timeout: 15_000 });

    // Regression assertion: must show exactly 4 options, not 1.
    await expect(optionButtons(frame)).toHaveCount(4);
    // All four option labels must be distinct (no duplicate of the answer).
    const texts: string[] = [];
    for (let i = 0; i < 4; i++) {
      texts.push((await optionButtons(frame).nth(i).textContent()) ?? '');
    }
    expect(new Set(texts).size).toBe(4);
  });

  test('Reference Match shows 4 options for a single favourited verse', async ({ page }) => {
    await setupBookmarks(page, ['John 3:16']);
    const frame = await openApp(page);
    await navigateTo(frame, 'Favorites', 'Your Favorites');
    await expect(frame.getByText('John 3:16')).toBeVisible({ timeout: 15_000 });

    await frame.locator('button:has-text("Practice")').first().click();
    await frame.locator('text=Reference Match').first().waitFor({ state: 'visible', timeout: 15_000 });
    await frame.locator('text=Reference Match').first().click();
    await frame.locator('text=Identify this verse:').first().waitFor({ state: 'visible', timeout: 15_000 });

    // Regression assertion: must show exactly 4 reference options, not 1.
    await expect(optionButtons(frame)).toHaveCount(4);
    const refs: string[] = [];
    for (let i = 0; i < 4; i++) {
      refs.push((await optionButtons(frame).nth(i).textContent()) ?? '');
    }
    expect(new Set(refs).size).toBe(4);
    // Each option should look like a Bible reference (e.g. "John 3:16").
    for (const r of refs) {
      expect(r).toMatch(/\d+:\d+/);
    }
  });
});
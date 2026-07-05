import { test, expect } from '@playwright/test';
import { openApp, navigateTo } from './helpers/app-frame';

test.describe('Books — grid view', () => {
  test('shows 66 books', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Books', 'Browse Bible Books');
    await expect(frame.locator('text=66 books').first()).toBeVisible();
  });

  test('shows Old/New Testament filter buttons', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Books', 'Browse Bible Books');
    await expect(frame.locator('button:has-text("Old Testament")').first()).toBeVisible();
    await expect(frame.locator('button:has-text("New Testament")').first()).toBeVisible();
  });

  test('shows search input', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Books', 'Browse Bible Books');
    await expect(frame.locator('input[placeholder*="Search"]').first()).toBeVisible();
  });

  test('search filters books by name', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Books', 'Browse Bible Books');
    await frame.locator('input[placeholder*="Search"]').fill('John');
    // Should show John, 1 John, 2 John, 3 John
    await expect(frame.locator('text=John').first()).toBeVisible();
    const visibleCount = await frame.locator('[class*="glassmorphism"] h3:has-text("John")').count();
    expect(visibleCount).toBeGreaterThanOrEqual(1);
  });

  test('search shows 0 results for non-existent book', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Books', 'Browse Bible Books');
    await frame.locator('input[placeholder*="Search"]').fill('Zzzzz');
    await expect(frame.locator('text=0 of 66')).toBeVisible({ timeout: 5_000 });
  });

  test('filtering by Old Testament shows fewer books', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Books', 'Browse Bible Books');

    const allText = await frame.locator('text=/Showing \\d+ of 66/').first().textContent();
    await frame.locator('button:has-text("Old Testament")').click();
    const otText = await frame.locator('text=/Showing \\d+ of 66/').first().textContent();

    const allCount = parseInt(allText?.match(/\d+/)?.[0] ?? '66');
    const otCount = parseInt(otText?.match(/\d+/)?.[0] ?? '66');
    expect(otCount).toBeLessThan(allCount);
    expect(otCount).toBe(39);
  });

  test('filtering by New Testament shows 27 books', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Books', 'Browse Bible Books');
    await frame.locator('button:has-text("New Testament")').click();
    await expect(frame.locator('text=/Showing 27/').first()).toBeVisible();
  });

  test('books with featured verses show star badge', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Books', 'Browse Bible Books');
    // Featured books have star badges
    const starBadges = frame.locator('[class*="bg-purple-100"]').filter({ hasText: /verse/ });
    const count = await starBadges.count();
    expect(count).toBeGreaterThan(0);
  });

  test('clicking a book opens book detail view', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Books', 'Browse Bible Books');
    await frame.locator('text=Genesis').first().click();
    await expect(frame.locator('text=Genesis').first()).toBeVisible();
    await expect(frame.locator('text=Browse Chapters').first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Books — book detail view', () => {
  test('shows chapter grid for Genesis', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Books', 'Browse Bible Books');
    await frame.locator('text=Genesis').first().click();
    await expect(frame.locator('text=Browse Chapters').first()).toBeVisible({ timeout: 10_000 });
    // Genesis has 50 chapters
    const chapterBtns = frame.locator('[class*="glassmorphism"] button').filter({ hasText: /^\d+$/ });
    const count = await chapterBtns.count();
    expect(count).toBe(50);
  });

  test('chapters with featured verses are highlighted in purple', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Books', 'Browse Bible Books');
    await frame.locator('text=Psalms').first().click();
    await expect(frame.locator('text=Browse Chapters').first()).toBeVisible({ timeout: 10_000 });
    const highlighted = frame.locator('button[class*="from-purple-500"]');
    const count = await highlighted.count();
    expect(count).toBeGreaterThan(0);
  });

  test('shows featured verses section when book has them', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Books', 'Browse Bible Books');
    await frame.locator('text=John').nth(0).click();
    await expect(frame.locator('text=Browse Chapters').first()).toBeVisible({ timeout: 10_000 });
    await expect(frame.locator('text=Featured Verses').first()).toBeVisible();
  });

  test('featured verse has Practice button', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Books', 'Browse Bible Books');
    await frame.locator('text=John').nth(0).click();
    await expect(frame.locator('text=Featured Verses').first()).toBeVisible({ timeout: 10_000 });
    const practiceBtn = frame.locator('button:has-text("Practice")').first();
    await expect(practiceBtn).toBeVisible();
  });

  test('Practice button on featured verse navigates to single-verse practice', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Books', 'Browse Bible Books');
    await frame.locator('text=John').nth(0).click();
    await expect(frame.locator('text=Featured Verses').first()).toBeVisible({ timeout: 10_000 });
    await frame.locator('button:has-text("Practice")').first().click();
    await expect(frame.locator('text=Word Bank').first()).toBeVisible({ timeout: 10_000 });
  });

  test('back button returns to books grid', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Books', 'Browse Bible Books');
    await frame.locator('text=Genesis').first().click();
    await expect(frame.locator('text=Browse Chapters').first()).toBeVisible({ timeout: 10_000 });
    await frame.locator('button:has-text("All Books")').click();
    await expect(frame.locator('text=Browse Bible Books').first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Books — chapter view', () => {
  test('clicking chapter 1 of Genesis shows loading then verses', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Books', 'Browse Bible Books');
    await frame.locator('text=Genesis').first().click();
    await expect(frame.locator('text=Browse Chapters').first()).toBeVisible({ timeout: 10_000 });

    // Click chapter 1
    await frame.locator('[class*="glassmorphism"] button:has-text("1")').first().click();
    await expect(frame.locator('text=Chapter 1').first()).toBeVisible({ timeout: 5_000 });

    // Loading spinner should appear briefly then disappear
    // (May already be done by the time we check)
    await frame.locator('[class*="animate-spin"]').waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});

    // Verse 1 text should appear
    await expect(frame.locator('text=In the beginning').first()).toBeVisible({ timeout: 15_000 });
  });

  test('chapter view shows verse numbers', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Books', 'Browse Bible Books');
    await frame.locator('text=Genesis').first().click();
    await expect(frame.locator('text=Browse Chapters').first()).toBeVisible({ timeout: 10_000 });
    await frame.locator('[class*="glassmorphism"] button:has-text("1")').first().click();
    await frame.locator('[class*="animate-spin"]').waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});

    // Verse numbers like "1", "2", "3" should be visible
    await expect(frame.locator('text=In the beginning').first()).toBeVisible({ timeout: 15_000 });
    const verseNums = frame.locator('[class*="text-purple-500"][class*="font-bold"]');
    const count = await verseNums.count();
    expect(count).toBeGreaterThan(20); // Genesis 1 has 31 verses
  });

  test('featured verse in chapter shows "Featured" badge and Practice button', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Books', 'Browse Bible Books');
    await frame.locator('text=John').nth(0).click();
    await expect(frame.locator('text=Browse Chapters').first()).toBeVisible({ timeout: 10_000 });
    // Chapter 3 has John 3:16
    await frame.locator('[class*="glassmorphism"] button:has-text("3")').first().click();
    await frame.locator('[class*="animate-spin"]').waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    await expect(frame.locator('text=For God so loved').first()).toBeVisible({ timeout: 15_000 });
    await expect(frame.locator('text=Featured').first()).toBeVisible();
    await expect(frame.locator('button:has-text("Practice")').first()).toBeVisible();
  });

  test('chapter jump navigation works', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Books', 'Browse Bible Books');
    await frame.locator('text=Psalms').first().click();
    await expect(frame.locator('text=Browse Chapters').first()).toBeVisible({ timeout: 10_000 });
    await frame.locator('[class*="glassmorphism"] button:has-text("23")').first().click();
    await frame.locator('[class*="animate-spin"]').waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    await expect(frame.locator('text=Psalms Chapter 23').first()).toBeVisible({ timeout: 5_000 });
    await expect(frame.locator('text=The LORD is my shepherd').first()).toBeVisible({ timeout: 15_000 });
    // Jump to chapter 100 via the chapter list
    await frame.locator('[class*="Jump to Chapter"] button:has-text("100")').first().click();
    await frame.locator('[class*="animate-spin"]').waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    await expect(frame.locator('text=Psalms Chapter 100').first()).toBeVisible({ timeout: 5_000 });
  });

  test('back button from chapter returns to book detail', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Books', 'Browse Bible Books');
    await frame.locator('text=Genesis').first().click();
    await expect(frame.locator('text=Browse Chapters').first()).toBeVisible({ timeout: 10_000 });
    await frame.locator('[class*="glassmorphism"] button:has-text("1")').first().click();
    await expect(frame.locator('text=Genesis Chapter 1').first()).toBeVisible({ timeout: 5_000 });
    await frame.locator('button:has-text("All Chapters")').click();
    await expect(frame.locator('text=Browse Chapters').first()).toBeVisible({ timeout: 5_000 });
  });
});

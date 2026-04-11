import { test, expect } from '@playwright/test';
import { openApp, navigateTo } from './helpers/app-frame';

test.describe('Dashboard', () => {
  test('shows hero / welcome section', async ({ page }) => {
    const frame = await openApp(page);
    // Dashboard has a heading with "KJV" or "Bible" or "Memorize"
    const hero = frame.locator('h1').first();
    await expect(hero).toBeVisible();
    const text = await hero.textContent();
    expect(text).toMatch(/KJV|Bible|Memorize|Scripture/i);
  });

  test('shows stat cards (verses tracked, mastery rate, etc.)', async ({ page }) => {
    const frame = await openApp(page);
    // Stats cards use uppercase tracking labels
    await expect(frame.locator('text=Mastery Rate').first()).toBeVisible();
    await expect(frame.locator('text=Sessions').first()).toBeVisible();
  });

  test('shows quick-action / featured verse cards', async ({ page }) => {
    const frame = await openApp(page);
    // Featured section heading
    await expect(frame.locator('text=Featured').first()).toBeVisible();
  });

  test('Start Practice button navigates to practice mode selector', async ({ page }) => {
    const frame = await openApp(page);
    // Find any "Practice" CTA button on the dashboard
    const btn = frame.locator('button:has-text("Practice")').first();
    await expect(btn).toBeVisible();
    await btn.click();
    // Should land on practice page
    await expect(frame.locator('text=Word Bank').first()).toBeVisible({ timeout: 10_000 });
  });

  test('clicking a featured verse navigates to single-verse practice', async ({ page }) => {
    const frame = await openApp(page);
    // Featured verse cards have a "Practice" button each
    const practiceLinks = frame.locator('a[href*="practice"]');
    const count = await practiceLinks.count();
    if (count > 0) {
      await practiceLinks.first().click();
      // Should show mode selector for that specific verse
      await expect(frame.locator('text=Word Bank').first()).toBeVisible({ timeout: 10_000 });
    }
  });
});

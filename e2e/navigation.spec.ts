import { test, expect } from '@playwright/test';
import { openApp, navigateTo } from './helpers/app-frame';

test.describe('Navigation', () => {
  test('app loads and shows navigation', async ({ page }) => {
    const frame = await openApp(page);
    const nav = frame.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('desktop nav shows all five sections', async ({ page }) => {
    const frame = await openApp(page);
    const nav = frame.locator('nav');
    for (const label of ['Dashboard', 'Practice', 'Books', 'Statistics', 'Achievements']) {
      await expect(nav.locator(`text=${label}`).first()).toBeVisible();
    }
  });

  test('navigates to Practice page', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Practice', 'Practice Mode');
    await expect(frame.locator('text=Word Bank').first()).toBeVisible();
  });

  test('navigates to Books page', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Books', 'Browse Bible Books');
    await expect(frame.locator('text=66 books').first()).toBeVisible();
  });

  test('navigates to Statistics page', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Statistics', 'Your Statistics');
  });

  test('navigates to Achievements page', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Achievements', 'Achievements');
    await expect(frame.locator('text=of').first()).toBeVisible(); // "X of Y earned"
  });

  test('back-navigation to Dashboard from Practice', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Practice', 'Practice Mode');
    await navigateTo(frame, 'Dashboard', 'KJV');
  });

  test('mobile hamburger menu opens and navigates', async ({ page }) => {
    // Set a narrow viewport to trigger mobile nav
    await page.setViewportSize({ width: 375, height: 812 });
    const frame = await openApp(page);

    // The hamburger button should be visible
    const hamburger = frame.locator('nav button').first();
    await expect(hamburger).toBeVisible();
    await hamburger.click();

    // Menu items should appear
    await expect(frame.locator('text=Practice').first()).toBeVisible();
    await frame.locator('text=Statistics').first().click();
    await expect(frame.locator('text=Your Statistics').first()).toBeVisible();
  });
});

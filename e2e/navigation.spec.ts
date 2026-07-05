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
    // Nav labels are: Dashboard, Practice, Books, Stats, Awards
    for (const label of ['Dashboard', 'Practice', 'Books', 'Stats', 'Awards']) {
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
    await navigateTo(frame, 'Stats', 'Your Statistics');
  });

  test('navigates to Achievements page', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Awards', 'Achievements');
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

    // The hamburger is the third nav button (0=desktop dark-mode, 1=mobile
    // dark-mode, 2=hamburger). On mobile, button[0] is hidden (it's in the
    // desktop-only section), so buttons 1 and 2 are the visible mobile controls.
    const hamburger = frame.locator('nav button').nth(2);
    await expect(hamburger).toBeVisible();
    await hamburger.click();

    // The mobile menu is a div.md:hidden that becomes visible after clicking.
    // Its items are <div> elements (not <a>), scoped inside the menu container.
    const mobileMenu = frame.locator('div.md\\:hidden').last();
    await expect(mobileMenu.locator('text=Practice').first()).toBeVisible();
    await mobileMenu.locator('text=Stats').first().click();
    await expect(frame.locator('text=Your Statistics').first()).toBeVisible();
  });
});

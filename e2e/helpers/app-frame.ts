import type { Page } from '@playwright/test';

/**
 * The KJV Ref app is a static SPA — no iframe, no server.
 * These helpers navigate the app and wait for it to be ready.
 *
 * `openApp` returns the Page itself (tests call page.locator() directly).
 * The name and signature are preserved so existing specs keep working with
 * minimal edits — they just receive a Page where they previously received a
 * Frame, and both expose the same locator API.
 */

/**
 * Navigate to the app and wait for the nav to be ready.
 * Returns the page so tests can call page.locator() directly.
 *
 * Default path is the app root under the /kjv-ref/ subpath (matches the
 * production GitHub Pages URL and the local `vite preview` base).
 */
export async function openApp(page: Page, path: string = '/kjv-ref/'): Promise<Page> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.locator('nav').waitFor({ state: 'visible', timeout: 20_000 });
  return page;
}

/**
 * Click a navigation link by its label text and wait for the target heading.
 */
export async function navigateTo(
  page: Page,
  label: string,
  expectedHeading: string,
): Promise<void> {
  // Desktop nav: find link inside nav
  const navLink = page.locator(`nav >> text="${label}"`).first();
  if (await navLink.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await navLink.click();
  } else {
    // Mobile: open hamburger, then click
    const hamburger = page.locator('nav button').first();
    await hamburger.click();
    await page.locator(`text="${label}"`).first().click();
  }
  await page.locator(`text=${expectedHeading}`).first().waitFor({ state: 'visible', timeout: 10_000 });
}

/**
 * Wait for a toast / notification to disappear, or a loading spinner.
 */
export async function waitForIdle(page: Page): Promise<void> {
  // If there's a loading spinner, wait for it to go away
  const spinner = page.locator('[class*="animate-spin"]');
  try {
    await spinner.waitFor({ state: 'hidden', timeout: 10_000 });
  } catch {
    // No spinner — that's fine
  }
}

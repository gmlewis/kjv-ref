import type { Page, Frame, Locator } from '@playwright/test';

/**
 * The KJV Memorize app runs inside an iframe injected by the Prophet platform.
 * This helper finds and returns the Frame containing the app.
 *
 * Strategy: look for a non-main frame whose DOM contains our app's navigation.
 * Falls back to the main frame if no iframe is found (defensive).
 */
export async function getAppFrame(page: Page): Promise<Frame> {
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      // Our app's nav always contains the word "Practice"
      try {
        const count = await frame.locator('text=Practice').count();
        if (count > 0) return frame;
      } catch {
        // Frame detached or not yet ready — keep polling
      }
    }
    await page.waitForTimeout(300);
  }

  // Fallback: return main frame (e.g., if architecture changes)
  return page.mainFrame();
}

/**
 * Navigate to the app and wait for the app frame to be ready.
 * Returns the frame so tests can call frame.locator() directly.
 */
export async function openApp(page: Page, path = '/exp/kjv-memorize'): Promise<Frame> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  const frame = await getAppFrame(page);
  // Wait for the nav to be visible before returning
  await frame.locator('nav').waitFor({ state: 'visible', timeout: 20_000 });
  return frame;
}

/**
 * Click a navigation link by its label text and wait for the target heading.
 */
export async function navigateTo(
  frame: Frame,
  label: string,
  expectedHeading: string,
): Promise<void> {
  // Desktop nav: find link inside nav
  const navLink = frame.locator(`nav >> text="${label}"`).first();
  if (await navLink.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await navLink.click();
  } else {
    // Mobile: open hamburger, then click
    const hamburger = frame.locator('nav button').first();
    await hamburger.click();
    await frame.locator(`text="${label}"`).first().click();
  }
  await frame.locator(`text=${expectedHeading}`).first().waitFor({ state: 'visible', timeout: 10_000 });
}

/**
 * Wait for a toast / notification to disappear, or a loading spinner.
 */
export async function waitForIdle(frame: Frame): Promise<void> {
  // If there's a loading spinner, wait for it to go away
  const spinner = frame.locator('[class*="animate-spin"]');
  try {
    await spinner.waitFor({ state: 'hidden', timeout: 10_000 });
  } catch {
    // No spinner — that's fine
  }
}

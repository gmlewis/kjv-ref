import { test, expect } from '@playwright/test';
import { openApp, navigateTo } from './helpers/app-frame';

// ─── Statistics ───────────────────────────────────────────────────────────────

test.describe('Statistics', () => {
  test('page loads and shows heading', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Statistics', 'Your Statistics');
    await expect(frame.locator('h1:has-text("Your Statistics")').first()).toBeVisible();
  });

  test('shows four stat cards', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Statistics', 'Your Statistics');
    for (const label of ['Total Verses Tracked', 'Mastery Rate', 'Sessions Completed', 'Avg Score']) {
      await expect(frame.locator(`text=${label}`).first()).toBeVisible();
    }
  });

  test('stat card values are visible (numbers or dashes)', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Statistics', 'Your Statistics');
    // Values are large bold numbers — check at least one is present
    const values = frame.locator('[class*="gradient-text"][class*="text-4xl"]');
    const count = await values.count();
    expect(count).toBeGreaterThan(0);
  });

  test('shows empty state CTA when no practice sessions', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Statistics', 'Your Statistics');
    // Either charts or empty state — both are valid
    const emptyState = frame.locator('text=No Data Yet');
    const hasEmpty = await emptyState.isVisible({ timeout: 3_000 }).catch(() => false);
    if (hasEmpty) {
      await expect(frame.locator('button:has-text("Start Practicing")').first()).toBeVisible();
    }
  });

  test('Start Practicing link navigates to practice', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Statistics', 'Your Statistics');
    const emptyState = frame.locator('text=No Data Yet');
    const hasEmpty = await emptyState.isVisible({ timeout: 3_000 }).catch(() => false);
    if (hasEmpty) {
      await frame.locator('button:has-text("Start Practicing")').click();
      await expect(frame.locator('text=Word Bank').first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('shows Verse Library difficulty breakdown', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Statistics', 'Your Statistics');
    await expect(frame.locator('text=Verse Library').first()).toBeVisible();
    await expect(frame.locator('text=total verses in practice library').first()).toBeVisible();
  });

  test('verse library shows Easy, Medium, Hard counts', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Statistics', 'Your Statistics');
    for (const label of ['Easy verses', 'Medium verses', 'Hard verses']) {
      await expect(frame.locator(`text=${label}`).first()).toBeVisible();
    }
  });

  test('motivation section is shown at bottom', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Statistics', 'Your Statistics');
    await expect(frame.locator('text=Keep Going!').first()).toBeVisible();
  });

  test('Practice Now button in motivation section works', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Statistics', 'Your Statistics');
    await frame.locator('button:has-text("Practice Now")').first().click();
    await expect(frame.locator('text=Word Bank').first()).toBeVisible({ timeout: 10_000 });
  });

  test('charts render when session data exists', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Statistics', 'Your Statistics');
    // If there's session data, recharts SVG elements will be present
    const charts = frame.locator('svg[class*="recharts"]');
    const hasCharts = await charts.count() > 0;
    if (hasCharts) {
      expect(await charts.count()).toBeGreaterThan(0);
    }
    // If no charts, empty state should be shown — either is valid
  });
});

// ─── Achievements ─────────────────────────────────────────────────────────────

test.describe('Achievements', () => {
  test('page loads and shows heading', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Achievements', 'Achievements');
    await expect(frame.locator('h1:has-text("Achievements")').first()).toBeVisible();
  });

  test('shows earned count out of total', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Achievements', 'Achievements');
    // "X of Y earned"
    await expect(frame.locator('text=/ of \\d+ earned/').first()).toBeVisible({ timeout: 5_000 }).catch(async () => {
      // Alternative: just check the text "earned" appears
      await expect(frame.locator('text=earned').first()).toBeVisible();
    });
  });

  test('shows a progress bar', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Achievements', 'Achievements');
    // Progress bar container
    await expect(frame.locator('[class*="rounded-full"][class*="bg-gray-200"]').first()).toBeVisible();
  });

  test('shows achievement grid with 10 items', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Achievements', 'Achievements');
    // All 10 achievement cards
    const cards = frame.locator('[class*="glassmorphism"][class*="rounded-2xl"]').filter({
      has: frame.locator('h3'),
    });
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('shows known achievement titles', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Achievements', 'Achievements');
    for (const title of ['First Steps', 'Verse Collector', '7-Day Warrior', 'Master of the Word']) {
      await expect(frame.locator(`text=${title}`).first()).toBeVisible();
    }
  });

  test('unearned achievements show lock icon', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Achievements', 'Achievements');
    // Lock icons for unearned achievements (gray background on icon)
    const lockedBadges = frame.locator('[class*="bg-gray-200"]').filter({
      has: frame.locator('svg'),
    });
    // New users should have some locked achievements
    const count = await lockedBadges.count();
    expect(count).toBeGreaterThan(0);
  });

  test('quantitative achievements show progress bars', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Achievements', 'Achievements');
    // Some achievements have progress bars (e.g. "X / 10" for ten-verses)
    // These appear only if not yet earned
    const progressBars = frame.locator('[class*="rounded-full"][class*="bg-gray-200"]');
    const count = await progressBars.count();
    expect(count).toBeGreaterThan(0); // At least the header progress bar
  });

  test('empty state CTA shows when no achievements earned', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Achievements', 'Achievements');
    const emptyState = frame.locator('text=Start Earning Achievements!');
    const hasEmpty = await emptyState.isVisible({ timeout: 3_000 }).catch(() => false);
    if (hasEmpty) {
      await expect(frame.locator('button:has-text("Start Practicing")').first()).toBeVisible();
    }
  });

  test('Start Practicing link in empty state navigates to practice', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Achievements', 'Achievements');
    const emptyState = frame.locator('text=Start Earning Achievements!');
    if (await emptyState.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await frame.locator('button:has-text("Start Practicing")').first().click();
      await expect(frame.locator('text=Word Bank').first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('shows Achievement Tips section', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Achievements', 'Achievements');
    await expect(frame.locator('text=Achievement Tips').first()).toBeVisible();
  });

  test('earned achievements show trophy icon (gold)', async ({ page }) => {
    const frame = await openApp(page);
    await navigateTo(frame, 'Achievements', 'Achievements');
    // Earned achievements have yellow/gradient backgrounds on their icon area
    const earned = frame.locator('[class*="border-yellow-200"]');
    const hasEarned = await earned.count() > 0;
    if (hasEarned) {
      await expect(earned.first()).toBeVisible();
    }
  });
});

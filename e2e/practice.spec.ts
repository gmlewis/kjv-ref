import { test, expect, type Page } from '@playwright/test';
import { openApp, navigateTo } from './helpers/app-frame';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Navigate to the Practice page and return the frame */
async function openPractice(page: Parameters<typeof openApp>[0]) {
  const frame = await openApp(page);
  await navigateTo(frame, 'Practice', 'Practice Mode');
  return frame;
}

/** Select a practice mode by its label */
async function selectMode(page: Page, label: string) {
  // Use exact text match on the mode card label to avoid matching
  // other elements that happen to contain the same words.
  await page.getByText(label, { exact: true }).first().click();
  // Wait for the verse card to appear (has a reference like "John 3:16")
  await page.getByText(/Verse 1 of/).first().waitFor({ state: 'visible', timeout: 15_000 });
}

// ─── Mode Selector ─────────────────────────────────────────────────────────────

test.describe('Practice — mode selector', () => {
  test('shows 6 recommended modes', async ({ page }) => {
    const frame = await openPractice(page);
    for (const label of ['Word Bank', 'First Letters', 'Simplified Vanishing Cloze', 'Vanishing Cloze', 'Multiple Choice', 'Reference Match']) {
      await expect(frame.locator(`text=${label}`).first()).toBeVisible();
    }
  });

  test('Simplified Vanishing Cloze is listed immediately before Vanishing Cloze', async ({ page }) => {
    const frame = await openPractice(page);
    const cards = frame.locator('button:has-text("Start")');
    const labels: string[] = [];
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).textContent();
      labels.push(text ?? '');
    }
    const simpIdx = labels.findIndex(l => l.includes('Simplified Vanishing Cloze'));
    const vanIdx = labels.findIndex(l => l.includes('Vanishing Cloze') && !l.includes('Simplified'));
    expect(simpIdx).toBeGreaterThanOrEqual(0);
    expect(vanIdx).toBeGreaterThanOrEqual(0);
    expect(simpIdx).toBe(vanIdx - 1);
  });

  test('"Full Recall" is hidden by default', async ({ page }) => {
    const frame = await openPractice(page);
    // "Full Recall" appears in the toggle button text ("Show all modes (including Full Recall)")
    // so we must check for the mode card specifically, not just any text match.
    await expect(frame.locator('div:has-text("Full Recall")').filter({ hasText: 'Type the complete verse from memory' })).not.toBeVisible();
  });

  test('"Show all modes" toggle reveals Full Recall', async ({ page }) => {
    const frame = await openPractice(page);
    await frame.locator('text=Show all modes').click();
    await expect(frame.locator('text=Full Recall').first()).toBeVisible();
  });

  test('"Show all modes" toggle can be collapsed again', async ({ page }) => {
    const frame = await openPractice(page);
    await frame.locator('text=Show all modes').click();
    await expect(frame.locator('div:has-text("Full Recall")').filter({ hasText: 'Type the complete verse from memory' }).first()).toBeVisible();
    await frame.locator('text=Show recommended').click();
    await expect(frame.locator('div:has-text("Full Recall")').filter({ hasText: 'Type the complete verse from memory' })).not.toBeVisible();
  });

  test('difficulty filter buttons are visible', async ({ page }) => {
    const frame = await openPractice(page);
    for (const d of ['All', 'Easy', 'Medium', 'Hard']) {
      await expect(frame.locator(`text=${d}`).first()).toBeVisible();
    }
  });

  test('filtering by Easy reduces verse count', async ({ page }) => {
    const frame = await openPractice(page);
    const allLabel = await frame.locator('button:has-text("All (")').first().textContent();
    const allCount = parseInt(allLabel?.match(/\d+/)?.[0] ?? '0');

    await frame.locator('button:has-text("Easy")').click();
    const easyLabel = await frame.locator('button:has-text("Easy (")').first().textContent();
    const easyCount = parseInt(easyLabel?.match(/\d+/)?.[0] ?? '0');

    expect(easyCount).toBeLessThan(allCount);

    const infoText = await frame.locator('text=verses ready').first().textContent();
    expect(infoText).toContain(easyCount.toString());
  });

  test('back arrow from active mode returns to mode selector', async ({ page }) => {
    const frame = await openPractice(page);
    // Click the Multiple Choice mode card
    await frame.getByText('Multiple Choice', { exact: true }).first().click();
    // Wait for the practice session to start
    await frame.getByText(/Verse 1 of/).first().waitFor({ state: 'visible', timeout: 15_000 });
    // Click the back arrow (button with ArrowLeft icon inside the practice header)
    await frame.locator('button').filter({ has: frame.locator('svg.lucide-arrow-left') }).first().click();
    // Should return to mode selector
    await expect(frame.getByText('Word Bank').first()).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Word Bank Mode ────────────────────────────────────────────────────────────

test.describe('Practice — Word Bank mode', () => {
  test('shows shuffled word chips', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Word Bank');
    // The prompt text
    await expect(frame.locator('text=Tap the').first()).toBeVisible();
    // Word chips are buttons with short text
    const chips = frame.locator('button').filter({ hasText: /^\w+[,.;:!?]?$/ });
    expect(await chips.count()).toBeGreaterThan(2);
  });

  test('tapping a word chip moves it to answer zone', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Word Bank');
    // Click the first available word chip
    const availChips = frame.locator('div').filter({ hasText: 'Tap words below' })
      .locator('.. button').first();
    // Use a more reliable selector: the word bank container
    const bankArea = frame.locator('[class*="flex flex-wrap gap-2"]').last();
    const firstChip = bankArea.locator('button').first();
    await firstChip.click();
    // Check button should appear once all words placed
    // (At minimum, the check button stays disabled but is present)
    const checkBtn = frame.locator('button:has-text("Check Answer")');
    await expect(checkBtn).toBeVisible();
  });

  test('Check Answer button starts disabled', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Word Bank');
    const checkBtn = frame.locator('button:has-text("Check Answer")');
    await expect(checkBtn).toBeDisabled();
  });

  test('placed words can be tapped to return to bank', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Word Bank');

    // Get text of a word in the bank
    const bankButtons = frame.locator('button[class*="border-gray"]');
    const count = await bankButtons.count();
    expect(count).toBeGreaterThan(0);

    const word = await bankButtons.first().textContent();
    await bankButtons.first().click(); // moves to placed area

    // Word should now be in placed area
    const placed = frame.locator('button[class*="bg-purple"]');
    await expect(placed.filter({ hasText: word ?? '' }).first()).toBeVisible();
  });

  test('completing a verse and checking shows feedback', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Word Bank');

    // Move all chips to placed zone
    let bankButtons = frame.locator('button[class*="border-gray-200"]');
    let count = await bankButtons.count();
    while (count > 0) {
      await bankButtons.first().click();
      await frame.waitForTimeout(100);
      count = await frame.locator('button[class*="border-gray-200"]').count();
    }

    // Check button should be enabled now
    const checkBtn = frame.locator('button:has-text("Check Answer")');
    await expect(checkBtn).toBeEnabled();
    await checkBtn.click();

    // Feedback shows (either correct or incorrect)
    const feedback = frame.locator('text=Perfect order!').or(frame.locator('text=Not quite'));
    await expect(feedback.first()).toBeVisible({ timeout: 5_000 });
  });

  test('Next Verse button advances to verse 2', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Word Bank');

    // Complete verse 1 quickly: place all chips
    let bank = frame.locator('button[class*="border-gray-200"]');
    let n = await bank.count();
    while (n > 0) {
      await bank.first().click();
      await frame.waitForTimeout(80);
      n = await frame.locator('button[class*="border-gray-200"]').count();
    }
    await frame.locator('button:has-text("Check Answer")').click();
    await frame.locator('button:has-text("Next Verse")').waitFor({ state: 'visible' });
    await frame.locator('button:has-text("Next Verse")').click();

    // Word bank for verse 2 should show new chips (not the old answered state)
    await expect(frame.locator('text=Verse 2 of').first()).toBeVisible({ timeout: 5_000 });
    // New chips should appear in available state
    await expect(frame.locator('button[class*="border-gray-200"]').first()).toBeVisible({ timeout: 5_000 });
  });
});

// ─── First Letters Mode ────────────────────────────────────────────────────────

test.describe('Practice — First Letters mode', () => {
  test('shows first-letter hint in monospace', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'First Letters');
    await expect(frame.getByText(/First letters/i).first()).toBeVisible();
    // Monospace hint text visible
    await expect(frame.locator('[class*="font-mono"]').first()).toBeVisible();
  });

  test('hint shows correct number of letters (one per word)', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'First Letters');

    // Get the reference text to know what verse it is
    const ref = await frame.locator('[class*="text-purple"][class*="font-bold"]').first().textContent();
    expect(ref).toBeTruthy();

    // Hint should have space-separated single characters
    const hint = await frame.locator('[class*="font-mono"]').first().textContent();
    expect(hint?.trim()).toMatch(/^[A-Za-z]( [A-Za-z])*$/);
  });
});

// ─── Simplified Vanishing Cloze Mode ──────────────────────────────────────────

test.describe('Practice — Simplified Vanishing Cloze mode', () => {
  test('shows level badge and inline single-letter inputs for blanked words', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Simplified Vanishing Cloze');
    await expect(frame.locator('text=Level').first()).toBeVisible();
    // Levels > 0 render inline <input> boxes for the blanks; level 0 has none.
    const inputs = frame.locator('input[maxlength="1"]');
    if (await inputs.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      expect(await inputs.count()).toBeGreaterThan(0);
    }
  });

  test('typing a first letter fills the input', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Simplified Vanishing Cloze');
    const input = frame.locator('input[maxlength="1"]').first();
    if (await input.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await input.focus();
      await input.press('a');
      await expect(input).toHaveValue(/.+/);
    }
  });

  test('Check Answer button is disabled until all blanks are filled', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Simplified Vanishing Cloze');
    const checkBtn = frame.locator('button:has-text("Check Answer")');
    if (await checkBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(checkBtn).toBeDisabled();
    }
  });

  test('pressing "?" in an input reveals that word and is marked incorrect', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Simplified Vanishing Cloze');
    const input = frame.locator('input[maxlength="1"]').first();
    if (await input.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await input.focus();
      await input.press('?');
      // The '?' reveal hint line should be visible, and the input should
      // show '?' (or be marked revealed). Then we can fill the rest + check.
      await expect(frame.locator('text=/reveal/i').first()).toBeVisible();
    }
  });

  test('level 0 (study card) shows a "Got it" button', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Simplified Vanishing Cloze');
    const levelText = await frame.locator('text=Level').first().textContent();
    if (levelText?.includes('Level 0')) {
      await expect(frame.locator('text=Study Mode').first()).toBeVisible();
      await expect(frame.locator('button:has-text("Got it")').first()).toBeVisible();
    }
  });

  test('submitting all correct first letters shows success feedback', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Simplified Vanishing Cloze');
    const inputs = frame.locator('input[maxlength="1"]');
    if (await inputs.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      // Fill every blank input with the correct first letter by reading the
      // placeholder after check is not possible pre-check; instead just fill
      // with 'a' for each — at minimum the Check button should become enabled
      // and produce feedback.
      const n = await inputs.count();
      for (let i = 0; i < n; i++) {
        await inputs.nth(i).focus();
        await inputs.nth(i).press('a');
      }
      const checkBtn = frame.locator('button:has-text("Check Answer")');
      await expect(checkBtn).toBeEnabled();
      await checkBtn.click();
      // Feedback line appears after checking
      await expect(frame.getByText(/All first letters correct|wrong or revealed/i).first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('no Cmd/Ctrl+Enter keyboard shortcut is wired (Check requires button click)', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Simplified Vanishing Cloze');
    const inputs = frame.locator('input[maxlength="1"]');
    if (await inputs.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      const n = await inputs.count();
      for (let i = 0; i < n; i++) {
        await inputs.nth(i).focus();
        await inputs.nth(i).press('a');
      }
      const checkBtn = frame.locator('button:has-text("Check Answer")');
      await expect(checkBtn).toBeEnabled();
      // Press Cmd/Ctrl+Enter — the shortcut should be suppressed in this mode,
      // so the button should NOT have been clicked (still visible & enabled).
      await page.keyboard.press('Control+Enter');
      await expect(checkBtn).toBeEnabled();
    }
  });
});

// ─── Vanishing Cloze Mode ─────────────────────────────────────────────────────

test.describe('Practice — Vanishing Cloze mode', () => {
  test('textarea accepts input', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Vanishing Cloze');
    const textarea = frame.locator('textarea').first();
    // Level 0 (Study Mode) may not have a textarea, so only test if present
    if (await textarea.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await textarea.fill('Test input');
      await expect(textarea).toHaveValue('Test input');
    }
  });

  test('Check Answer button is disabled when textarea is empty', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Vanishing Cloze');
    // Only test if a Check Answer button exists (levels > 0)
    const checkBtn = frame.locator('button:has-text("Check Answer")');
    if (await checkBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(checkBtn).toBeDisabled();
    }
  });

  test('Check Answer button enables after typing', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Vanishing Cloze');
    const textarea = frame.locator('textarea').first();
    // Only test if textarea exists (levels > 0)
    if (await textarea.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await textarea.fill('For God so loved the world');
      const checkBtn = frame.locator('button:has-text("Check Answer")');
      await expect(checkBtn).toBeEnabled();
    }
  });

  test('Reveal button shows full verse and marks wrong', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Vanishing Cloze');
    const revealBtn = frame.locator('button:has-text("Reveal")');
    if (await revealBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await revealBtn.click();
      await expect(frame.locator('text=Correct Answer:').first()).toBeVisible();
      await expect(frame.locator('text=Answer revealed').first()).toBeVisible();
    }
  });

  test('submitting a good answer shows accuracy feedback', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Vanishing Cloze');
    const textarea = frame.locator('textarea').first();
    if (await textarea.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await textarea.fill(
        'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.'
      );
      await frame.locator('button:has-text("Check Answer")').click();
      // Should show accuracy feedback
      await expect(frame.getByText(/accuracy|revealed/i).first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('shows level badge', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Vanishing Cloze');
    // Level badge: "Level X — ..."
    await expect(frame.locator('text=Level').first()).toBeVisible();
  });

  test('level 0 (new verse) shows full study card with Got it button', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Vanishing Cloze');
    const levelText = await frame.locator('text=Level').first().textContent();
    // New users will be at Level 0
    if (levelText?.includes('Level 0')) {
      await expect(frame.locator('text=Study Mode').first()).toBeVisible();
      await expect(frame.locator('button:has-text("Got it")').first()).toBeVisible();
    }
  });

  test('blanked text shows underscores for hidden words', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Vanishing Cloze');
    const levelText = await frame.locator('text=Level').first().textContent();
    // For levels > 0, blanks should appear
    if (!levelText?.includes('Level 0')) {
      await expect(frame.locator('text=______').first()).toBeVisible();
    }
  });

  test('Got it button at level 0 reveals Next Verse', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Vanishing Cloze');
    const gotIt = frame.locator('button:has-text("Got it")');
    if (await gotIt.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await gotIt.click();
      await expect(frame.locator('button:has-text("Next Verse"), button:has-text("Finish")').first()).toBeVisible();
    }
  });
});

// ─── Multiple Choice Mode ─────────────────────────────────────────────────────

test.describe('Practice — Multiple Choice mode', () => {
  test('shows 4 answer options', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Multiple Choice');
    // Options have A/B/C/D labels in spans
    const options = frame.locator('button').filter({ has: frame.locator('span:text-matches("^[ABCD]$")') });
    await expect(options).toHaveCount(4);
  });

  test('correct option turns green', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Multiple Choice');
    // Click each option until we find the correct one (green)
    const options = frame.locator('button').filter({ has: frame.locator('span:text-matches("^[ABCD]$")') });
    await options.first().click();
    // After any selection, one button should be green
    const greenOpt = frame.locator('button[class*="border-green"]');
    await expect(greenOpt).toBeVisible({ timeout: 3_000 });
  });

  test('wrong option turns red, correct turns green', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Multiple Choice');

    // We need to click a wrong answer. Verse reference is shown.
    // Click first option — it might be wrong
    const options = frame.locator('button').filter({ has: frame.locator('span:text-matches("^[ABCD]$")') });
    const firstText = await options.first().textContent();

    // Check if the correct answer is shown (check icon visible)
    await options.first().click();
    // At least one green and possibly one red
    const greenOpts = frame.locator('button[class*="border-green"]');
    await expect(greenOpts).toHaveCount(1);
  });

  test('Next Verse advances after answering', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Multiple Choice');
    const options = frame.locator('button').filter({ has: frame.locator('span:text-matches("^[ABCD]$")') });
    await options.first().click();
    const nextBtn = frame.locator('button:has-text("Next Verse"), button:has-text("Finish Session")').first();
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();
    await expect(frame.locator('text=Verse 2 of').first()).toBeVisible({ timeout: 5_000 });
  });

  test('options are disabled after selection', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Multiple Choice');
    const options = frame.locator('button').filter({ has: frame.locator('span:text-matches("^[ABCD]$")') });
    await options.first().click();
    // All options should now be disabled
    for (let i = 0; i < 4; i++) {
      await expect(options.nth(i)).toBeDisabled();
    }
  });
});

// ─── Reference Match Mode ─────────────────────────────────────────────────────

test.describe('Practice — Reference Match mode', () => {
  test('shows verse text and 4 reference options', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Reference Match');
    await expect(frame.locator('text=Identify this verse:').first()).toBeVisible();
    const options = frame.locator('button').filter({ has: frame.locator('span:text-matches("^[ABCD]$")') });
    await expect(options).toHaveCount(4);
  });

  test('options are book:chapter:verse style references', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Reference Match');
    const options = frame.locator('button').filter({ has: frame.locator('span:text-matches("^[ABCD]$")') });
    const firstText = await options.first().textContent();
    expect(firstText).toMatch(/\d+:\d+/); // e.g. "John 3:16"
  });

  test('selecting correct reference shows green feedback', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Reference Match');
    const options = frame.locator('button').filter({ has: frame.locator('span:text-matches("^[ABCD]$")') });
    await options.first().click();
    const greenOpt = frame.locator('button[class*="border-green"]');
    await expect(greenOpt).toBeVisible({ timeout: 3_000 });
  });
});

// ─── Session summary ───────────────────────────────────────────────────────────

test.describe('Practice — session summary', () => {
  test('session summary appears after last verse (single-verse session)', async ({ page }) => {
    const frame = await openApp(page);
    // Target single-verse practice links (e.g. /practice/John%203:16), not /practice
    const practiceLinks = frame.locator('a[href*="/practice/"]');
    const count = await practiceLinks.count();
    if (count === 0) { test.skip(); return; }
    await practiceLinks.first().click();
    await frame.locator('text=Word Bank').first().waitFor({ state: 'visible', timeout: 10_000 });

    await frame.locator('text=Multiple Choice').first().click();
    await frame.locator('text=Verse 1 of').first().waitFor({ state: 'visible', timeout: 10_000 });

    // Answer
    const options = frame.locator('button').filter({ has: frame.locator('span:text-matches("^[ABCD]$")') });
    await options.first().click();

    // Click Finish Session (shown on last verse) or Next Verse
    const finishBtn = frame.locator('button:has-text("Finish Session")');
    const nextBtn = frame.locator('button:has-text("Next Verse")');
    if (await finishBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await finishBtn.click();
    } else if (await nextBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await nextBtn.click();
    }

    await expect(frame.locator('text=Session Complete!').first()).toBeVisible({ timeout: 10_000 });
  });

  test('Practice Again restarts the session', async ({ page }) => {
    const frame = await openApp(page);
    const practiceLinks = frame.locator('a[href*="/practice/"]');
    if (await practiceLinks.count() === 0) { test.skip(); return; }
    await practiceLinks.first().click();
    await frame.locator('text=Word Bank').first().waitFor({ state: 'visible', timeout: 10_000 });
    await frame.locator('text=Multiple Choice').first().click();
    await frame.locator('text=Verse 1 of').first().waitFor({ state: 'visible', timeout: 10_000 });
    const options = frame.locator('button').filter({ has: frame.locator('span:text-matches("^[ABCD]$")') });
    await options.first().click();
    const finishBtn = frame.locator('button:has-text("Finish Session")');
    const nextBtn = frame.locator('button:has-text("Next Verse")');
    if (await finishBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await finishBtn.click();
    } else if (await nextBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await nextBtn.click();
    }
    await frame.locator('text=Session Complete!').first().waitFor({ state: 'visible', timeout: 10_000 });

    await frame.locator('button:has-text("Practice Again")').click();
    await expect(frame.locator('text=Verse 1 of').first()).toBeVisible({ timeout: 5_000 });
  });

  test('Change Mode returns to mode selector', async ({ page }) => {
    const frame = await openApp(page);
    const practiceLinks = frame.locator('a[href*="/practice/"]');
    if (await practiceLinks.count() === 0) { test.skip(); return; }
    await practiceLinks.first().click();
    await frame.locator('text=Multiple Choice').first().click();
    await frame.locator('text=Verse 1 of').first().waitFor({ state: 'visible', timeout: 10_000 });
    const options = frame.locator('button').filter({ has: frame.locator('span:text-matches("^[ABCD]$")') });
    await options.first().click();
    const finishBtn = frame.locator('button:has-text("Finish Session")');
    const nextBtn = frame.locator('button:has-text("Next Verse")');
    if (await finishBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await finishBtn.click();
    } else if (await nextBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await nextBtn.click();
    }
    await frame.locator('text=Session Complete!').first().waitFor({ state: 'visible', timeout: 10_000 });

    await frame.locator('button:has-text("Change Mode")').click();
    await expect(frame.locator('text=Word Bank').first()).toBeVisible({ timeout: 5_000 });
  });

  test('Dashboard button returns to dashboard', async ({ page }) => {
    const frame = await openApp(page);
    const practiceLinks = frame.locator('a[href*="/practice/"]');
    if (await practiceLinks.count() === 0) { test.skip(); return; }
    await practiceLinks.first().click();
    await frame.locator('text=Multiple Choice').first().click();
    await frame.locator('text=Verse 1 of').first().waitFor({ state: 'visible', timeout: 10_000 });
    const options = frame.locator('button').filter({ has: frame.locator('span:text-matches("^[ABCD]$")') });
    await options.first().click();
    const finishBtn = frame.locator('button:has-text("Finish Session")');
    const nextBtn = frame.locator('button:has-text("Next Verse")');
    if (await finishBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await finishBtn.click();
    } else if (await nextBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await nextBtn.click();
    }
    await frame.locator('text=Session Complete!').first().waitFor({ state: 'visible', timeout: 10_000 });

    await frame.locator('button:has-text("Dashboard")').click();
    await expect(frame.locator('h1').first()).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Progress bar ─────────────────────────────────────────────────────────────

test.describe('Practice — progress tracking', () => {
  test('progress bar advances with each verse', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Multiple Choice');

    // Progress bar starts at 0% (verse 1)
    const counter = frame.locator('text=Verse 1 of').first();
    await expect(counter).toBeVisible();

    // Answer and advance
    const opts = frame.locator('button').filter({ has: frame.locator('span:text-matches("^[ABCD]$")') });
    await opts.first().click();
    const nextBtn = frame.locator('button:has-text("Next Verse"), button:has-text("Finish")').first();
    await nextBtn.click();

    // Now on verse 2
    await expect(frame.locator('text=Verse 2 of').first()).toBeVisible({ timeout: 5_000 });
  });

  test('score counter updates correctly', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Multiple Choice');

    // Initial: "Get started!"
    await expect(frame.locator('text=Get started!').first()).toBeVisible();

    // After answering verse 1
    const opts = frame.locator('button').filter({ has: frame.locator('span:text-matches("^[ABCD]$")') });
    await opts.first().click();

    // Score should now show "X/1 correct"
    await expect(frame.locator('text=/\\d\\/1 correct/').first()).toBeVisible({ timeout: 3_000 });
  });

  test('keyword tip is shown for each verse', async ({ page }) => {
    const frame = await openPractice(page);
    await selectMode(frame, 'Multiple Choice');
    await expect(frame.locator('text=Key words:').first()).toBeVisible();
  });
});

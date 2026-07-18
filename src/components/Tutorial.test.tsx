import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Tutorial from './Tutorial';

// Mock useNavigate
const navigateSpy = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

let unmountFn: (() => void) | null = null;

function renderTutorial() {
  const result = render(
    <MemoryRouter>
      <Tutorial onClose={() => {}} />
    </MemoryRouter>
  );
  unmountFn = result.unmount;
  return result;
}

function pressKey(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

afterEach(() => {
  if (unmountFn) { unmountFn(); unmountFn = null; }
});

describe('Tutorial', () => {
  it('renders the first step (welcome)', () => {
    renderTutorial();
    expect(document.querySelector('.modal-title')?.textContent).toBe('Welcome to KJV Memorize!');
  });

  it('shows step counter "Step 1 of 21"', () => {
    renderTutorial();
    expect(document.body.textContent).toContain('Step 1 of 21');
  });

  it('has 21 steps total', () => {
    renderTutorial();
    expect(document.body.textContent).toContain('of 21');
  });

  it('shows Next button on first step', () => {
    renderTutorial();
    expect(document.body.textContent).toContain('Next');
  });

  it('does not show Back button on first step', () => {
    renderTutorial();
    const backBtn = document.querySelector('button');
    // First button in the footer should be "Next", not "Back"
    const buttons = Array.from(document.querySelectorAll('button'));
    const hasBack = buttons.some(b => b.textContent?.includes('Back'));
    expect(hasBack).toBe(false);
  });

  it('Esc closes the tutorial', () => {
    const onClose = vi.fn();
    const result = render(
      <MemoryRouter>
        <Tutorial onClose={onClose} />
      </MemoryRouter>
    );
    unmountFn = result.unmount;
    pressKey('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ArrowRight advances to step 2', () => {
    renderTutorial();
    pressKey('ArrowRight');
    expect(document.querySelector('.modal-title')?.textContent).toBe('Your Dashboard');
  });

  it('Space advances to next step', () => {
    renderTutorial();
    pressKey(' ');
    expect(document.body.textContent).toContain('Step 2 of 21');
  });

  it('ArrowLeft goes back to previous step', () => {
    renderTutorial();
    pressKey('ArrowRight'); // step 2
    pressKey('ArrowLeft');  // back to step 1
    expect(document.querySelector('.modal-title')?.textContent).toBe('Welcome to KJV Memorize!');
  });

  it('ArrowLeft does nothing on step 1 (no negative index)', () => {
    renderTutorial();
    pressKey('ArrowLeft');
    expect(document.body.textContent).toContain('Step 1 of 21');
  });

  it('navigates to / when step requires it', () => {
    renderTutorial();
    pressKey('ArrowRight'); // step 2 = "Your Dashboard" which navigates to '/'
    expect(navigateSpy).toHaveBeenCalledWith('/');
  });

  it('navigates to /books for the browsing step', () => {
    renderTutorial();
    // Advance to step 4 (Books browsing)
    pressKey('ArrowRight'); // step 2
    pressKey('ArrowRight'); // step 3
    pressKey('ArrowRight'); // step 4
    expect(navigateSpy).toHaveBeenCalledWith('/books');
  });

  it('navigates to /books/John/3#v16 for the chapter view step', () => {
    renderTutorial();
    // Advance to step 5 (Chapter view)
    pressKey('ArrowRight'); // step 2
    pressKey('ArrowRight'); // step 3
    pressKey('ArrowRight'); // step 4
    pressKey('ArrowRight'); // step 5
    expect(navigateSpy).toHaveBeenCalledWith('/books/John/3#v16');
  });

  it('navigates to /practice for the practice overview step', () => {
    renderTutorial();
    // Advance to step 13 (Practice overview)
    for (let i = 0; i < 12; i++) pressKey('ArrowRight');
    expect(document.body.textContent).toContain('Step 13 of 21');
    expect(navigateSpy).toHaveBeenCalledWith('/practice');
  });

  it('shows Done button on the last step', () => {
    renderTutorial();
    // Advance to the last step (21)
    for (let i = 0; i < 20; i++) pressKey('ArrowRight');
    expect(document.body.textContent).toContain("You're All Set!");
    const buttons = Array.from(document.querySelectorAll('button'));
    const hasDone = buttons.some(b => b.textContent?.includes('Done!'));
    expect(hasDone).toBe(true);
  });

  it('Done button calls onClose', () => {
    const onClose = vi.fn();
    const result = render(
      <MemoryRouter>
        <Tutorial onClose={onClose} />
      </MemoryRouter>
    );
    unmountFn = result.unmount;
    // Advance to the last step
    for (let i = 0; i < 20; i++) pressKey('ArrowRight');
    // Click Done
    const doneBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Done!'));
    expect(doneBtn).toBeDefined();
    act(() => { fireEvent.click(doneBtn!); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Next button advances to next step', () => {
    renderTutorial();
    const nextBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Next'));
    expect(nextBtn).toBeDefined();
    act(() => { fireEvent.click(nextBtn!); });
    expect(document.body.textContent).toContain('Step 2 of 21');
  });

  it('Back button goes to previous step', () => {
    renderTutorial();
    pressKey('ArrowRight'); // step 2
    const backBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Back'));
    expect(backBtn).toBeDefined();
    act(() => { fireEvent.click(backBtn!); });
    expect(document.body.textContent).toContain('Step 1 of 21');
  });

  it('renders practice mode descriptions', () => {
    renderTutorial();
    // Step 14 = Word Bank
    for (let i = 0; i < 13; i++) pressKey('ArrowRight');
    expect(document.body.textContent).toContain('Word Bank');
    expect(document.body.textContent).toContain('Tap to Order');
    expect(document.body.textContent).toContain('shuffled');
  });

  it('renders First Letters description', () => {
    renderTutorial();
    for (let i = 0; i < 14; i++) pressKey('ArrowRight');
    expect(document.body.textContent).toContain('First Letters');
    expect(document.body.textContent).toContain('Hint-Guided');
    expect(document.body.textContent).toContain('first letter');
  });

  it('renders Vanishing Cloze description with levels', () => {
    renderTutorial();
    for (let i = 0; i < 15; i++) pressKey('ArrowRight');
    expect(document.body.textContent).toContain('Vanishing Cloze');
    expect(document.body.textContent).toContain('Level 0');
    expect(document.body.textContent).toContain('Level 4');
    expect(document.body.textContent).toContain('progressive disclosure');
  });

  it('renders Multiple Choice description', () => {
    renderTutorial();
    for (let i = 0; i < 16; i++) pressKey('ArrowRight');
    expect(document.body.textContent).toContain('Multiple Choice');
    expect(document.body.textContent).toContain('Recognition');
  });

  it('renders Reference Match description', () => {
    renderTutorial();
    for (let i = 0; i < 17; i++) pressKey('ArrowRight');
    expect(document.body.textContent).toContain('Reference Match');
    expect(document.body.textContent).toContain('Reverse Recall');
  });

  it('renders Full Recall description', () => {
    renderTutorial();
    for (let i = 0; i < 18; i++) pressKey('ArrowRight');
    expect(document.body.textContent).toContain('Full Recall');
    expect(document.body.textContent).toContain('Type from Memory');
    expect(document.body.textContent).toContain('Show all modes');
  });

  it('renders settings export/import description', () => {
    renderTutorial();
    for (let i = 0; i < 19; i++) pressKey('ArrowRight');
    expect(document.body.textContent).toContain('Backup and Share');
    expect(document.body.textContent).toContain('download');
  });

  it('renders final step with recap', () => {
    renderTutorial();
    for (let i = 0; i < 20; i++) pressKey('ArrowRight');
    expect(document.body.textContent).toContain("You're All Set!");
    expect(document.body.textContent).toContain('Happy memorizing');
  });

  it('can navigate backward through all steps without error', () => {
    renderTutorial();
    // Go to step 21
    for (let i = 0; i < 20; i++) pressKey('ArrowRight');
    // Go back to step 1
    for (let i = 0; i < 20; i++) pressKey('ArrowLeft');
    expect(document.body.textContent).toContain('Step 1 of 21');
  });

  it('renders kbd elements for keyboard shortcut hints', () => {
    renderTutorial();
    expect(document.querySelector('.kbd-key')).not.toBeNull();
  });

  it('creates a portal on document.body', () => {
    renderTutorial();
    // The tutorial card should be rendered in the body via portal
    expect(document.querySelector('.modal-card')).not.toBeNull();
  });
});
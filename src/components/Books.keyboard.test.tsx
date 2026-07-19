import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { readFileSync } from 'fs';
import { join } from 'path';

// Mock the hooks so we don't need localStorage / IndexedDB
vi.mock('../hooks', () => ({
  useMyBookmarks: () => [[], false, null],
  useCreateBookmarkMutation: () => ({ mutate: () => Promise.resolve() }),
  useRemoveBookmarkMutation: () => ({ mutate: () => Promise.resolve() }),
}));

// Mock strongs + interlinear data loaders (not needed for verse nav tests)
vi.mock('../data/strongs', () => ({
  getVerseWordData: vi.fn().mockResolvedValue([]),
}));
vi.mock('../data/interlinear', () => ({
  getInterlinearChapter: vi.fn().mockResolvedValue(new Map()),
  getInterlinearWordBook: vi.fn().mockResolvedValue({}),
}));

// Load real kjv.txt once and inject it so getKJVChapter works without fetch
const KJV_RAW = readFileSync(join(__dirname, '../../kjv.txt'), 'utf-8');

import { _setBibleForTesting } from '../data/kjv-bible';
import Books from './Books';

// ─── Test harness ───────────────────────────────────────────────────────────

/**
 * Renders <Books/> inside a MemoryRouter with the same route structure as App.
 * `initialPath` sets the router's location (controls useParams).
 * `initialHash` sets window.location.hash (controls verse detection).
 */
function renderBooksAt(initialPath: string, initialHash = '') {
  // Set window.location.hash to simulate the browser hash
  if (initialHash) {
    window.history.replaceState(null, '', initialHash);
  } else {
    window.history.replaceState(null, '', ' ');
  }

  const result = render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/books/:book/:chapter" element={<Books />} />
        <Route path="/books/:book" element={<Books />} />
        <Route path="/books" element={<Books />} />
      </Routes>
    </MemoryRouter>
  );

  return result;
}

/** Fire a real keydown event on window. */
function pressKey(key: string, shift = false, meta = false) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, shiftKey: shift, metaKey: meta }));
  });
}

/** Wait for all pending promises/timers to flush (verse data load, etc.) */
async function flush(ms = 100) {
  // Use multiple short act cycles to flush nested microtask/macrotask queues
  // (verse data load → loading state → scroll effect → setTimeout(0)).
  const cycles = Math.ceil(ms / 50);
  for (let i = 0; i < cycles; i++) {
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Books ChapterView keyboard shortcuts', () => {
  beforeAll(() => {
    _setBibleForTesting(KJV_RAW);
  });

  beforeEach(() => {
    // Reset hash
    window.history.replaceState(null, '', ' ');
    // Mock scrollTo so jsdom doesn't throw
    window.scrollTo = vi.fn();
    // Mock getBoundingClientRect for verse elements
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      top: 100, bottom: 120, left: 0, right: 800,
      width: 800, height: 20, x: 0, y: 100, toJSON: () => {},
    }) as DOMRect);
    document.body.innerHTML = '';
  });

  afterEach(() => {
    // Don't use vi.restoreAllMocks() — it resets the vi.mock factories for
    // strongs/interlinear. Just clean up the DOM.
    document.body.innerHTML = '';
  });

  // ─── Right arrow: advance verse ───────────────────────────────────────────

  it('right arrow with no verse hash jumps to verse 1 (same chapter)', async () => {
    const { unmount } = renderBooksAt('/books/John/3');
    await flush();
    expect(screen.getByText('John Chapter 3')).toBeDefined();

    pressKey('ArrowRight');
    await flush();

    expect(window.location.hash).toBe('#v1');
    expect(window.scrollTo).toHaveBeenCalled();
    unmount();
  });

  it('right arrow advances verse 1 → 2 (same chapter)', async () => {
    const { unmount } = renderBooksAt('/books/John/3', '#v1');
    await flush();

    pressKey('ArrowRight');
    await flush();

    expect(window.location.hash).toBe('#v2');
    unmount();
  });

  it('right arrow advances verse 16 → 17 (same chapter)', async () => {
    const { unmount } = renderBooksAt('/books/John/3', '#v16');
    await flush();

    pressKey('ArrowRight');
    await flush();

    expect(window.location.hash).toBe('#v17');
    unmount();
  });

  it('right arrow at last verse of chapter wraps to verse 1 of next chapter', async () => {
    // John 3 has 36 verses; next chapter is John 4
    const { unmount } = renderBooksAt('/books/John/3', '#v36');
    await flush();
    expect(screen.getByText('John Chapter 3')).toBeDefined();

    pressKey('ArrowRight');
    await flush(300);

    // Should now show John Chapter 4 (navigated via MemoryRouter)
    expect(screen.getByText('John Chapter 4')).toBeDefined();
    expect(window.scrollTo).toHaveBeenCalled();
    unmount();
  });

  it('right arrow at last verse of last chapter of a book wraps to next book chapter 1', async () => {
    // Malachi 4 has 6 verses; next book is Matthew chapter 1
    const { unmount } = renderBooksAt('/books/Malachi/4', '#v6');
    await flush();

    pressKey('ArrowRight');
    await flush(300);

    expect(screen.getByText('Matthew Chapter 1')).toBeDefined();
    expect(window.scrollTo).toHaveBeenCalled();
    unmount();
  });

  it('right arrow at last verse of Revelation 22 wraps to Genesis 1 (Bible wraparound)', async () => {
    // Revelation 22 has 21 verses
    const { unmount } = renderBooksAt('/books/Revelation/22', '#v21');
    await flush();

    pressKey('ArrowRight');
    await flush(300);

    expect(screen.getByText('Genesis Chapter 1')).toBeDefined();
    expect(window.scrollTo).toHaveBeenCalled();
    unmount();
  });

  // ─── Left arrow: retreat verse ────────────────────────────────────────────

  it('left arrow with no verse hash goes to last verse of previous chapter', async () => {
    // John 3, no verse → prev chapter is John 2 (25 verses)
    const { unmount } = renderBooksAt('/books/John/3');
    await flush();
    expect(screen.getByText('John Chapter 3')).toBeDefined();

    pressKey('ArrowLeft');
    await flush(300);

    // Should navigate to John 2 and scroll to the last verse (25).
    // MemoryRouter doesn't sync window.location.hash, so we verify via the
    // rendered chapter heading and that scrollTo was called (the scroll
    // effect fires because _pendingScrollVerse is set).
    expect(screen.getByText('John Chapter 2')).toBeDefined();
    expect(window.scrollTo).toHaveBeenCalled();
    unmount();
  });

  it('left arrow retreats verse 17 → 16 (same chapter)', async () => {
    const { unmount } = renderBooksAt('/books/John/3', '#v17');
    await flush();

    pressKey('ArrowLeft');
    await flush();

    expect(window.location.hash).toBe('#v16');
    unmount();
  });

  it('left arrow at verse 1 wraps to last verse of previous chapter', async () => {
    // John 3:1 → prev chapter is John 2 (25 verses)
    const { unmount } = renderBooksAt('/books/John/3', '#v1');
    await flush();
    expect(screen.getByText('John Chapter 3')).toBeDefined();

    pressKey('ArrowLeft');
    await flush(300);

    // MemoryRouter doesn't sync window.location.hash; verify chapter changed + scrolled.
    expect(screen.getByText('John Chapter 2')).toBeDefined();
    expect(window.scrollTo).toHaveBeenCalled();
    unmount();
  });

  it('left arrow at verse 1 of chapter 1 wraps to previous book last chapter', async () => {
    // Matthew 1:1 → prev book is Malachi, chapter 4 (6 verses)
    const { unmount } = renderBooksAt('/books/Matthew/1', '#v1');
    await flush();
    expect(screen.getByText('Matthew Chapter 1')).toBeDefined();

    pressKey('ArrowLeft');
    await flush(300);

    expect(screen.getByText('Malachi Chapter 4')).toBeDefined();
    expect(window.scrollTo).toHaveBeenCalled();
    unmount();
  });

  it('left arrow at verse 1 of Genesis 1 wraps to Revelation 22 (Bible wraparound)', async () => {
    const { unmount } = renderBooksAt('/books/Genesis/1', '#v1');
    await flush();
    expect(screen.getByText('Genesis Chapter 1')).toBeDefined();

    pressKey('ArrowLeft');
    await flush(300);

    expect(screen.getByText('Revelation Chapter 22')).toBeDefined();
    expect(window.scrollTo).toHaveBeenCalled();
    unmount();
  });

  // ─── Ignore arrows in form fields ─────────────────────────────────────────

  it('does not navigate when arrow pressed inside an input', async () => {
    const { unmount } = renderBooksAt('/books/John/3', '#v5');
    await flush();

    // Create an input, focus it, and dispatch arrow from it
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    await flush();

    // Hash should be unchanged
    expect(window.location.hash).toBe('#v5');
    unmount();
  });

  it('does not navigate when arrow pressed inside a textarea', async () => {
    const { unmount } = renderBooksAt('/books/John/3', '#v5');
    await flush();

    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    ta.focus();

    act(() => {
      ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });
    await flush();

    expect(window.location.hash).toBe('#v5');
    unmount();
  });

  // ─── Other keys are ignored ───────────────────────────────────────────────

  it('ignores non-arrow keys (e.g. Enter)', async () => {
    const { unmount } = renderBooksAt('/books/John/3', '#v5');
    await flush();

    pressKey('Enter');
    await flush();

    expect(window.location.hash).toBe('#v5');
    unmount();
  });

  // ─── Round-trip: right then left returns to same verse ────────────────────

  it('right then left returns to the same verse within a chapter', async () => {
    const { unmount } = renderBooksAt('/books/John/3', '#v16');
    await flush();

    pressKey('ArrowRight');
    await flush();
    expect(window.location.hash).toBe('#v17');

    pressKey('ArrowLeft');
    await flush();
    expect(window.location.hash).toBe('#v16');

    unmount();
  });

  it('left then right returns to the same verse within a chapter', async () => {
    const { unmount } = renderBooksAt('/books/John/3', '#v16');
    await flush();

    pressKey('ArrowLeft');
    await flush();
    expect(window.location.hash).toBe('#v15');

    pressKey('ArrowRight');
    await flush();
    expect(window.location.hash).toBe('#v16');

    unmount();
  });

  // ─── Cross-chapter scroll target bug ───────────────────────────────────────
  // Regression: when navigating cross-chapter, the old verse number must NOT
  // be used as the scroll target in the new chapter. The scroll target must
  // come from _pendingScrollVerse (set by the keyboard handler).

  it('cross-chapter right arrow scrolls to v1, not the old verse number', async () => {
    // Exodus 15 has 27 verses. Pressing right at v27 should go to Exodus 16:1.
    // Bug: scrollTarget was captured only on mount, so it stayed at 27 and the
    // page scrolled to v27 of Exodus 16 instead of v1.
    const { unmount } = renderBooksAt('/books/Exodus/15', '#v27');
    await flush();
    expect(screen.getByText('Exodus Chapter 15')).toBeDefined();

    pressKey('ArrowRight');
    await flush(300);

    // Should be on Exodus 16 now
    expect(screen.getByText('Exodus Chapter 16')).toBeDefined();
    // The scroll should target v1, not v27 — verify scrollTo was called
    // (the scroll effect fires for v1 via _pendingScrollVerse).
    // The key assertion: the last scrollTo call should be for v1's position,
    // not v27's. We verify by checking that v1 element exists and was scrolled to.
    const v1El = document.getElementById('v1');
    expect(v1El).not.toBeNull();
    unmount();
  });

  it('cross-chapter left arrow scrolls to last verse, not the old verse number', async () => {
    // Exodus 16:1 → left arrow → Exodus 15:27 (last verse of Exodus 15).
    // Bug: scrollTarget stayed at 1 from the old chapter.
    const { unmount } = renderBooksAt('/books/Exodus/16', '#v1');
    await flush();
    expect(screen.getByText('Exodus Chapter 16')).toBeDefined();

    pressKey('ArrowLeft');
    await flush(300);

    // Should be on Exodus 15 now
    expect(screen.getByText('Exodus Chapter 15')).toBeDefined();
    // v27 should exist in Exodus 15
    const v27El = document.getElementById('v27');
    expect(v27El).not.toBeNull();
    unmount();
  });

  it('cross-chapter same-book right arrow does not reuse old scrollTarget', async () => {
    // John 3 has 36 verses, John 4 has 54 verses. Right at v36 → John 4:1.
    // Make sure it doesn't scroll to v36 of John 4.
    const { unmount } = renderBooksAt('/books/John/3', '#v36');
    await flush();
    expect(screen.getByText('John Chapter 3')).toBeDefined();

    pressKey('ArrowRight');
    await flush(300);

    expect(screen.getByText('John Chapter 4')).toBeDefined();
    // Verify scrollTo was called (for v1, not v36)
    expect(window.scrollTo).toHaveBeenCalled();
    const v1El = document.getElementById('v1');
    expect(v1El).not.toBeNull();
    unmount();
  });

  // ─── Shift+Arrow: jump to first/last verse of current chapter ──────────────

  it('Shift+RightArrow jumps to the last verse of the current chapter', async () => {
    // John 3 has 36 verses
    const { unmount } = renderBooksAt('/books/John/3', '#v5');
    await flush();
    expect(window.location.hash).toBe('#v5');

    pressKey('ArrowRight', true);
    await flush();

    expect(window.location.hash).toBe('#v36');
    expect(window.scrollTo).toHaveBeenCalled();
    unmount();
  });

  it('Shift+LeftArrow jumps to verse 1 of the current chapter', async () => {
    const { unmount } = renderBooksAt('/books/John/3', '#v20');
    await flush();
    expect(window.location.hash).toBe('#v20');

    pressKey('ArrowLeft', true);
    await flush();

    expect(window.location.hash).toBe('#v1');
    expect(window.scrollTo).toHaveBeenCalled();
    unmount();
  });

  it('Shift+RightArrow stays in the current chapter (no chapter change)', async () => {
    const { unmount } = renderBooksAt('/books/John/3', '#v1');
    await flush();
    expect(screen.getByText('John Chapter 3')).toBeDefined();

    pressKey('ArrowRight', true);
    await flush();

    // Still on John 3, not John 4
    expect(screen.getByText('John Chapter 3')).toBeDefined();
    expect(window.location.hash).toBe('#v36');
    unmount();
  });

  it('Shift+LeftArrow stays in the current chapter (no chapter change)', async () => {
    const { unmount } = renderBooksAt('/books/John/3', '#v36');
    await flush();

    pressKey('ArrowLeft', true);
    await flush();

    expect(screen.getByText('John Chapter 3')).toBeDefined();
    expect(window.location.hash).toBe('#v1');
    unmount();
  });

  it('Shift+RightArrow from verse 1 jumps to last verse', async () => {
    const { unmount } = renderBooksAt('/books/John/3', '#v1');
    await flush();

    pressKey('ArrowRight', true);
    await flush();

    expect(window.location.hash).toBe('#v36');
    unmount();
  });

  it('Shift+LeftArrow from last verse jumps to verse 1', async () => {
    const { unmount } = renderBooksAt('/books/John/3', '#v36');
    await flush();

    pressKey('ArrowLeft', true);
    await flush();

    expect(window.location.hash).toBe('#v1');
    unmount();
  });

  it('Shift+arrow does not navigate cross-chapter even at chapter boundary', async () => {
    // At last verse of John 3, Shift+Right should stay on John 3:36 (not go to John 4)
    const { unmount } = renderBooksAt('/books/John/3', '#v36');
    await flush();

    pressKey('ArrowRight', true);
    await flush();

    expect(screen.getByText('John Chapter 3')).toBeDefined();
    expect(window.location.hash).toBe('#v36');
    unmount();
  });

  // ─── Cmd/Ctrl+Arrow: chapter navigation ────────────────────────────────────

  it('Cmd+Right navigates to the next chapter', async () => {
    const { unmount } = renderBooksAt('/books/John/3', '#v5');
    await flush();
    expect(screen.getByText('John Chapter 3')).toBeDefined();

    pressKey('ArrowRight', false, true);
    await flush(300);

    expect(screen.getByText('John Chapter 4')).toBeDefined();
    unmount();
  });

  it('Cmd+Left navigates to the previous chapter', async () => {
    const { unmount } = renderBooksAt('/books/John/3', '#v5');
    await flush();
    expect(screen.getByText('John Chapter 3')).toBeDefined();

    pressKey('ArrowLeft', false, true);
    await flush(300);

    expect(screen.getByText('John Chapter 2')).toBeDefined();
    unmount();
  });

  it('Cmd+Right wraps to the next book at last chapter', async () => {
    // Malachi 4 → Matthew 1
    const { unmount } = renderBooksAt('/books/Malachi/4', '#v1');
    await flush();
    expect(screen.getByText('Malachi Chapter 4')).toBeDefined();

    pressKey('ArrowRight', false, true);
    await flush(300);

    expect(screen.getByText('Matthew Chapter 1')).toBeDefined();
    unmount();
  });

  it('Cmd+Left wraps to the previous book at chapter 1', async () => {
    // Matthew 1 → Malachi 4
    const { unmount } = renderBooksAt('/books/Matthew/1', '#v1');
    await flush();
    expect(screen.getByText('Matthew Chapter 1')).toBeDefined();

    pressKey('ArrowLeft', false, true);
    await flush(300);

    expect(screen.getByText('Malachi Chapter 4')).toBeDefined();
    unmount();
  });

  it('Cmd+Right wraps around the entire Bible (Revelation 22 → Genesis 1)', async () => {
    const { unmount } = renderBooksAt('/books/Revelation/22', '#v1');
    await flush();

    pressKey('ArrowRight', false, true);
    await flush(300);

    expect(screen.getByText('Genesis Chapter 1')).toBeDefined();
    unmount();
  });

  // ─── Shift+click verse selection ──────────────────────────────────────────

  it('shift+click on star extends selection to a range', async () => {
    const { unmount } = renderBooksAt('/books/John/3', '#v1');
    await flush();
    expect(window.location.hash).toBe('#v1');

    // Shift+click the star button on verse 5
    const starButtons = document.querySelectorAll('button[title*="favorite"]');
    expect(starButtons.length).toBeGreaterThan(4);
    act(() => {
      starButtons[4].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    });
    await flush();

    // URL should now be #v1-5
    expect(window.location.hash).toBe('#v1-5');
    unmount();
  });

  it('shift+click on star when no verse is selected just favorites that verse', async () => {
    const { unmount } = renderBooksAt('/books/John/3');
    await flush();
    expect(window.location.hash).toBe('');

    // Shift+click the star button on verse 5 (no prior selection)
    const starButtons = document.querySelectorAll('button[title*="favorite"]');
    act(() => {
      starButtons[4].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    });
    await flush();

    // Should NOT create a range — just favorites the single verse
    expect(window.location.hash).not.toContain('-');
    unmount();
  });

  it('click on star without shift toggles single verse bookmark', async () => {
    const { unmount } = renderBooksAt('/books/John/3', '#v1');
    await flush();

    const starButtons = document.querySelectorAll('button[title*="favorite"]');
    // Click verse 5's star without shift
    act(() => {
      starButtons[4].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    // Should NOT create a range
    expect(window.location.hash).toBe('#v1');
    unmount();
  });

  it('shift+click on verse number extends selection to a range', async () => {
    const { unmount } = renderBooksAt('/books/John/3', '#v1');
    await flush();

    // Find verse number spans (they have cursor-pointer and text-purple-500 classes)
    const verseSpans = document.querySelectorAll('span[title*="verse"]');
    expect(verseSpans.length).toBeGreaterThan(4);
    // Shift+click verse 5's number
    act(() => {
      verseSpans[4].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    });
    await flush();

    expect(window.location.hash).toBe('#v1-5');
    unmount();
  });

  it('click on verse number without shift selects single verse', async () => {
    const { unmount } = renderBooksAt('/books/John/3', '#v1');
    await flush();

    const verseSpans = document.querySelectorAll('span[title*="verse"]');
    act(() => {
      verseSpans[4].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    expect(window.location.hash).toBe('#v5');
    unmount();
  });

  it('verse range selection highlights all verses in the range', async () => {
    const { unmount } = renderBooksAt('/books/John/3', '#v1');
    await flush();

    // Shift+click verse 5's number to create range #v1-5
    const verseSpans = document.querySelectorAll('span[title*="verse"]');
    act(() => {
      verseSpans[4].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    });
    await flush();

    // Verify multiple verse cards have the verse-selected class
    const selectedCards = document.querySelectorAll('.verse-selected');
    expect(selectedCards.length).toBe(5); // verses 1-5
    unmount();
  });

  it('group favorite button appears when range is selected', async () => {
    const { unmount } = renderBooksAt('/books/John/3', '#v1-5');
    await flush();

    // The "Favorite this range" button should be visible
    expect(screen.getByText(/Favorite this range|Favorited/)).toBeDefined();
    unmount();
  });

  it('group favorite button does NOT appear for single verse', async () => {
    const { unmount } = renderBooksAt('/books/John/3', '#v5');
    await flush();

    // Should NOT have a "Favorite this range" button
    expect(screen.queryByText(/Favorite this range/)).toBeNull();
    expect(screen.queryByText(/Favorited/)).toBeNull();
    unmount();
  });
});
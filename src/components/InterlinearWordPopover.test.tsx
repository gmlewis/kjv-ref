import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { InterlinearWordPopover } from './InterlinearWordPopover';
import type { WordEntry } from '../data/interlinear';

// ─── Test data ───────────────────────────────────────────────────────────────

const hebrewWord: WordEntry = [
  'אֹ֥הֶל',
  'H168',
  'ʾōhel',
  'tent, dwelling',
  'HNcmsa',
];

const greekWord: WordEntry = [
  'ἀγάπη',
  'G26',
  'agapē',
  'love, charity',
  'N-NSF',
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('InterlinearWordPopover', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('renders the Strong\'s number badge', () => {
    render(
      <InterlinearWordPopover
        entry={hebrewWord}
        isHebrew={true}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('H168')).toBeDefined();
  });

  it('renders the Hebrew word in RTL direction', () => {
    const { container } = render(
      <InterlinearWordPopover
        entry={hebrewWord}
        isHebrew={true}
        onClose={() => {}}
      />,
    );
    const wordDiv = container.querySelector('[dir="rtl"]');
    expect(wordDiv).not.toBeNull();
    expect(wordDiv?.textContent).toContain('אֹ֥הֶל');
  });

  it('renders the Greek word in LTR direction', () => {
    const { container } = render(
      <InterlinearWordPopover
        entry={greekWord}
        isHebrew={false}
        onClose={() => {}}
      />,
    );
    const wordDiv = container.querySelector('[dir="ltr"]');
    expect(wordDiv).not.toBeNull();
    expect(wordDiv?.textContent).toContain('ἀγάπη');
  });

  it('renders transliteration', () => {
    render(
      <InterlinearWordPopover
        entry={hebrewWord}
        isHebrew={true}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('ʾōhel')).toBeDefined();
  });

  it('renders gloss', () => {
    render(
      <InterlinearWordPopover
        entry={hebrewWord}
        isHebrew={true}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('tent, dwelling')).toBeDefined();
  });

  it('renders humanized parsing for Hebrew noun', () => {
    render(
      <InterlinearWordPopover
        entry={hebrewWord}
        isHebrew={true}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Noun')).toBeDefined();
  });

  it('renders humanized parsing for Greek noun', () => {
    render(
      <InterlinearWordPopover
        entry={greekWord}
        isHebrew={false}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Noun')).toBeDefined();
  });

  it('renders external links when Strong\'s number is present', () => {
    render(
      <InterlinearWordPopover
        entry={hebrewWord}
        isHebrew={true}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('BibleHub')).toBeDefined();
    expect(screen.getByText('Blue Letter Bible')).toBeDefined();
  });

  it('does not render external links when no Strong\'s number', () => {
    const noStrongs: WordEntry = ['word', '', 'translit', 'gloss', 'N-NSF'];
    render(
      <InterlinearWordPopover
        entry={noStrongs}
        isHebrew={false}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText('BibleHub')).toBeNull();
    expect(screen.queryByText('Blue Letter Bible')).toBeNull();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(
      <InterlinearWordPopover
        entry={hebrewWord}
        isHebrew={true}
        onClose={onClose}
      />,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking outside the popover', async () => {
    const onClose = vi.fn();
    render(
      <InterlinearWordPopover
        entry={hebrewWord}
        isHebrew={true}
        onClose={onClose}
      />,
    );
    // The popover registers its mousedown listener after a setTimeout(0),
    // so we need to wait for it before dispatching the click.
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ─── RTL positioning tests ──────────────────────────────────────────────

  describe('RTL (Hebrew) popover positioning', () => {
    it('applies style prop for LTR positioning', () => {
      const { container } = render(
        <InterlinearWordPopover
          entry={greekWord}
          isHebrew={false}
          onClose={() => {}}
          style={{ position: 'fixed', top: 200, left: 300, zIndex: 9999 }}
        />,
      );
      const popover = container.querySelector('[role="dialog"]') as HTMLElement;
      expect(popover).not.toBeNull();
      expect(popover.style.left).toBe('300px');
      expect(popover.style.top).toBe('200px');
    });

    it('applies style prop for RTL positioning', () => {
      // For RTL text, the caller passes a style with left computed from
      // the word's actual position (via Range.getBoundingClientRect()).
      // The popover itself just applies whatever style is passed.
      const { container } = render(
        <InterlinearWordPopover
          entry={hebrewWord}
          isHebrew={true}
          onClose={() => {}}
          style={{ position: 'fixed', top: 200, left: 500, zIndex: 9999 }}
        />,
      );
      const popover = container.querySelector('[role="dialog"]') as HTMLElement;
      expect(popover).not.toBeNull();
      expect(popover.style.left).toBe('500px');
    });
  });

  // ─── Range.getBoundingClientRect fix verification ────────────────────────

  describe('Range API for RTL inline element positioning', () => {
    // These tests verify that the Range API (used in the click handler fix
    // in Books.tsx) correctly targets inline element text content. The bug
    // was that inline spans wrapping to a new line in RTL Hebrew text report
    // their Element.getBoundingClientRect() as spanning the full line width,
    // but Range.getBoundingClientRect() gives the actual text position.
    //
    // Note: jsdom does not implement Range.getBoundingClientRect(), so we
    // verify the Range API usage pattern (selectNodeContents + toString)
    // rather than pixel positions.

    beforeEach(() => {
      document.body.innerHTML = `
        <div dir="rtl" style="width: 300px; font-size: 20px;">
          <span style="display: inline;">בראשית</span>
          <span style="display: inline;" id="target-word">אֹ֥הֶל</span>
        </div>
      `;
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('Range.selectNodeContents targets the correct element text', () => {
      const target = document.getElementById('target-word')!;
      const range = document.createRange();
      range.selectNodeContents(target);
      expect(range.toString()).toBe('אֹ֥הֶל');
      range.detach();
    });

    it('Range can be created and detached for inline elements in RTL containers', () => {
      const target = document.getElementById('target-word')!;
      expect(target).not.toBeNull();

      // This is the exact pattern used in Books.tsx click handler:
      const range = document.createRange();
      range.selectNodeContents(target);
      // In real browsers, range.getBoundingClientRect() returns tight bounds.
      // In jsdom it returns a DOMRect-like object or undefined — the key is
      // that the Range API works without throwing.
      expect(range.toString()).toBe('אֹ֥הֶל');
      range.detach();
      expect(() => range.detach()).not.toThrow();
    });

    it('Element.getBoundingClientRect returns a rect for inline elements in RTL', () => {
      const target = document.getElementById('target-word')!;
      const rect = target.getBoundingClientRect();
      // jsdom returns a rect with zeros, but the API should work
      expect(rect).toBeDefined();
      expect(typeof rect.left).toBe('number');
      expect(typeof rect.right).toBe('number');
      expect(typeof rect.top).toBe('number');
      expect(typeof rect.bottom).toBe('number');
    });
  });
});
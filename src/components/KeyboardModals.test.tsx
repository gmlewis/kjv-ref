import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ShortcutsModal, SearchModal } from './KeyboardModals';

// Mock useNavigate so we can spy on navigation calls
const navigateSpy = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderModal(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function pressKey(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

// ─── ShortcutsModal tests ────────────────────────────────────────────────────

describe('ShortcutsModal', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('renders the modal with title', () => {
    renderModal(<ShortcutsModal onClose={() => {}} />);
    expect(screen.getByText('Keyboard Shortcuts')).toBeDefined();
  });

  it('lists all shortcut entries', () => {
    renderModal(<ShortcutsModal onClose={() => {}} />);
    expect(screen.getByText(/Show this keyboard shortcuts help/)).toBeDefined();
    expect(screen.getByText(/Open full-Bible search dialog/)).toBeDefined();
    expect(screen.getByText(/Advance to the next verse/)).toBeDefined();
    expect(screen.getByText(/Go back to the previous verse/)).toBeDefined();
    expect(screen.getByText(/Jump to the last verse/)).toBeDefined();
    expect(screen.getByText(/Jump to verse 1/)).toBeDefined();
  });

  it('calls onClose when any key is pressed', () => {
    const onClose = vi.fn();
    renderModal(<ShortcutsModal onClose={onClose} />);
    pressKey('a');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    renderModal(<ShortcutsModal onClose={onClose} />);
    pressKey('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the overlay', () => {
    const onClose = vi.fn();
    renderModal(<ShortcutsModal onClose={onClose} />);
    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).not.toBeNull();
    act(() => { fireEvent.click(overlay!); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the X button', () => {
    const onClose = vi.fn();
    renderModal(<ShortcutsModal onClose={onClose} />);
    const closeBtn = document.querySelector('.modal-close-btn');
    expect(closeBtn).not.toBeNull();
    act(() => { fireEvent.click(closeBtn!); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the card', () => {
    const onClose = vi.fn();
    renderModal(<ShortcutsModal onClose={onClose} />);
    const card = document.querySelector('.modal-card');
    act(() => { fireEvent.click(card!); });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows "Press any key to close" hint', () => {
    renderModal(<ShortcutsModal onClose={() => {}} />);
    expect(screen.getByText('Press any key to close')).toBeDefined();
  });
});

// ─── SearchModal tests ───────────────────────────────────────────────────────

describe('SearchModal', () => {
  beforeEach(() => { navigateSpy.mockClear(); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('renders the modal with title', () => {
    renderModal(<SearchModal onClose={() => {}} />);
    // Title is in an h2
    const title = document.querySelector('.modal-title');
    expect(title?.textContent).toBe('Search Full Bible');
  });

  it('renders a search input with placeholder', () => {
    renderModal(<SearchModal onClose={() => {}} />);
    const input = document.querySelector('.modal-search-input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.placeholder).toContain('24,857 verses');
  });

  it('auto-focuses the input on mount', () => {
    renderModal(<SearchModal onClose={() => {}} />);
    const input = document.querySelector('.modal-search-input') as HTMLInputElement;
    expect(document.activeElement).toBe(input);
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    renderModal(<SearchModal onClose={onClose} />);
    pressKey('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when non-Escape key is pressed', () => {
    const onClose = vi.fn();
    renderModal(<SearchModal onClose={onClose} />);
    pressKey('a');
    pressKey('b');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when clicking the overlay', () => {
    const onClose = vi.fn();
    renderModal(<SearchModal onClose={onClose} />);
    const overlay = document.querySelector('.modal-overlay');
    act(() => { fireEvent.click(overlay!); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('navigates to /books?search=... when form is submitted', () => {
    renderModal(<SearchModal onClose={() => {}} />);
    const input = document.querySelector('.modal-search-input') as HTMLInputElement;
    act(() => { fireEvent.change(input, { target: { value: 'love' } }); });
    act(() => { fireEvent.submit(input.closest('form')!); });
    expect(navigateSpy).toHaveBeenCalledWith('/books?search=love');
  });

  it('calls onClose after submitting search', () => {
    const onClose = vi.fn();
    renderModal(<SearchModal onClose={onClose} />);
    const input = document.querySelector('.modal-search-input') as HTMLInputElement;
    act(() => { fireEvent.change(input, { target: { value: 'love' } }); });
    act(() => { fireEvent.submit(input.closest('form')!); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not navigate when search is empty (just closes)', () => {
    const onClose = vi.fn();
    renderModal(<SearchModal onClose={onClose} />);
    const input = document.querySelector('.modal-search-input') as HTMLInputElement;
    act(() => { fireEvent.change(input, { target: { value: '   ' } }); });
    act(() => { fireEvent.submit(input.closest('form')!); });
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders the "Search Full Bible" button', () => {
    renderModal(<SearchModal onClose={() => {}} />);
    const btn = document.querySelector('.modal-search-btn');
    expect(btn?.textContent).toContain('Search Full Bible');
  });

  it('encodes the search query in the URL', () => {
    renderModal(<SearchModal onClose={() => {}} />);
    const input = document.querySelector('.modal-search-input') as HTMLInputElement;
    act(() => { fireEvent.change(input, { target: { value: 'love|charity' } }); });
    act(() => { fireEvent.submit(input.closest('form')!); });
    expect(navigateSpy).toHaveBeenCalledWith('/books?search=love%7Ccharity');
  });

  it('clicking the Search button submits the form', () => {
    renderModal(<SearchModal onClose={() => {}} />);
    const input = document.querySelector('.modal-search-input') as HTMLInputElement;
    act(() => { fireEvent.change(input, { target: { value: 'grace' } }); });
    const btn = document.querySelector('.modal-search-btn') as HTMLButtonElement;
    act(() => { fireEvent.click(btn); });
    expect(navigateSpy).toHaveBeenCalledWith('/books?search=grace');
  });
});
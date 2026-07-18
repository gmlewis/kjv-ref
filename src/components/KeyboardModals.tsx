import { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, X, Keyboard, ArrowLeft, ArrowRight, ChevronUp, ChevronDown, BookOpen, Moon, Sun, Home, Plus, Minus, CornerDownLeft } from 'lucide-react';
import { searchBibleReferences, type BibleRefMatch } from '../utils/bibleRefSearch';

// ─── Keyboard Shortcuts Modal (? key) ────────────────────────────────────────

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const shortcuts = [
    { keys: ['?'], icon: Keyboard, desc: 'Show this keyboard shortcuts help' },
    { keys: ['/'], icon: Search, desc: 'Open full-Bible search dialog' },
    { keys: ['\u2192'], icon: ArrowRight, desc: 'Next verse (wraps across chapters and books)' },
    { keys: ['\u2190'], icon: ArrowLeft, desc: 'Previous verse (wraps across chapters and books)' },
    { keys: ['Shift', '\u2192'], icon: ChevronDown, desc: 'Jump to the last verse of the current chapter' },
    { keys: ['Shift', '\u2190'], icon: ChevronUp, desc: 'Jump to verse 1 of the current chapter' },
    { keys: ['\u2318', '\u2192'], icon: BookOpen, desc: 'Next chapter (same as the button)' },
    { keys: ['\u2318', '\u2190'], icon: BookOpen, desc: 'Previous chapter (same as the button)' },
    { keys: ['g'], icon: BookOpen, desc: 'Go to the book list' },
    { keys: ['t'], icon: Moon, desc: 'Toggle dark / light theme' },
    { keys: ['+'], icon: Plus, desc: 'Increase verse text size' },
    { keys: ['\u2212'], icon: Minus, desc: 'Decrease verse text size' },
    { keys: ['Home'], icon: Home, desc: 'Scroll to the top of the page' },
    { keys: ['End'], icon: CornerDownLeft, desc: 'Scroll to the bottom of the page' },
    { keys: ['Esc'], icon: X, desc: 'Close this dialog (or any open popover)' },
  ];

  return (
    <ModalOverlay onClose={onClose}>
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-icon-wrapper">
            <Keyboard className="w-8 h-8 text-white" />
          </div>
          <h2 className="modal-title">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="modal-close-btn">
            <X className="w-12 h-12" />
          </button>
        </div>
        <div className="modal-body">
          <div className="shortcut-columns">
            {shortcuts.map((s, i) => (
              <div key={i} className="shortcut-row">
                <div className="shortcut-keys">
                  {s.keys.map((k, j) => (
                    <span key={j} className={j > 0 ? 'kbd-key kbd-plus' : 'kbd-key'}>
                      {j > 0 && <span className="text-gray-400 mx-0.5">+</span>}
                      {k}
                    </span>
                  ))}
                </div>
                <div className="shortcut-desc">
                  <s.icon className="w-10 h-10 text-purple-500 flex-shrink-0" />
                  <span>{s.desc}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="modal-footer-hint">Press any key to close</p>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── Search Modal (/ key) ────────────────────────────────────────────────────

export function SearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Live Bible reference matches as the user types
  const refMatches = useMemo(() => searchBibleReferences(query, 5), [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  // Reset selection when matches change
  useEffect(() => { setSelectedIndex(0); }, [refMatches]);

  const goToRef = (match: BibleRefMatch) => {
    const hash = match.verseEnd && match.verseEnd !== match.verse
      ? `#v${match.verse}-${match.verseEnd}`
      : `#v${match.verse}`;
    navigate(`/books/${encodeURIComponent(match.book)}/${match.chapter}${hash}`);
    onClose();
  };

  const submitSearch = () => {
    const q = query.trim();
    if (!q) { onClose(); return; }
    // If there's a reference match selected, navigate to it
    if (refMatches.length > 0 && selectedIndex < refMatches.length) {
      goToRef(refMatches[selectedIndex]);
      return;
    }
    // Otherwise, do a full-text search
    navigate(`/books?search=${encodeURIComponent(q)}`);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && refMatches.length > 0) {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, refMatches.length - 1));
    } else if (e.key === 'ArrowUp' && refMatches.length > 0) {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-icon-wrapper">
            <Search className="w-8 h-8 text-white" />
          </div>
          <h2 className="modal-title">Search Full Bible</h2>
          <button onClick={onClose} className="modal-close-btn">
            <X className="w-12 h-12" />
          </button>
        </div>
        <div className="modal-body">
          <form
            onSubmit={(e) => { e.preventDefault(); submitSearch(); }}
            className="space-y-4"
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='Search verses or jump to a reference (e.g. "jn3:16", "ps23", "1 john")'
              className="modal-search-input"
            />

            {/* Live Bible reference matches */}
            {refMatches.length > 0 && (
              <div className="modal-ref-matches">
                {refMatches.map((m, i) => (
                  <button
                    key={m.reference}
                    type="button"
                    onClick={() => goToRef(m)}
                    className={`modal-ref-match ${i === selectedIndex ? 'modal-ref-match-selected' : ''}`}
                  >
                    <BookOpen className="w-5 h-5 text-purple-500 flex-shrink-0" />
                    <span className="modal-ref-match-text">{m.reference}</span>
                    <span className="modal-ref-match-hint">Go to verse</span>
                  </button>
                ))}
              </div>
            )}

            <p className="modal-search-hint">
              Press <span className="kbd-key inline">Enter</span> to search or{' '}
              <span className="kbd-key inline">Esc</span> to cancel
            </p>
            <button type="submit" className="modal-search-btn">
              <Search className="w-10 h-10" />
              <span>Search Full Bible</span>
            </button>
          </form>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── Shared modal overlay ────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  // Render via portal on document.body so the modal escapes any ancestor
  // that has backdrop-filter (which creates a containing block for fixed
  // positioning, causing the modal to be constrained to the nav bar).
  return createPortal(
    <div
      className="modal-overlay"
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} className="modal-content-wrapper">
        {children}
      </div>
    </div>,
    document.body,
  );
}
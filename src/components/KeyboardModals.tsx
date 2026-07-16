import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, X, Keyboard, ArrowLeft, ArrowRight, ChevronUp, ChevronDown, BookOpen, Moon, Sun, Home, Plus, Minus, CornerDownLeft } from 'lucide-react';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape; all other keys are captured so they type into the input
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

  const submitSearch = () => {
    const q = query.trim();
    if (!q) { onClose(); return; }
    navigate(`/books?search=${encodeURIComponent(q)}`);
    onClose();
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
              placeholder='Search all 24,857 verses… try "phrase", lov*, |, -exclude'
              className="modal-search-input"
            />
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
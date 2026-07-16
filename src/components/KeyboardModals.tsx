import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Keyboard, ArrowLeft, ArrowRight, ChevronUp, ChevronDown } from 'lucide-react';

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
    { keys: ['\u2192'], icon: ArrowRight, desc: 'Advance to the next verse (wraps across chapters and books)' },
    { keys: ['\u2190'], icon: ArrowLeft, desc: 'Go back to the previous verse (wraps across chapters and books)' },
    { keys: ['Shift', '\u2192'], icon: ChevronDown, desc: 'Jump to the last verse of the current chapter' },
    { keys: ['Shift', '\u2190'], icon: ChevronUp, desc: 'Jump to verse 1 of the current chapter' },
    { keys: ['Esc'], icon: X, desc: 'Close this dialog (or any open popover)' },
  ];

  return (
    <ModalOverlay onClose={onClose}>
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-icon-wrapper">
            <Keyboard className="w-7 h-7 text-white" />
          </div>
          <h2 className="modal-title">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="modal-close-btn">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body">
          <div className="space-y-2">
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
                  <s.icon className="w-4 h-4 text-purple-500 flex-shrink-0" />
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
            <Search className="w-7 h-7 text-white" />
          </div>
          <h2 className="modal-title">Search Full Bible</h2>
          <button onClick={onClose} className="modal-close-btn">
            <X className="w-5 h-5" />
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
              <Search className="w-5 h-5" />
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
  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} className="modal-content-wrapper">
        {children}
      </div>
    </div>
  );
}
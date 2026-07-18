import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Dumbbell, BarChart3, Trophy, Menu, X, LayoutDashboard, Moon, Sun, ArrowUp, Download, Upload } from 'lucide-react';
import { ShortcutsModal, SearchModal } from './KeyboardModals';
import Tutorial from './Tutorial';
import { downloadSettings, importSettings, type ImportResult } from '../utils/settingsTransfer';

function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  const [showTop, setShowTop] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [importToast, setImportToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownload = useCallback(() => {
    downloadSettings();
  }, []);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = importSettings(String(reader.result));
        setImportToast(
          result.addedBookmarks > 0
            ? `Imported ${result.addedBookmarks} favorite${result.addedBookmarks !== 1 ? 's' : ''} (${result.skippedDuplicates} already present)`
            : `No new favorites to import (${result.skippedDuplicates} already present)`,
        );
      } catch (err) {
        setImportToast(`Import failed: ${(err as Error).message}`);
      }
      setTimeout(() => setImportToast(null), 4000);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const toggleDark = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('kjv-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('kjv-theme', 'light');
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        navigate('/books');
        return;
      }
      // Only handle shortcuts when no modal is open and not typing in an input
      if (showShortcuts || showSearch) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      }

      // ? — shortcuts help
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }
      // / — search dialog
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setShowSearch(true);
        return;
      }
      // g — go to book list
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        navigate('/books');
        return;
      }
      // t — toggle dark/light theme
      if (e.key === 't' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        toggleDark();
        return;
      }
      // Home — scroll to top of page
      if (e.key === 'Home' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      // End — scroll to bottom of page
      if (e.key === 'End' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, showShortcuts, showSearch, toggleDark]);

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/practice', icon: Dumbbell, label: 'Practice' },
    { path: '/books', icon: BookOpen, label: 'Books' },
    { path: '/statistics', icon: BarChart3, label: 'Stats' },
    { path: '/achievements', icon: Trophy, label: 'Awards' },
  ];

  const isActive = (itemPath: string) => {
    if (itemPath === '/') return path === '/';
    return path.startsWith(itemPath);
  };

  return (
    <nav className="glassmorphism sticky top-0 z-50 shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-18">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg group-hover:shadow-xl transition-shadow">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <div>
              <span className="text-2xl font-bold gradient-text">KJV Memorize</span>
              <p className="text-xs text-gray-500">Hide God's Word in your heart</p>
            </div>
          </Link>

          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item flex items-center space-x-2 px-4 py-3 rounded-xl transition-all ${
                  isActive(item.path)
                    ? 'bg-gradient-to-r from-purple-100 to-indigo-100 shadow-md'
                    : 'hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive(item.path) ? 'text-purple-700' : 'text-purple-500'}`} />
                <span className={`font-semibold ${isActive(item.path) ? 'text-purple-700' : 'text-gray-700'}`}>{item.label}</span>
              </Link>
            ))}

            {/* Dark mode toggle */}
            <button
              onClick={toggleDark}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="ml-2 p-2.5 rounded-xl hover:bg-purple-100 transition-colors"
            >
              {isDark
                ? <Sun className="w-5 h-5 text-yellow-400" />
                : <Moon className="w-5 h-5 text-purple-500" />
              }
            </button>
            {/* Download settings */}
            <button
              onClick={handleDownload}
              title="Download KJV-ref settings"
              className="p-2.5 rounded-xl hover:bg-purple-100 transition-colors"
            >
              <Download className="w-5 h-5 text-purple-500" />
            </button>
            {/* Import settings */}
            <button
              onClick={handleImportClick}
              title="Import KJV-ref settings"
              className="p-2.5 rounded-xl hover:bg-purple-100 transition-colors"
            >
              <Upload className="w-5 h-5 text-purple-500" />
            </button>
            <a
               href="https://github.com/gmlewis/kjv-ref"
               target="_blank"
               rel="noopener noreferrer"
               title="View source on GitHub"
               className="p-2.5 rounded-xl hover:bg-purple-100 transition-colors"
             >
               <svg className="w-5 h-5 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
                 <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
               </svg>
             </a>
          </div>

          <div className="md:hidden flex items-center gap-2">
            {/* Dark mode toggle (mobile) */}
            <button
              onClick={toggleDark}
              className="p-2 rounded-xl hover:bg-purple-100 transition-colors"
            >
              {isDark
                ? <Sun className="w-5 h-5 text-yellow-400" />
                : <Moon className="w-5 h-5 text-purple-500" />
              }
             </button>
             {/* Download settings (mobile) */}
             <button
               onClick={handleDownload}
               title="Download KJV-ref settings"
               className="p-2 rounded-xl hover:bg-purple-100 transition-colors"
             >
               <Download className="w-5 h-5 text-purple-500" />
             </button>
             {/* Import settings (mobile) */}
             <button
               onClick={handleImportClick}
               title="Import KJV-ref settings"
               className="p-2 rounded-xl hover:bg-purple-100 transition-colors"
             >
               <Upload className="w-5 h-5 text-purple-500" />
             </button>
             <a
               href="https://github.com/gmlewis/kjv-ref"
               target="_blank"
               rel="noopener noreferrer"
               title="View source on GitHub"
               className="p-2 rounded-xl hover:bg-purple-100 transition-colors"
             >
              <svg className="w-5 h-5 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
            </a>
            <button
              className="p-2 rounded-xl hover:bg-purple-100 transition-colors"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X className="w-6 h-6 text-purple-600" /> : <Menu className="w-6 h-6 text-purple-600" />}
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="md:hidden py-4 border-t border-purple-200 animate-fade-in">
            {navItems.map((item) => (
              <div
                key={item.path}
                onClick={() => { navigate(item.path); setIsOpen(false); }}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all cursor-pointer mb-1 ${
                  isActive(item.path)
                    ? 'bg-gradient-to-r from-purple-100 to-indigo-100'
                    : 'hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive(item.path) ? 'text-purple-700' : 'text-purple-500'}`} />
                <span className={`font-semibold ${isActive(item.path) ? 'text-purple-700' : 'text-gray-700'}`}>{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-110"
          title="Scroll to top"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} onLaunchTutorial={() => { setShowShortcuts(false); setShowTutorial(true); }} />}
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}

      {/* Hidden file input for settings import */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleImportFile}
        style={{ display: 'none' }}
      />

      {/* Import toast notification */}
      {importToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg font-semibold text-sm animate-fade-in">
          {importToast}
        </div>
      )}
    </nav>
  );
}

export default Navigation;

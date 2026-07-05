import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Dumbbell, BarChart3, Trophy, Menu, X, LayoutDashboard, Moon, Sun } from 'lucide-react';

function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('kjv-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('kjv-theme', 'light');
    }
  };

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
    </nav>
  );
}

export default Navigation;

import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const navItems = [
  { to: '/diary', label: 'Daily Plan' },
  { to: '/foods', label: 'Foods' },
  { to: '/recipes', label: 'Recipes' },
  { to: '/shopping-list', label: 'Shopping List' },
  { to: '/household', label: 'Household' },
  { to: '/settings', label: 'Settings' },
];

const desktopLinkClass = ({ isActive }) => `hover:underline ${isActive ? 'font-semibold underline' : ''}`;
const mobileLinkClass = ({ isActive }) => `block py-2 ${isActive ? 'font-semibold underline' : ''}`;

// Sun/moon icon reflecting what's actually displayed, so it reads as
// "click to switch to the other one" regardless of the underlying
// light/dark/system setting.
function ThemeToggleButton({ className }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={className}
    >
      {isDark ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5" />
          <path
            strokeLinecap="round"
            d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
          />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const headerRef = useRef(null);

  // Any navigation (including the browser back/forward buttons) should close the menu.
  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  // Exposes the nav bar's real rendered height as a CSS variable, so pages
  // (e.g. Daily Plan) can stick their own sticky headers exactly below it
  // instead of guessing a pixel offset.
  useEffect(() => {
    const headerEl = headerRef.current;
    if (!headerEl) return undefined;
    const updateHeight = () => {
      document.documentElement.style.setProperty('--app-header-height', `${headerEl.offsetHeight}px`);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(headerEl);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header ref={headerRef} className="sticky top-0 z-30 bg-emerald-700 text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-semibold text-lg">Macro Planner</span>

          <nav className="hidden sm:flex gap-4 text-sm">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={desktopLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden sm:flex items-center gap-3 text-sm">
            <span>{user?.name}</span>
            <ThemeToggleButton className="p-1.5 rounded hover:bg-emerald-800" />
            <button onClick={logout} className="bg-emerald-900 px-3 py-1 rounded hover:bg-emerald-800">
              Log out
            </button>
          </div>

          <button
            onClick={() => setMenuOpen((open) => !open)}
            className="sm:hidden p-2 -mr-2"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="sm:hidden border-t border-emerald-600 px-4 py-2 text-sm">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={mobileLinkClass}>
                {item.label}
              </NavLink>
            ))}
            <div className="flex items-center justify-between border-t border-emerald-600 mt-2 pt-3">
              <span>{user?.name}</span>
              <div className="flex items-center gap-2">
                <ThemeToggleButton className="p-1.5 rounded hover:bg-emerald-800" />
                <button onClick={logout} className="bg-emerald-900 px-3 py-1 rounded hover:bg-emerald-800">
                  Log out
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

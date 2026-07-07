import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

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

export default function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Any navigation (including the browser back/forward buttons) should close the menu.
  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-emerald-700 text-white">
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
              <button onClick={logout} className="bg-emerald-900 px-3 py-1 rounded hover:bg-emerald-800">
                Log out
              </button>
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

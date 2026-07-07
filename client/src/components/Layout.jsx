import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const navItems = [
  { to: '/diary', label: 'Daily Plan' },
  { to: '/foods', label: 'Foods' },
  { to: '/recipes', label: 'Recipes' },
  { to: '/shopping-list', label: 'Shopping List' },
  { to: '/household', label: 'Household' },
  { to: '/settings', label: 'Settings' },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-emerald-700 text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-semibold text-lg">Macro Planner</span>
          <nav className="flex gap-4 text-sm">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `hover:underline ${isActive ? 'font-semibold underline' : ''}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span>{user?.name}</span>
            <button onClick={logout} className="bg-emerald-900 px-3 py-1 rounded hover:bg-emerald-800">
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

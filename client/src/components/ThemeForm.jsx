import React from 'react';
import { useTheme } from '../context/ThemeContext.jsx';

const OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Match system' },
];

export default function ThemeForm() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="bg-white dark:bg-slate-800 shadow rounded p-4 space-y-3">
      <h2 className="font-medium">Theme</h2>
      <div className="flex gap-4 text-sm">
        {OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-1.5">
            <input
              type="radio"
              name="theme"
              checked={theme === opt.value}
              onChange={() => setTheme(opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

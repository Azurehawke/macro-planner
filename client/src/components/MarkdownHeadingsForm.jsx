import React, { useState } from 'react';
import { HEADING_LEVELS, HEADING_LEVELS_STORAGE_KEY, loadHeadingLevels } from '../utils/markdownHeadingLevels.js';

export default function MarkdownHeadingsForm() {
  const [levels, setLevels] = useState(loadHeadingLevels);
  const [saved, setSaved] = useState(false);

  const save = (e) => {
    e.preventDefault();
    localStorage.setItem(HEADING_LEVELS_STORAGE_KEY, JSON.stringify(levels));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <form onSubmit={save} className="bg-white dark:bg-slate-800 shadow rounded p-4 space-y-3">
      <div>
        <h2 className="font-medium">Markdown export headings</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Controls the heading levels used when you copy or download the Daily Plan as markdown — handy
          if you're pasting it into a bigger notes document where a bare H1/H2 would clash.
        </p>
      </div>
      <div className="flex gap-4">
        <label className="text-sm">
          <span className="block text-slate-500 dark:text-slate-400 mb-1">Title</span>
          <select
            value={levels.title}
            onChange={(e) => setLevels((prev) => ({ ...prev, title: Number(e.target.value) }))}
            className="border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
          >
            {HEADING_LEVELS.map((l) => (
              <option key={l} value={l}>
                H{l}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-slate-500 dark:text-slate-400 mb-1">Sections</span>
          <select
            value={levels.section}
            onChange={(e) => setLevels((prev) => ({ ...prev, section: Number(e.target.value) }))}
            className="border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
          >
            {HEADING_LEVELS.map((l) => (
              <option key={l} value={l}>
                H{l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button type="submit" className="bg-emerald-700 text-white rounded px-4 py-2 hover:bg-emerald-800">
        Save
      </button>
      {saved && <span className="text-emerald-700 dark:text-emerald-400 text-sm ml-2">Saved!</span>}
    </form>
  );
}

import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function MacroGoalsForm() {
  const { user, setUser } = useAuth();
  const [goals, setGoals] = useState({
    daily_carbs_goal_g: user?.daily_carbs_goal_g || '',
    daily_fat_goal_g: user?.daily_fat_goal_g || '',
    daily_protein_goal_g: user?.daily_protein_goal_g || '',
  });
  const [saved, setSaved] = useState(false);

  // Keep this in sync if the goals were updated elsewhere (e.g. the macro
  // calculator below saving directly to the same user fields).
  useEffect(() => {
    setGoals({
      daily_carbs_goal_g: user?.daily_carbs_goal_g || '',
      daily_fat_goal_g: user?.daily_fat_goal_g || '',
      daily_protein_goal_g: user?.daily_protein_goal_g || '',
    });
  }, [user?.daily_carbs_goal_g, user?.daily_fat_goal_g, user?.daily_protein_goal_g]);

  const saveGoals = async (e) => {
    e.preventDefault();
    const { user: updated } = await api.put('/auth/me/goals', {
      daily_carbs_goal_g: goals.daily_carbs_goal_g || null,
      daily_fat_goal_g: goals.daily_fat_goal_g || null,
      daily_protein_goal_g: goals.daily_protein_goal_g || null,
    });
    setUser(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <form onSubmit={saveGoals} className="bg-white dark:bg-slate-800 shadow rounded p-4 space-y-3">
      <h2 className="font-medium">Daily macro goals</h2>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Carbs (g)</label>
          <input
            type="number"
            min="0"
            value={goals.daily_carbs_goal_g}
            onChange={(e) => setGoals({ ...goals, daily_carbs_goal_g: e.target.value })}
            className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fat (g)</label>
          <input
            type="number"
            min="0"
            value={goals.daily_fat_goal_g}
            onChange={(e) => setGoals({ ...goals, daily_fat_goal_g: e.target.value })}
            className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Protein (g)</label>
          <input
            type="number"
            min="0"
            value={goals.daily_protein_goal_g}
            onChange={(e) => setGoals({ ...goals, daily_protein_goal_g: e.target.value })}
            className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
          />
        </div>
      </div>
      <button type="submit" className="bg-emerald-700 text-white rounded px-4 py-2 hover:bg-emerald-800">
        Save goals
      </button>
      {saved && <span className="text-emerald-700 dark:text-emerald-400 text-sm ml-2">Saved!</span>}
    </form>
  );
}

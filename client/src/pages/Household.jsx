import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Household() {
  const { user, setUser } = useAuth();
  const [household, setHousehold] = useState(null);
  const [goals, setGoals] = useState({
    daily_carbs_goal_g: user?.daily_carbs_goal_g || '',
    daily_fat_goal_g: user?.daily_fat_goal_g || '',
    daily_protein_goal_g: user?.daily_protein_goal_g || '',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/auth/household').then(({ household }) => setHousehold(household));
  }, []);

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
    <div className="space-y-8 max-w-lg">
      <div>
        <h1 className="text-xl font-semibold mb-2">Household</h1>
        {household ? (
          <div className="bg-white shadow rounded p-4 space-y-1">
            <p>
              <span className="font-medium">Name:</span> {household.name}
            </p>
            <p>
              <span className="font-medium">Invite code:</span>{' '}
              <code className="bg-slate-100 px-2 py-1 rounded">{household.invite_code}</code>
            </p>
            <p className="text-sm text-slate-500">
              Share this code with someone so they can join your household during registration and see
              the same foods, recipes and shopping lists.
            </p>
          </div>
        ) : (
          <p className="text-slate-500">Loading...</p>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Daily macro goals</h2>
        <form onSubmit={saveGoals} className="bg-white shadow rounded p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Carbs (g)</label>
              <input
                type="number"
                min="0"
                value={goals.daily_carbs_goal_g}
                onChange={(e) => setGoals({ ...goals, daily_carbs_goal_g: e.target.value })}
                className="w-full border rounded px-2 py-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fat (g)</label>
              <input
                type="number"
                min="0"
                value={goals.daily_fat_goal_g}
                onChange={(e) => setGoals({ ...goals, daily_fat_goal_g: e.target.value })}
                className="w-full border rounded px-2 py-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Protein (g)</label>
              <input
                type="number"
                min="0"
                value={goals.daily_protein_goal_g}
                onChange={(e) => setGoals({ ...goals, daily_protein_goal_g: e.target.value })}
                className="w-full border rounded px-2 py-1"
              />
            </div>
          </div>
          <button type="submit" className="bg-emerald-700 text-white rounded px-4 py-2 hover:bg-emerald-800">
            Save goals
          </button>
          {saved && <span className="text-emerald-700 text-sm ml-2">Saved!</span>}
        </form>
      </div>
    </div>
  );
}

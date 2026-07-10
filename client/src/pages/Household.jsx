import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Household() {
  const { refresh } = useAuth();
  const [household, setHousehold] = useState(null);
  const [savingNetCarbs, setSavingNetCarbs] = useState(false);

  useEffect(() => {
    api.get('/auth/household').then(({ household }) => setHousehold(household));
  }, []);

  const toggleNetCarbs = async (checked) => {
    setSavingNetCarbs(true);
    try {
      const { household: updated } = await api.put('/auth/household/settings', { track_net_carbs: checked });
      setHousehold(updated);
      // track_net_carbs also rides along on the user object (from /auth/me),
      // which is what the Foods form and macro cards actually check.
      await refresh();
    } finally {
      setSavingNetCarbs(false);
    }
  };

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-xl font-semibold mb-2">Household</h1>
      {household ? (
        <>
          <div className="bg-white dark:bg-slate-800 shadow rounded p-4 space-y-1">
            <p>
              <span className="font-medium">Name:</span> {household.name}
            </p>
            <p>
              <span className="font-medium">Invite code:</span>{' '}
              <code className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">{household.invite_code}</code>
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Share this code with someone so they can join your household during registration and see
              the same foods, recipes and shopping lists.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 shadow rounded p-4 space-y-2">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={household.track_net_carbs}
                disabled={savingNetCarbs}
                onChange={(e) => toggleNetCarbs(e.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="font-medium">Track Net Carbs</span>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Adds a Fiber field when entering foods, and switches calorie math (and the Carbs card)
                  to use carbs minus fiber instead of total carbs. Applies to the whole household, so
                  shared foods and recipes show the same numbers to everyone.
                </p>
              </span>
            </label>
          </div>
        </>
      ) : (
        <p className="text-slate-500 dark:text-slate-400">Loading...</p>
      )}
    </div>
  );
}

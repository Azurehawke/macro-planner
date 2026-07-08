import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function Household() {
  const [household, setHousehold] = useState(null);

  useEffect(() => {
    api.get('/auth/household').then(({ household }) => setHousehold(household));
  }, []);

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-2">Household</h1>
      {household ? (
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
      ) : (
        <p className="text-slate-500 dark:text-slate-400">Loading...</p>
      )}
    </div>
  );
}

import React from 'react';
import MacroGoalsForm from '../components/MacroGoalsForm.jsx';

export default function Settings() {
  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <MacroGoalsForm />
    </div>
  );
}

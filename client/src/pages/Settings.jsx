import React from 'react';
import MacroGoalsForm from '../components/MacroGoalsForm.jsx';
import MarkdownHeadingsForm from '../components/MarkdownHeadingsForm.jsx';

export default function Settings() {
  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <MacroGoalsForm />
      <MarkdownHeadingsForm />
    </div>
  );
}

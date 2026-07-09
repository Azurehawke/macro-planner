import React from 'react';
import { Link } from 'react-router-dom';
import MacroGoalsForm from '../components/MacroGoalsForm.jsx';
import MarkdownHeadingsForm from '../components/MarkdownHeadingsForm.jsx';
import ThemeForm from '../components/ThemeForm.jsx';

export default function Settings() {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <ThemeForm />
      <MacroGoalsForm />
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Not sure what to put here? The{' '}
        <Link to="/macro-calculator" className="underline text-emerald-700 dark:text-emerald-400">
          macro calculator
        </Link>{' '}
        can work it out from your stats and goals, and write straight into these fields.
      </p>
      <MarkdownHeadingsForm />
    </div>
  );
}

import React from 'react';
import MacroCalculatorForm from '../components/MacroCalculatorForm.jsx';
import MacroGoalsForm from '../components/MacroGoalsForm.jsx';
import MarkdownHeadingsForm from '../components/MarkdownHeadingsForm.jsx';
import ThemeForm from '../components/ThemeForm.jsx';

export default function Settings() {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <ThemeForm />
      <MacroCalculatorForm />
      <MacroGoalsForm />
      <MarkdownHeadingsForm />
    </div>
  );
}

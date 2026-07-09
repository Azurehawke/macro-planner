import React from 'react';
import MacroCalculatorForm from '../components/MacroCalculatorForm.jsx';

export default function MacroCalculator() {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Macro Calculator</h1>
      <MacroCalculatorForm />
    </div>
  );
}

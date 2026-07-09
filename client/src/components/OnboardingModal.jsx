import React, { useState } from 'react';

const STEPS = [
  {
    title: 'Welcome to Macro Planner',
    body: [
      "Foods and recipes are shared with your whole household, but your daily plan and goals are your own. Here's a quick tour of how the pieces fit together.",
      "We've already added a starter set of foods and recipes below so there's something to try this with right away - edit or delete them anytime.",
    ],
  },
  {
    title: '1. Add your foods',
    body: [
      "The Foods page is your household's shared ingredient list - carbs, fat and protein per serving. Add them by hand, search USDA/Open Food Facts for a quick prefill, or import a whole list at once from a CSV.",
      'Editing a food later updates every recipe that uses it automatically - nothing to keep in sync by hand.',
    ],
  },
  {
    title: '2. Build recipes',
    body: [
      'On the Recipes page, combine foods with a quantity in grams to build something like a "Chicken & Rice Bowl". Its macros are always computed live from the current ingredient data.',
      'Each food also shows every recipe currently using it, so you can see the ripple effect before you change a food.',
    ],
  },
  {
    title: '3. Plan your week',
    body: [
      'The Week page lays your plan out as a grid: days across the top, Breakfast/Lunch/Dinner/Snack down the side. Drag a food or recipe from the sidebar onto a cell to plan it.',
      'Already planned something in the wrong spot? Drag its card to a different day or meal to reschedule it, or click it to open a popup with the same options plus an amount slider.',
    ],
  },
  {
    title: '4. Copy days & weeks',
    body: [
      'An empty cell has a small "+ copy..." link offering yesterday\'s or last week\'s version of that same meal, if one exists - one click duplicates it in.',
      'For a whole week at once, use "Copy last week" at the top of the grid - it repeats every meal slot onto the matching day, seven days later.',
    ],
  },
  {
    title: '5. Shopping list',
    body: [
      "Add ingredients straight from a recipe (scaled by however many servings you're making) or as one-off items. It's shared with your household, so anyone can add to or check off the same list.",
    ],
  },
  {
    title: '6. Set your goals',
    body: [
      'The Calculator page estimates your calorie and macro targets from your stats and goal (or lets you enter a known BMR), and "Use these targets" writes straight into your account.',
      'Settings also has dark mode and the markdown export heading levels used when you copy or download a day\'s plan.',
    ],
  },
];

export default function OnboardingModal({ onClose }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const { title, body } = STEPS[step];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded shadow-lg w-full max-w-md p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold text-lg">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          {body.map((p, i) => (
            <p key={i} className="text-sm text-slate-600 dark:text-slate-300">
              {p}
            </p>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t dark:border-slate-700">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${
                  i === step ? 'bg-emerald-700 dark:bg-emerald-400' : 'bg-slate-200 dark:bg-slate-600'
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="border dark:border-slate-600 rounded px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Back
              </button>
            )}
            {isLast ? (
              <button
                onClick={onClose}
                className="bg-emerald-700 text-white rounded px-4 py-1.5 text-sm hover:bg-emerald-800"
              >
                Get started
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="bg-emerald-700 text-white rounded px-4 py-1.5 text-sm hover:bg-emerald-800"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

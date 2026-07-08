import React, { useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  ACTIVITY_LEVELS,
  GOALS,
  WEEKLY_LOSS_RATES,
  calculateMacros,
  estimateWeeksToGoal,
} from '../utils/macroCalculator.js';

const emptyForm = {
  sex: '',
  ageYears: '',
  weightLb: '',
  heightFt: '',
  heightIn: '',
  knownBmr: '',
  activity: 'sedentary',
  goal: 'maintain',
  weeklyLossLb: 1,
  goalWeightLb: '',
};

export default function MacroCalculatorForm() {
  const { setUser } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [saved, setSaved] = useState(false);

  const ageYears = Number(form.ageYears);
  const weightLb = Number(form.weightLb);
  const heightIn = Number(form.heightFt) * 12 + Number(form.heightIn || 0);
  const knownBmr = Number(form.knownBmr);
  const hasKnownBmr = knownBmr > 0;
  // With a known BMR, sex/age/height are irrelevant to the calculation -
  // only weight (for the goal-weight estimate) and activity/goal are needed.
  const canCalculate = weightLb > 0 && (hasKnownBmr || (form.sex && ageYears > 0 && heightIn > 0));

  const result = canCalculate
    ? calculateMacros({
        sex: form.sex,
        ageYears,
        weightLb,
        heightIn,
        activity: form.activity,
        goal: form.goal,
        weeklyLossLb: Number(form.weeklyLossLb),
        knownBmr: hasKnownBmr ? knownBmr : undefined,
      })
    : null;

  const weeksToGoal =
    result && form.goal === 'lose'
      ? estimateWeeksToGoal(weightLb, Number(form.goalWeightLb), Number(form.weeklyLossLb))
      : null;

  const useTheseTargets = async () => {
    if (!result) return;
    const { user: updated } = await api.put('/auth/me/goals', {
      daily_carbs_goal_g: result.carbs_g,
      daily_fat_goal_g: result.fat_g,
      daily_protein_goal_g: result.protein_g,
    });
    setUser(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-slate-800 shadow rounded p-4 space-y-3">
      <div>
        <h2 className="font-medium">Macro calculator</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Estimates your calorie and macro targets from the Mifflin-St Jeor formula (the same one
          MyFitnessPal's calculator is built on) — re-run this anytime your weight shifts by 15-20 lbs
          or your goal changes.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Sex</label>
          <div className="flex gap-3 text-sm pt-1">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={form.sex === 'male'}
                onChange={() => setForm({ ...form, sex: 'male' })}
              />
              Male
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={form.sex === 'female'}
                onChange={() => setForm({ ...form, sex: 'female' })}
              />
              Female
            </label>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Age</label>
          <input
            type="number"
            min="1"
            value={form.ageYears}
            onChange={(e) => setForm({ ...form, ageYears: e.target.value })}
            disabled={hasKnownBmr}
            className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Weight (lbs)</label>
          <input
            type="number"
            min="1"
            step="0.1"
            value={form.weightLb}
            onChange={(e) => setForm({ ...form, weightLb: e.target.value })}
            className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Height</label>
          <div className="flex gap-1">
            <input
              type="number"
              min="0"
              placeholder="ft"
              value={form.heightFt}
              onChange={(e) => setForm({ ...form, heightFt: e.target.value })}
              disabled={hasKnownBmr}
              className="w-1/2 border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1 disabled:opacity-50"
            />
            <input
              type="number"
              min="0"
              max="11"
              placeholder="in"
              value={form.heightIn}
              onChange={(e) => setForm({ ...form, heightIn: e.target.value })}
              disabled={hasKnownBmr}
              className="w-1/2 border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1 disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">BMR (optional, if known)</label>
          <input
            type="number"
            min="0"
            placeholder="e.g. from a metabolic test"
            value={form.knownBmr}
            onChange={(e) => setForm({ ...form, knownBmr: e.target.value })}
            className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
          />
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Leave blank to estimate from sex/age/height above.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Activity level</label>
          <select
            value={form.activity}
            onChange={(e) => setForm({ ...form, activity: e.target.value })}
            className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
          >
            {ACTIVITY_LEVELS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Goal</label>
          <select
            value={form.goal}
            onChange={(e) => setForm({ ...form, goal: e.target.value })}
            className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
          >
            {GOALS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        {form.goal === 'lose' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Weight loss per week</label>
              <select
                value={form.weeklyLossLb}
                onChange={(e) => setForm({ ...form, weeklyLossLb: e.target.value })}
                className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
              >
                {WEEKLY_LOSS_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate} lb/week
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Goal weight (lbs, optional)</label>
              <input
                type="number"
                min="1"
                step="0.1"
                value={form.goalWeightLb}
                onChange={(e) => setForm({ ...form, goalWeightLb: e.target.value })}
                className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
              />
            </div>
          </>
        )}
      </div>

      {result && (
        <div className="border-t dark:border-slate-700 pt-3 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Calories</p>
              <p className="text-lg font-semibold">{result.targetCalories}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Carbs</p>
              <p className="text-lg font-semibold">{result.carbs_g}g</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Fat</p>
              <p className="text-lg font-semibold">{result.fat_g}g</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Protein</p>
              <p className="text-lg font-semibold">{result.protein_g}g</p>
            </div>
          </div>
          {result.cappedAtFloor && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Your deficit would put you under {1200} kcal/day, so this is capped at a safer minimum
              instead.
            </p>
          )}
          {weeksToGoal != null && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ~{weeksToGoal} week{weeksToGoal === 1 ? '' : 's'} to reach {form.goalWeightLb} lbs at{' '}
              {form.weeklyLossLb} lb/week
            </p>
          )}
          <p className="text-xs text-slate-400 dark:text-slate-500">
            BMR {result.bmr} kcal ({result.usingKnownBmr ? 'entered manually' : 'Mifflin-St Jeor estimate'}) ·
            TDEE (maintenance) {result.tdee} kcal
            {form.goal === 'lose' &&
              ` · ${result.tdee - result.targetCalories} kcal/day deficit (${form.weeklyLossLb} lb/week)`}
          </p>
          <button
            type="button"
            onClick={useTheseTargets}
            className="bg-emerald-700 text-white rounded px-4 py-2 hover:bg-emerald-800"
          >
            Use these targets
          </button>
          {saved && <span className="text-emerald-700 dark:text-emerald-400 text-sm ml-2">Saved!</span>}
        </div>
      )}
    </div>
  );
}

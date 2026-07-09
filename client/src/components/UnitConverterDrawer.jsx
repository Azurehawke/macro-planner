import React, { useMemo, useState } from 'react';
import { INGREDIENT_DENSITIES, VOLUME_UNITS, WEIGHT_UNITS, convertVolume, convertWeight, volumeToGrams } from '../utils/unitConversion.js';

function fmt(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  const rounded = Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 100) / 100;
  return rounded.toString();
}

const TABS = [
  { value: 'weight', label: 'Weight' },
  { value: 'volume', label: 'Volume' },
  { value: 'volumeToWeight', label: 'Volume → grams' },
];

// A non-blocking side drawer (no backdrop) so it can stay open while you
// keep typing in the Foods/Recipes form behind it - the whole point is to
// look up "1 cup flour = how many grams" without losing your place.
export default function UnitConverterDrawer({ open, onClose }) {
  const [tab, setTab] = useState('weight');

  const [weightAmount, setWeightAmount] = useState('1');
  const [weightFrom, setWeightFrom] = useState('g');

  const [volAmount, setVolAmount] = useState('1');
  const [volFrom, setVolFrom] = useState('cup');

  const [vwAmount, setVwAmount] = useState('1');
  const [vwUnit, setVwUnit] = useState('cup');
  const [ingredient, setIngredient] = useState(INGREDIENT_DENSITIES[0].name);
  const [customDensity, setCustomDensity] = useState('');

  const weightResults = useMemo(() => {
    const amount = Number(weightAmount);
    return WEIGHT_UNITS.filter((u) => u.value !== weightFrom).map((u) => ({
      unit: u,
      value: convertWeight(amount, weightFrom, u.value),
    }));
  }, [weightAmount, weightFrom]);

  const volumeResults = useMemo(() => {
    const amount = Number(volAmount);
    return VOLUME_UNITS.filter((u) => u.value !== volFrom).map((u) => ({
      unit: u,
      value: convertVolume(amount, volFrom, u.value),
    }));
  }, [volAmount, volFrom]);

  const density =
    ingredient === 'custom' ? Number(customDensity) : INGREDIENT_DENSITIES.find((i) => i.name === ingredient)?.gramsPerCup;
  const vwGrams = volumeToGrams(Number(vwAmount), vwUnit, density);
  const vwOz = vwGrams != null ? convertWeight(vwGrams, 'g', 'oz') : null;

  return (
    <div
      className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-white dark:bg-slate-800 border-l dark:border-slate-700 shadow-2xl z-50 flex flex-col transition-transform duration-300 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
      aria-hidden={!open}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b dark:border-slate-700">
        <h2 className="font-semibold">Measurement converter</h2>
        <button
          onClick={onClose}
          aria-label="Close converter"
          className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
        >
          ✕
        </button>
      </div>

      <div className="flex border-b dark:border-slate-700 text-sm">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex-1 py-2 px-1 ${
              tab === t.value
                ? 'font-semibold border-b-2 border-emerald-700 dark:border-emerald-400 text-emerald-700 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'weight' && (
          <>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Exact conversions between weight units - no ingredient involved.
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                value={weightAmount}
                onChange={(e) => setWeightAmount(e.target.value)}
                className="w-24 border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
              />
              <select
                value={weightFrom}
                onChange={(e) => setWeightFrom(e.target.value)}
                className="flex-1 border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
              >
                {WEIGHT_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              {weightResults.map(({ unit, value }) => (
                <div
                  key={unit.value}
                  className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded px-3 py-2"
                >
                  <span className="text-sm text-slate-500 dark:text-slate-400">{unit.label}</span>
                  <span className="font-semibold">{fmt(value)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'volume' && (
          <>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Exact conversions between volume units - a cup of anything is the same number of mL.
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                value={volAmount}
                onChange={(e) => setVolAmount(e.target.value)}
                className="w-24 border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
              />
              <select
                value={volFrom}
                onChange={(e) => setVolFrom(e.target.value)}
                className="flex-1 border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
              >
                {VOLUME_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              {volumeResults.map(({ unit, value }) => (
                <div
                  key={unit.value}
                  className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded px-3 py-2"
                >
                  <span className="text-sm text-slate-500 dark:text-slate-400">{unit.label}</span>
                  <span className="font-semibold">{fmt(value)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'volumeToWeight' && (
          <>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Converting volume to weight needs the ingredient's density - these are approximate reference
              values. Use your own package's numbers when you have them (pick "Custom" below).
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                value={vwAmount}
                onChange={(e) => setVwAmount(e.target.value)}
                className="w-20 border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
              />
              <select
                value={vwUnit}
                onChange={(e) => setVwUnit(e.target.value)}
                className="flex-1 border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
              >
                {VOLUME_UNITS.filter((u) => u.value !== 'L').map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-500 dark:text-slate-400">Ingredient</label>
              <select
                value={ingredient}
                onChange={(e) => setIngredient(e.target.value)}
                className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
              >
                {INGREDIENT_DENSITIES.map((i) => (
                  <option key={i.name} value={i.name}>
                    {i.name}
                  </option>
                ))}
                <option value="custom">Custom (enter grams per cup)...</option>
              </select>
            </div>
            {ingredient === 'custom' && (
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-500 dark:text-slate-400">
                  Grams per cup (from your package)
                </label>
                <input
                  type="number"
                  value={customDensity}
                  onChange={(e) => setCustomDensity(e.target.value)}
                  placeholder="e.g. 130"
                  className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
                />
              </div>
            )}
            <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded px-3 py-3 text-center">
              <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400">{fmt(vwGrams)}g</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{fmt(vwOz)} oz</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

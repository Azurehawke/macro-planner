import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import MacroGoalsForm from '../components/MacroGoalsForm.jsx';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack', 'other'];
const MAX_FRACTION = 3;

function scaleMacros(unitMacros, fraction) {
  return {
    carbs_g: unitMacros.carbs_g * fraction,
    fat_g: unitMacros.fat_g * fraction,
    protein_g: unitMacros.protein_g * fraction,
    calories: unitMacros.calories * fraction,
  };
}

function sumMacros(list) {
  return list.reduce(
    (acc, m) => ({
      carbs_g: acc.carbs_g + m.carbs_g,
      fat_g: acc.fat_g + m.fat_g,
      protein_g: acc.protein_g + m.protein_g,
      calories: acc.calories + m.calories,
    }),
    { carbs_g: 0, fat_g: 0, protein_g: 0, calories: 0 }
  );
}

function GoalBar({ label, value, goal }) {
  const pct = goal ? Math.min(100, Math.round((value / goal) * 100)) : null;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span>
          {Math.round(value)}
          {goal ? ` / ${Math.round(goal)}g` : 'g'}
        </span>
      </div>
      {goal != null && (
        <div className="h-2 bg-slate-200 rounded overflow-hidden">
          <div
            className={`h-full ${pct >= 100 ? 'bg-amber-500' : 'bg-emerald-600'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

// A labelled 0x-3x slider used both for a whole food entry and for a single
// ingredient inside a planned recipe. `fraction` is the committed (server)
// value; local drag state is tracked by the parent so macros preview live.
function FractionSlider({ label, fraction, quantityG, macros, onChange, onCommit }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 text-sm">{label}</span>
      <input
        type="range"
        min="0"
        max={MAX_FRACTION}
        step="0.05"
        value={fraction}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        onKeyUp={onCommit}
        className="flex-1 accent-emerald-700"
      />
      <span className="w-16 shrink-0 text-sm text-right">{Math.round(quantityG)}g</span>
      <span className="w-40 shrink-0 text-xs text-slate-500 text-right">
        {Math.round(macros.carbs_g)}c · {Math.round(macros.fat_g)}f · {Math.round(macros.protein_g)}p
      </span>
    </div>
  );
}

export default function Diary() {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState(null);
  const [foods, setFoods] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [itemType, setItemType] = useState('food');
  const [itemId, setItemId] = useState('');
  const [mealSlot, setMealSlot] = useState('breakfast');
  const [error, setError] = useState('');

  // Local, optimistic fraction overrides so dragging a slider feels instant.
  // Keyed by entry id for food entries, `${entryId}:${foodId}` for components.
  const [localFractions, setLocalFractions] = useState({});
  const pendingCommits = useRef({});

  const load = async () => {
    const [diary, { foods }, { recipes }] = await Promise.all([
      api.get(`/diary?date=${date}`),
      api.get('/foods'),
      api.get('/recipes'),
    ]);
    setData(diary);
    setFoods(foods);
    setRecipes(recipes);
    setLocalFractions({});
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!itemId) return;
    try {
      await api.post('/diary', {
        entry_date: date,
        item_type: itemType,
        food_id: itemType === 'food' ? Number(itemId) : undefined,
        recipe_id: itemType === 'recipe' ? Number(itemId) : undefined,
        meal_slot: mealSlot,
      });
      setItemId('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeEntry = async (id) => {
    await api.del(`/diary/${id}`);
    await load();
  };

  const setLocalFraction = (key, value) => {
    setLocalFractions((prev) => ({ ...prev, [key]: value }));
  };

  const commitFoodFraction = (entryId) => {
    const key = String(entryId);
    const value = pendingCommits.current[key];
    if (value == null) return;
    api.put(`/diary/${entryId}`, { fraction: value }).then(load);
  };

  const commitComponentFraction = (entryId, foodId) => {
    const key = `${entryId}:${foodId}`;
    const value = pendingCommits.current[key];
    if (value == null) return;
    api.put(`/diary/${entryId}/components/${foodId}`, { fraction: value }).then(load);
  };

  const options = itemType === 'food' ? foods : recipes;

  // Recompute an entry's displayed macros from any locally-dragged (uncommitted) fractions.
  const previewEntry = (entry) => {
    if (entry.item_type === 'food') {
      const key = String(entry.id);
      const fraction = localFractions[key] ?? entry.fraction;
      pendingCommits.current[key] = fraction;
      return { fraction, quantity_g: entry.base_quantity_g * fraction, macros: scaleMacros(entry.unit_macros, fraction) };
    }
    const components = entry.components.map((c) => {
      const key = `${entry.id}:${c.food_id}`;
      const fraction = localFractions[key] ?? c.fraction;
      pendingCommits.current[key] = fraction;
      return { ...c, fraction, quantity_g: c.base_quantity_g * fraction, macros: scaleMacros(c.unit_macros, fraction) };
    });
    return { components, macros: sumMacros(components.map((c) => c.macros)) };
  };

  const previewed = data ? data.entries.map((e) => ({ entry: e, preview: previewEntry(e) })) : [];
  const dayTotals = data ? sumMacros(previewed.map((p) => p.preview.macros)) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Daily Plan</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-2 py-1"
        />
      </div>

      <MacroGoalsForm />

      {data && dayTotals && (
        <div className="bg-white shadow rounded p-4 space-y-3">
          <h2 className="font-medium">Totals for {date}</h2>
          <GoalBar label="Carbs" value={dayTotals.carbs_g} goal={data.goals.carbs_g} />
          <GoalBar label="Fat" value={dayTotals.fat_g} goal={data.goals.fat_g} />
          <GoalBar label="Protein" value={dayTotals.protein_g} goal={data.goals.protein_g} />
          <p className="text-sm text-slate-500">{Math.round(dayTotals.calories)} kcal total</p>
        </div>
      )}

      <form onSubmit={onSubmit} className="bg-white shadow rounded p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select
            value={itemType}
            onChange={(e) => {
              setItemType(e.target.value);
              setItemId('');
            }}
            className="border rounded px-2 py-1"
          >
            <option value="food">Food</option>
            <option value="recipe">Recipe</option>
          </select>
        </div>
        <div className="flex-1 min-w-[10rem]">
          <label className="block text-sm font-medium mb-1">Item</label>
          <select required value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-full border rounded px-2 py-1">
            <option value="">Select...</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Meal</label>
          <select value={mealSlot} onChange={(e) => setMealSlot(e.target.value)} className="border rounded px-2 py-1">
            {MEAL_SLOTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="bg-emerald-700 text-white rounded px-4 py-2 hover:bg-emerald-800">
          Add to plan
        </button>
        <p className="text-xs text-slate-500 w-full">
          Adds a full serving — dial it in with the slider below once it's added.
        </p>
        {error && <p className="text-red-600 text-sm w-full">{error}</p>}
      </form>

      <div className="bg-white shadow rounded divide-y">
        {data && data.entries.length === 0 && <p className="p-4 text-slate-500">Nothing planned yet.</p>}
        {previewed.map(({ entry, preview }) => (
          <div key={entry.id} className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {entry.name} <span className="text-xs text-slate-400">({entry.meal_slot})</span>
              </p>
              <button onClick={() => removeEntry(entry.id)} className="text-red-600 underline text-sm">
                Remove
              </button>
            </div>

            {entry.item_type === 'food' ? (
              <FractionSlider
                label="Amount"
                fraction={preview.fraction}
                quantityG={preview.quantity_g}
                macros={preview.macros}
                onChange={(v) => setLocalFraction(String(entry.id), v)}
                onCommit={() => commitFoodFraction(entry.id)}
              />
            ) : (
              <>
                <div className="space-y-2">
                  {preview.components.map((c) => (
                    <FractionSlider
                      key={c.food_id}
                      label={c.food_name}
                      fraction={c.fraction}
                      quantityG={c.quantity_g}
                      macros={c.macros}
                      onChange={(v) => setLocalFraction(`${entry.id}:${c.food_id}`, v)}
                      onCommit={() => commitComponentFraction(entry.id, c.food_id)}
                    />
                  ))}
                </div>
                <p className="text-sm text-slate-500">
                  Subtotal: {Math.round(preview.macros.carbs_g)}g carbs · {Math.round(preview.macros.fat_g)}g fat ·{' '}
                  {Math.round(preview.macros.protein_g)}g protein · {Math.round(preview.macros.calories)} kcal
                </p>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

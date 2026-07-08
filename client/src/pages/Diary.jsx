import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

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

function macroTableRow(label, planned, goal) {
  const plannedStr = `${Math.round(planned)}g`;
  if (goal == null) return `| ${label} | ${plannedStr} | — | — |`;
  const remaining = goal - planned;
  const remainingStr = remaining < 0 ? `${Math.round(-remaining)}g over` : `${Math.round(remaining)}g`;
  return `| ${label} | ${plannedStr} | ${Math.round(goal)}g | ${remainingStr} |`;
}

function macroLine(macros) {
  return `${Math.round(macros.carbs_g)}g carbs, ${Math.round(macros.fat_g)}g fat, ${Math.round(
    macros.protein_g
  )}g protein, ${Math.round(macros.calories)} kcal`;
}

// Renders the currently-displayed plan (including any un-committed slider
// drags, so what you see is exactly what gets exported) as a markdown file.
function buildMarkdown(date, goals, dayTotals, previewed) {
  const lines = [`# Daily Plan — ${date}`, '', '## Macro Totals', '', '| Macro | Planned | Goal | Remaining |', '|---|---|---|---|'];
  lines.push(macroTableRow('Carbs', dayTotals.carbs_g, goals.carbs_g));
  lines.push(macroTableRow('Fat', dayTotals.fat_g, goals.fat_g));
  lines.push(macroTableRow('Protein', dayTotals.protein_g, goals.protein_g));
  lines.push('', `**${Math.round(dayTotals.calories)} kcal planned total**`, '');

  const byMealSlot = new Map(MEAL_SLOTS.map((slot) => [slot, []]));
  for (const item of previewed) {
    const slot = item.entry.meal_slot;
    if (!byMealSlot.has(slot)) byMealSlot.set(slot, []);
    byMealSlot.get(slot).push(item);
  }

  for (const [slot, items] of byMealSlot) {
    if (items.length === 0) continue;
    lines.push(`## ${slot.charAt(0).toUpperCase()}${slot.slice(1)}`, '');
    for (const { entry, preview } of items) {
      if (entry.item_type === 'food') {
        lines.push(`- ${entry.name} — ${Math.round(preview.quantity_g)}g (${macroLine(preview.macros)})`);
      } else {
        lines.push(`- ${entry.name}`);
        for (const c of preview.components) {
          lines.push(`  - ${c.food_name} — ${Math.round(c.quantity_g)}g (${macroLine(c.macros)})`);
        }
        lines.push(`  - Subtotal: ${macroLine(preview.macros)}`);
      }
    }
    lines.push('');
  }

  if (previewed.length === 0) {
    lines.push('_Nothing planned._', '');
  }

  return lines.join('\n');
}

// One card per macro: how much is planned so far today, and how much of the
// goal (set on the Settings page) is left. Goes red/over instead of just
// capping at 100% so overshooting the plan is obvious.
function MacroGoalCard({ label, planned, goal }) {
  if (goal == null) {
    return (
      <div className="bg-white shadow rounded p-4">
        <h3 className="text-sm font-medium text-slate-500">{label}</h3>
        <p className="text-2xl font-semibold mt-1">{Math.round(planned)}g</p>
        <p className="text-xs text-slate-400 mt-1">
          planned · <Link to="/settings" className="text-emerald-700 underline">set a goal</Link>
        </p>
      </div>
    );
  }

  const remaining = goal - planned;
  const over = remaining < 0;
  const pct = Math.min(100, Math.round((planned / goal) * 100));
  return (
    <div className="bg-white shadow rounded p-4">
      <h3 className="text-sm font-medium text-slate-500">{label}</h3>
      <p className="text-2xl font-semibold mt-1">{Math.round(planned)}g</p>
      <p className={`text-sm mt-1 ${over ? 'text-red-600' : 'text-emerald-700'}`}>
        {over ? `${Math.round(-remaining)}g over goal` : `${Math.round(remaining)}g remaining`}
      </p>
      <div className="h-2 bg-slate-200 rounded overflow-hidden mt-2">
        <div className={`h-full ${over ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-slate-400 mt-1">Goal: {Math.round(goal)}g</p>
    </div>
  );
}

// Compact version of MacroGoalCard for mobile, where three full cards
// stacked vertically eat too much of the (sticky) header's height. All
// three render side by side in one short row instead.
function MacroMiniStat({ label, planned, goal }) {
  const remaining = goal != null ? goal - planned : null;
  const over = remaining != null && remaining < 0;
  const pct = goal ? Math.min(100, Math.round((planned / goal) * 100)) : 0;
  return (
    <div className="text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-base font-semibold leading-tight">{Math.round(planned)}g</p>
      {goal != null ? (
        <>
          <div className="h-1 bg-slate-200 rounded overflow-hidden mt-1">
            <div className={`h-full ${over ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">of {Math.round(goal)}g</p>
        </>
      ) : (
        <Link to="/settings" className="text-[10px] text-emerald-700 underline">
          set goal
        </Link>
      )}
    </div>
  );
}

// A labelled 0x-3x slider used both for a whole food entry and for a single
// ingredient inside a planned recipe. `fraction` is the committed (server)
// value; local drag state is tracked by the parent so macros preview live.
function FractionSlider({ label, fraction, quantityG, macros, onChange, onCommit }) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium truncate">{label}</span>
        <span className="shrink-0 text-sm font-semibold text-emerald-700">{fraction.toFixed(2)}x</span>
      </div>
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
        className="w-full accent-emerald-700"
      />
      <div className="flex items-center justify-between gap-2 flex-wrap text-sm">
        <span className="font-semibold text-slate-900">{Math.round(quantityG)}g</span>
        <span className="text-slate-600">
          <span className="font-semibold text-slate-800">{Math.round(macros.carbs_g)}g</span> carbs ·{' '}
          <span className="font-semibold text-slate-800">{Math.round(macros.fat_g)}g</span> fat ·{' '}
          <span className="font-semibold text-slate-800">{Math.round(macros.protein_g)}g</span> protein
        </span>
      </div>
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
  const [copied, setCopied] = useState(false);

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

  const downloadMarkdown = () => {
    const markdown = buildMarkdown(date, data.goals, dayTotals, previewed);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-plan-${date}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const copyMarkdown = async () => {
    const markdown = buildMarkdown(date, data.goals, dayTotals, previewed);
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      // Clipboard API needs a secure context; fall back to the old-school approach.
      const textarea = document.createElement('textarea');
      textarea.value = markdown;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div
        className="sticky z-20 bg-slate-50 pb-4 space-y-6 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.15)]"
        style={{ top: 'var(--app-header-height, 0px)' }}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-semibold">Daily Plan</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {data && (
              <>
                <button
                  onClick={copyMarkdown}
                  className="border rounded px-3 py-1 text-sm hover:bg-slate-50"
                  title="Copy the plan as a markdown table"
                >
                  {copied ? 'Copied!' : 'Copy as markdown'}
                </button>
                <button
                  onClick={downloadMarkdown}
                  className="border rounded px-3 py-1 text-sm hover:bg-slate-50"
                  title="Download the plan as a .md file"
                >
                  Download .md
                </button>
              </>
            )}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border rounded px-2 py-1"
            />
          </div>
        </div>

        {data && dayTotals && (
          <div className="space-y-2">
            <div className="sm:hidden bg-white shadow rounded p-3 grid grid-cols-3 gap-2">
              <MacroMiniStat label="Carbs" planned={dayTotals.carbs_g} goal={data.goals.carbs_g} />
              <MacroMiniStat label="Fat" planned={dayTotals.fat_g} goal={data.goals.fat_g} />
              <MacroMiniStat label="Protein" planned={dayTotals.protein_g} goal={data.goals.protein_g} />
            </div>
            <div className="hidden sm:grid sm:grid-cols-3 gap-4">
              <MacroGoalCard label="Carbs" planned={dayTotals.carbs_g} goal={data.goals.carbs_g} />
              <MacroGoalCard label="Fat" planned={dayTotals.fat_g} goal={data.goals.fat_g} />
              <MacroGoalCard label="Protein" planned={dayTotals.protein_g} goal={data.goals.protein_g} />
            </div>
            <p className="text-sm text-slate-500">{Math.round(dayTotals.calories)} kcal planned total</p>
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
      </div>

      <div className="bg-white shadow rounded divide-y mt-6 mb-6">
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
                <div className="space-y-3">
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

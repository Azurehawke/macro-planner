import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { loadHeadingLevels } from '../utils/markdownHeadingLevels.js';
import { addDays, dayOfWeekLabel, formatShortDate, todayISO } from '../utils/date.js';

const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack', 'other'];
// A serving isn't capped at "3x" the way a vague fraction was - a food whose
// serving is small (e.g. one almond) can reasonably need many servings.
const MAX_SERVINGS = 10;

function scaleMacros(unitMacros, fraction) {
  return {
    carbs_g: unitMacros.carbs_g * fraction,
    fat_g: unitMacros.fat_g * fraction,
    protein_g: unitMacros.protein_g * fraction,
    fiber_g: unitMacros.fiber_g != null ? unitMacros.fiber_g * fraction : null,
    net_carbs_g: (unitMacros.net_carbs_g ?? unitMacros.carbs_g) * fraction,
    calories: unitMacros.calories * fraction,
  };
}

function sumMacros(list) {
  return list.reduce(
    (acc, m) => ({
      carbs_g: acc.carbs_g + m.carbs_g,
      fat_g: acc.fat_g + m.fat_g,
      protein_g: acc.protein_g + m.protein_g,
      fiber_g: acc.fiber_g + (m.fiber_g || 0),
      net_carbs_g: acc.net_carbs_g + (m.net_carbs_g ?? m.carbs_g),
      calories: acc.calories + m.calories,
    }),
    { carbs_g: 0, fat_g: 0, protein_g: 0, fiber_g: 0, net_carbs_g: 0, calories: 0 }
  );
}

function macroTableRow(label, planned, goal) {
  const plannedStr = `${Math.round(planned)}g`;
  if (goal == null) return `| ${label} | ${plannedStr} | — | — |`;
  const remaining = goal - planned;
  const remainingStr = remaining < 0 ? `${Math.round(-remaining)}g over` : `${Math.round(remaining)}g`;
  return `| ${label} | ${plannedStr} | ${Math.round(goal)}g | ${remainingStr} |`;
}

function macroLine(macros, useNetCarbs) {
  const carbsLabel = useNetCarbs ? 'net carbs' : 'carbs';
  const carbsValue = useNetCarbs ? macros.net_carbs_g : macros.carbs_g;
  return `${Math.round(carbsValue)}g ${carbsLabel}, ${Math.round(macros.fat_g)}g fat, ${Math.round(
    macros.protein_g
  )}g protein, ${Math.round(macros.calories)} kcal`;
}

function heading(level, text) {
  return `${'#'.repeat(level)} ${text}`;
}

// Renders the currently-displayed plan (including any un-committed slider
// drags, so what you see is exactly what gets exported) as a markdown file.
// `headingLevels` (edited on the Settings page) controls how deep the title
// and each section heading ("Macro Totals", meal names) nest, e.g. to fit
// under an existing H1/H2 in a bigger notes document.
function buildMarkdown(date, goals, dayTotals, previewed, headingLevels, useNetCarbs) {
  const { title, section } = headingLevels;
  const lines = [
    heading(title, `Meal Plan - ${date.replaceAll('-', '')}`),
    '',
    heading(section, 'Macro Totals'),
    '',
    `| Macro | Planned | Goal | Remaining |`,
    '|---|---|---|---|',
  ];
  lines.push(
    macroTableRow(useNetCarbs ? 'Net Carbs' : 'Carbs', useNetCarbs ? dayTotals.net_carbs_g : dayTotals.carbs_g, goals.carbs_g)
  );
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
    lines.push(heading(section, `${slot.charAt(0).toUpperCase()}${slot.slice(1)}`), '');
    for (const { entry, preview } of items) {
      if (entry.item_type === 'food') {
        lines.push(`- ${entry.name} — ${Math.round(preview.quantity_g)}g (${macroLine(preview.macros, useNetCarbs)})`);
      } else {
        lines.push(`- ${entry.name}`);
        for (const c of preview.components) {
          lines.push(`  - ${c.food_name} — ${Math.round(c.quantity_g)}g (${macroLine(c.macros, useNetCarbs)})`);
        }
        lines.push(`  - Subtotal: ${macroLine(preview.macros, useNetCarbs)}`);
      }
    }
    lines.push('');
  }

  if (previewed.length === 0) {
    lines.push('_Nothing planned._', '');
  }

  return lines.join('\n');
}

// Background per macro plus a darker (same hue/saturation, ~18% lightness)
// variant for its text, computed so all three stay readable (>=4.5:1
// contrast against their own background).
const MACRO_CARD_COLORS = {
  Carbs: { bg: '#D099FF', text: '#31005C' },
  Fat: { bg: '#FF8C80', text: '#5C0900' },
  Protein: { bg: '#F7B500', text: '#5C4300' },
};

// One card per macro: how much is planned so far today, and how much of the
// goal (set on the Settings page) is left. The "over goal" wording (rather
// than a color swap) is what flags overshooting, since the card's colors are
// fixed per macro.
function MacroGoalCard({ label, colorKey, planned, goal }) {
  const { bg, text } = MACRO_CARD_COLORS[colorKey || label];

  if (goal == null) {
    return (
      <div className="rounded shadow p-3" style={{ backgroundColor: bg }}>
        <h3 className="text-sm font-medium" style={{ color: text }}>
          {label}
        </h3>
        <p className="text-2xl font-semibold mt-0.5" style={{ color: text }}>
          {Math.round(planned)}g
        </p>
        <p className="text-xs mt-1" style={{ color: text, opacity: 0.8 }}>
          planned ·{' '}
          <Link to="/settings" className="underline" style={{ color: text }}>
            set a goal
          </Link>
        </p>
      </div>
    );
  }

  const remaining = goal - planned;
  const over = remaining < 0;
  const pct = Math.min(100, Math.round((planned / goal) * 100));
  return (
    <div className="rounded shadow p-3" style={{ backgroundColor: bg }}>
      <h3 className="text-sm font-medium" style={{ color: text }}>
        {label}
      </h3>
      <p className="text-2xl font-semibold mt-0.5" style={{ color: text }}>
        {Math.round(planned)}g
      </p>
      <p className="text-sm mt-0.5 font-medium" style={{ color: text }}>
        {over ? `${Math.round(-remaining)}g over goal` : `${Math.round(remaining)}g remaining`}
      </p>
      <div className="h-1.5 rounded overflow-hidden mt-1.5" style={{ backgroundColor: 'rgba(0,0,0,0.12)' }}>
        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: text, opacity: over ? 1 : 0.55 }} />
      </div>
      <p className="text-xs mt-1" style={{ color: text, opacity: 0.75 }}>
        Goal: {Math.round(goal)}g
      </p>
    </div>
  );
}

// Compact version of MacroGoalCard for mobile, where three full cards
// stacked vertically eat too much of the (sticky) header's height. All
// three render side by side in one short row instead.
function MacroMiniStat({ label, colorKey, planned, goal }) {
  const { bg, text } = MACRO_CARD_COLORS[colorKey || label];
  const remaining = goal != null ? goal - planned : null;
  const over = remaining != null && remaining < 0;
  const pct = goal ? Math.min(100, Math.round((planned / goal) * 100)) : 0;
  return (
    <div className="text-center rounded shadow p-2" style={{ backgroundColor: bg }}>
      <p className="text-xs font-medium" style={{ color: text }}>
        {label}
      </p>
      <p className="text-base font-semibold leading-tight" style={{ color: text }}>
        {Math.round(planned)}g
      </p>
      {goal != null ? (
        <>
          <div className="h-1 rounded overflow-hidden mt-1" style={{ backgroundColor: 'rgba(0,0,0,0.12)' }}>
            <div className="h-full" style={{ width: `${pct}%`, backgroundColor: text, opacity: over ? 1 : 0.55 }} />
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: text, opacity: 0.75 }}>
            of {Math.round(goal)}g
          </p>
        </>
      ) : (
        <Link to="/settings" className="text-[10px] underline" style={{ color: text }}>
          set goal
        </Link>
      )}
    </div>
  );
}

// A labelled 0-10 servings slider used both for a whole food entry and for a
// single ingredient inside a planned recipe. `fraction` is the committed
// (server) value - it's how many servings of the food's defined serving
// size are planned; local drag state is tracked by the parent so macros
// preview live.
function FractionSlider({ label, fraction, quantityG, macros, useNetCarbs, onChange, onCommit }) {
  return (
    <div className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium truncate">{label}</span>
        <span className="shrink-0 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          {fraction.toFixed(2)} serving{fraction === 1 ? '' : 's'}
        </span>
      </div>
      <input
        type="range"
        min="0"
        max={MAX_SERVINGS}
        step="0.05"
        value={fraction}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        onKeyUp={onCommit}
        className="w-full accent-emerald-700 touch-pan-y"
      />
      <div className="flex items-center justify-between gap-2 flex-wrap text-sm">
        <span className="font-semibold text-slate-900 dark:text-slate-100">{Math.round(quantityG)}g</span>
        <span className="text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {Math.round(useNetCarbs ? macros.net_carbs_g : macros.carbs_g)}g
          </span>{' '}
          {useNetCarbs ? 'net carbs' : 'carbs'} ·{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">{Math.round(macros.fat_g)}g</span> fat ·{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">{Math.round(macros.protein_g)}g</span>{' '}
          protein
        </span>
      </div>
    </div>
  );
}

export default function DayView() {
  const { user } = useAuth();
  const trackNetCarbs = Boolean(user?.track_net_carbs);
  const { date: routeDate } = useParams();
  const navigate = useNavigate();
  const date = routeDate || todayISO();
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
      return { fraction, quantity_g: entry.serving_size_g * fraction, macros: scaleMacros(entry.unit_macros, fraction) };
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
  // Read fresh each render so a change made on the Settings page (even in
  // another tab) takes effect the next time this page re-renders.
  const headingLevels = loadHeadingLevels();

  const downloadMarkdown = () => {
    const markdown = buildMarkdown(date, data.goals, dayTotals, previewed, headingLevels, trackNetCarbs);
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
    const markdown = buildMarkdown(date, data.goals, dayTotals, previewed, headingLevels, trackNetCarbs);
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

  const goToDate = (newDate) => navigate(`/plan/${newDate}`);

  return (
    <div>
      <div
        className="sticky z-20 bg-slate-50 dark:bg-slate-900 pb-4 space-y-6 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.15)]"
        style={{ top: 'var(--app-header-height, 0px)' }}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Link
              to="/plan"
              className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline"
              title="Back to the week grid"
            >
              ‹ Week
            </Link>
            <h1 className="text-xl font-semibold">
              {dayOfWeekLabel(date)}, {formatShortDate(date)}
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {data && (
              <>
                <button
                  onClick={copyMarkdown}
                  className="border dark:border-slate-600 rounded px-3 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  title="Copy the plan as a markdown table"
                >
                  {copied ? 'Copied!' : 'Copy as markdown'}
                </button>
                <button
                  onClick={downloadMarkdown}
                  className="border dark:border-slate-600 rounded px-3 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  title="Download the plan as a .md file"
                >
                  Download .md
                </button>
              </>
            )}
            <div className="flex items-center gap-1">
              <button
                onClick={() => goToDate(addDays(date, -1))}
                className="border dark:border-slate-600 rounded px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800"
                aria-label="Previous day"
              >
                ‹
              </button>
              <input
                type="date"
                value={date}
                onChange={(e) => goToDate(e.target.value)}
                className="border dark:border-slate-600 dark:bg-slate-800 rounded px-2 py-1"
              />
              <button
                onClick={() => goToDate(addDays(date, 1))}
                className="border dark:border-slate-600 rounded px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800"
                aria-label="Next day"
              >
                ›
              </button>
            </div>
          </div>
        </div>

        {data && dayTotals && (
          <div className="space-y-2">
            <div className="sm:hidden grid grid-cols-3 gap-2">
              <MacroMiniStat
                label={trackNetCarbs ? 'Net Carbs' : 'Carbs'}
                colorKey="Carbs"
                planned={trackNetCarbs ? dayTotals.net_carbs_g : dayTotals.carbs_g}
                goal={data.goals.carbs_g}
              />
              <MacroMiniStat label="Fat" planned={dayTotals.fat_g} goal={data.goals.fat_g} />
              <MacroMiniStat label="Protein" planned={dayTotals.protein_g} goal={data.goals.protein_g} />
            </div>
            <div className="hidden sm:grid sm:grid-cols-3 gap-3">
              <MacroGoalCard
                label={trackNetCarbs ? 'Net Carbs' : 'Carbs'}
                colorKey="Carbs"
                planned={trackNetCarbs ? dayTotals.net_carbs_g : dayTotals.carbs_g}
                goal={data.goals.carbs_g}
              />
              <MacroGoalCard label="Fat" planned={dayTotals.fat_g} goal={data.goals.fat_g} />
              <MacroGoalCard label="Protein" planned={dayTotals.protein_g} goal={data.goals.protein_g} />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {Math.round(dayTotals.calories)} kcal planned total
            </p>
          </div>
        )}

        <form onSubmit={onSubmit} className="bg-white dark:bg-slate-800 shadow rounded p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={itemType}
              onChange={(e) => {
                setItemType(e.target.value);
                setItemId('');
              }}
              className="border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
            >
              <option value="food">Food</option>
              <option value="recipe">Recipe</option>
            </select>
          </div>
          <div className="flex-1 min-w-[10rem]">
            <label className="block text-sm font-medium mb-1">Item</label>
            <select
              required
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
            >
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
            <select
              value={mealSlot}
              onChange={(e) => setMealSlot(e.target.value)}
              className="border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
            >
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
          <p className="text-xs text-slate-500 dark:text-slate-400 w-full">
            Adds a full serving — dial it in with the slider below once it's added.
          </p>
          {error && <p className="text-red-600 dark:text-red-400 text-sm w-full">{error}</p>}
        </form>
      </div>

      <div className="bg-white dark:bg-slate-800 shadow rounded divide-y dark:divide-slate-700 mt-6 mb-6">
        {data && data.entries.length === 0 && (
          <p className="p-4 text-slate-500 dark:text-slate-400">Nothing planned yet.</p>
        )}
        {previewed.map(({ entry, preview }) => (
          <div key={entry.id} className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {entry.name} <span className="text-xs text-slate-400 dark:text-slate-500">({entry.meal_slot})</span>
              </p>
              <button onClick={() => removeEntry(entry.id)} className="text-red-600 dark:text-red-400 underline text-sm">
                Remove
              </button>
            </div>

            {entry.item_type === 'food' ? (
              <FractionSlider
                label="Amount"
                fraction={preview.fraction}
                quantityG={preview.quantity_g}
                macros={preview.macros}
                useNetCarbs={trackNetCarbs}
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
                      useNetCarbs={trackNetCarbs}
                      onChange={(v) => setLocalFraction(`${entry.id}:${c.food_id}`, v)}
                      onCommit={() => commitComponentFraction(entry.id, c.food_id)}
                    />
                  ))}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Subtotal: {Math.round(trackNetCarbs ? preview.macros.net_carbs_g : preview.macros.carbs_g)}g{' '}
                  {trackNetCarbs ? 'net carbs' : 'carbs'} · {Math.round(preview.macros.fat_g)}g fat ·{' '}
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

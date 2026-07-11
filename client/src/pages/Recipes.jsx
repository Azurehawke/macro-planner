import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { csvToObjects, downloadCsv } from '../utils/csv.js';

function emptyComponent() {
  return { food_id: '', servings: '' };
}

// Looks up a food's canonical per-serving gram figure so the recipe form can
// work in servings (matching how foods/diary already speak in servings)
// while the backend keeps storing/scaling components in grams.
function servingSizeFor(foods, foodId) {
  const food = foods.find((f) => f.id === Number(foodId));
  return food ? Number(food.serving_size_g) : null;
}

const RECIPES_TEMPLATE_HEADER = ['recipe_name', 'food_name', 'quantity_g'];
const RECIPES_TEMPLATE_ROWS = [
  ['Oatmeal Bowl', 'Rolled Oats', '80'],
  ['Oatmeal Bowl', 'Banana', '120'],
  ['Chicken Bowl', 'Chicken Breast', '150'],
  ['Chicken Bowl', 'White Rice', '200'],
];

// Groups the CSV's "long" rows (one row per recipe/food/quantity) into the
// { name, components: [...] } shape the import endpoint expects.
function groupRowsByRecipe(rows) {
  const byName = new Map();
  for (const row of rows) {
    const name = (row.recipe_name || '').trim();
    if (!name) continue;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push({ food_name: row.food_name, quantity_g: row.quantity_g });
  }
  return Array.from(byName, ([name, components]) => ({ name, components }));
}

export default function Recipes() {
  const { user } = useAuth();
  const trackNetCarbs = Boolean(user?.track_net_carbs);
  const [recipes, setRecipes] = useState([]);
  const [foods, setFoods] = useState([]);
  const [name, setName] = useState('');
  const [components, setComponents] = useState([emptyComponent()]);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState('');

  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const load = async () => {
    const [{ recipes }, { foods }] = await Promise.all([api.get('/recipes'), api.get('/foods')]);
    setRecipes(recipes);
    setFoods(foods);
  };

  useEffect(() => {
    load();
  }, []);

  const updateComponent = (idx, field, value) => {
    setComponents((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const addComponentRow = () => setComponents((prev) => [...prev, emptyComponent()]);
  const removeComponentRow = (idx) => setComponents((prev) => prev.filter((_, i) => i !== idx));

  const resetForm = () => {
    setName('');
    setComponents([emptyComponent()]);
    setEditingId(null);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      name,
      components: components
        .filter((c) => c.food_id && c.servings)
        .map((c) => ({
          food_id: Number(c.food_id),
          quantity_g: Number(c.servings) * servingSizeFor(foods, c.food_id),
        })),
    };
    try {
      if (editingId) {
        await api.put(`/recipes/${editingId}`, payload);
      } else {
        await api.post('/recipes', payload);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (recipe) => {
    setEditingId(recipe.id);
    setName(recipe.name);
    setComponents(
      recipe.components.map((c) => {
        const size = servingSizeFor(foods, c.food_id);
        const servings = size ? Math.round((c.quantity_g / size) * 1000) / 1000 : '';
        return { food_id: String(c.food_id), servings: String(servings) };
      })
    );
    setExpandedId(null);
  };

  const remove = async (id) => {
    if (!confirm('Delete this recipe?')) return;
    await api.del(`/recipes/${id}`);
    await load();
  };

  const downloadTemplate = () => {
    downloadCsv('recipes_template.csv', RECIPES_TEMPLATE_HEADER, RECIPES_TEMPLATE_ROWS);
  };

  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportError('');
    setImportResult(null);
    setImporting(true);
    try {
      const text = await file.text();
      const rows = csvToObjects(text);
      const recipes = groupRowsByRecipe(rows);
      if (recipes.length === 0) {
        throw new Error('That CSV has no rows with a recipe_name to import.');
      }
      const result = await api.post('/recipes/import', { recipes });
      setImportResult(result);
      await load();
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Recipes</h1>

      <div className="bg-white dark:bg-slate-800 shadow rounded p-4 space-y-2">
        <h2 className="font-medium">Import from CSV</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          One row per ingredient — repeat the recipe name for each of its components. Food names must
          already exist on the Foods page (import foods first).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="bg-emerald-700 text-white rounded px-4 py-2 hover:bg-emerald-800 disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Import CSV'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={downloadTemplate}
            className="text-emerald-700 dark:text-emerald-400 underline text-sm"
          >
            Download CSV template
          </button>
        </div>
        {importError && <p className="text-red-600 dark:text-red-400 text-sm">{importError}</p>}
        {importResult && (
          <div className="text-sm">
            <p className="text-emerald-700 dark:text-emerald-400">
              Imported: {importResult.created} added, {importResult.updated} updated
              {importResult.errors.length > 0 && `, ${importResult.errors.length} skipped`}.
            </p>
            {importResult.errors.length > 0 && (
              <ul className="list-disc list-inside text-amber-600 dark:text-amber-400 mt-1">
                {importResult.errors.map((e, i) => (
                  <li key={i}>
                    {e.name}: {e.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="bg-white dark:bg-slate-800 shadow rounded p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Recipe name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1 max-w-sm"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium">Components</label>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Enter how many servings of each food this recipe uses (based on that food's own serving
              size) — not a raw gram amount.
            </span>
          </div>
          {components.map((c, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <select
                required
                value={c.food_id}
                onChange={(e) => updateComponent(idx, 'food_id', e.target.value)}
                className="border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1 flex-1"
              >
                <option value="">Select food...</option>
                {foods.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0.01"
                step="any"
                required
                placeholder="servings"
                value={c.servings}
                onChange={(e) => updateComponent(idx, 'servings', e.target.value)}
                className="border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1 w-28"
              />
              {components.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeComponentRow(idx)}
                  className="text-red-600 dark:text-red-400 text-sm"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addComponentRow} className="text-emerald-700 dark:text-emerald-400 text-sm underline">
            + Add component
          </button>
        </div>

        <div className="flex gap-2">
          <button type="submit" className="bg-emerald-700 text-white rounded px-4 py-2 hover:bg-emerald-800">
            {editingId ? 'Save changes' : 'Add recipe'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="border dark:border-slate-600 rounded px-4 py-2">
              Cancel
            </button>
          )}
        </div>
        {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}
      </form>

      <div className="bg-white dark:bg-slate-800 shadow rounded divide-y dark:divide-slate-700">
        {recipes.length === 0 && (
          <p className="p-4 text-slate-500 dark:text-slate-400">No recipes yet — build one from your foods above.</p>
        )}
        {recipes.map((recipe) => (
          <div key={recipe.id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{recipe.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Total: {Math.round(trackNetCarbs ? recipe.totals.net_carbs_g : recipe.totals.carbs_g)}g{' '}
                  {trackNetCarbs ? 'net carbs' : 'carbs'} · {Math.round(recipe.totals.fat_g)}g fat ·{' '}
                  {Math.round(recipe.totals.protein_g)}g protein · {Math.round(recipe.totals.calories)} kcal
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                <button
                  onClick={() => setExpandedId(expandedId === recipe.id ? null : recipe.id)}
                  className="text-emerald-700 dark:text-emerald-400 underline"
                >
                  {expandedId === recipe.id ? 'Hide' : 'Components'}
                </button>
                <button onClick={() => startEdit(recipe)} className="text-slate-600 dark:text-slate-300 underline">
                  Edit
                </button>
                <button onClick={() => remove(recipe.id)} className="text-red-600 dark:text-red-400 underline">
                  Delete
                </button>
              </div>
            </div>
            {expandedId === recipe.id && (
              <ul className="mt-2 text-sm text-slate-600 dark:text-slate-300 list-disc list-inside">
                {recipe.components.map((c) => {
                  const size = servingSizeFor(foods, c.food_id);
                  const servings = size ? Math.round((c.quantity_g / size) * 100) / 100 : null;
                  return (
                    <li key={c.food_id}>
                      {c.food_name} —{' '}
                      {servings != null
                        ? `${servings} serving${servings === 1 ? '' : 's'} (${c.quantity_g}g)`
                        : `${c.quantity_g}g`}{' '}
                      ({Math.round(c.calories)} kcal)
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

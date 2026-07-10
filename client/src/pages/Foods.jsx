import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { csvToObjects, downloadCsv } from '../utils/csv.js';

const emptyForm = { name: '', base_quantity_g: 100, carbs_g: '', fat_g: '', protein_g: '' };

// Scales a macro field by `ratio`, leaving it untouched if it isn't a valid
// number yet (e.g. still blank while adding a new food).
function scaleField(value, ratio) {
  const num = Number(value);
  if (value === '' || !Number.isFinite(num)) return value;
  return Math.round(num * ratio * 10) / 10;
}

const FOODS_TEMPLATE_HEADER = ['name', 'base_quantity_g', 'carbs_g', 'fat_g', 'protein_g'];
const FOODS_TEMPLATE_ROWS = [
  ['Chicken Breast', '100', '0', '3.6', '31'],
  // base_quantity_g doesn't have to be 100 - here it's a 1-cup (90g) serving,
  // showing the macros scaled to match (66/7/17 per 100g -> 59.4/6.3/15.3 per 90g).
  ['Rolled Oats', '90', '59.4', '6.3', '15.3'],
];

const SOURCE_LABELS = {
  usda: 'USDA FoodData Central',
  openfoodfacts: 'Open Food Facts',
};

export default function Foods() {
  const [foods, setFoods] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [usedIn, setUsedIn] = useState({});
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchWarnings, setSearchWarnings] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchBoxRef = useRef(null);

  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  // The gram amount at the moment "Per grams" was focused, so blurring it
  // can scale the macro fields by how much that amount changed - e.g. typing
  // 240 over 100 doubles carbs/fat/protein to match, instead of leaving them
  // as if nothing changed.
  const [baseAtFocus, setBaseAtFocus] = useState(null);

  const onBaseQuantityBlur = () => {
    const newBase = Number(form.base_quantity_g);
    if (baseAtFocus && newBase > 0 && newBase !== baseAtFocus) {
      const ratio = newBase / baseAtFocus;
      setForm((f) => ({
        ...f,
        carbs_g: scaleField(f.carbs_g, ratio),
        fat_g: scaleField(f.fat_g, ratio),
        protein_g: scaleField(f.protein_g, ratio),
      }));
    }
    setBaseAtFocus(null);
  };

  // Close the results dropdown on an outside click, so it overlays the rest
  // of the page (foods list, add-food form) instead of shifting it around.
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const load = async () => {
    const { foods } = await api.get('/foods');
    setFoods(foods);
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      name: form.name,
      base_quantity_g: Number(form.base_quantity_g),
      carbs_g: Number(form.carbs_g),
      fat_g: Number(form.fat_g),
      protein_g: Number(form.protein_g),
    };
    try {
      if (editingId) {
        await api.put(`/foods/${editingId}`, payload);
      } else {
        await api.post('/foods', payload);
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (food) => {
    setEditingId(food.id);
    setForm({
      name: food.name,
      base_quantity_g: food.base_quantity_g,
      carbs_g: food.carbs_g,
      fat_g: food.fat_g,
      protein_g: food.protein_g,
    });
  };

  const remove = async (id) => {
    if (!confirm('Delete this food? It will be removed from any recipes using it.')) return;
    await api.del(`/foods/${id}`);
    await load();
  };

  const onSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError('');
    setShowDropdown(true);
    try {
      const { results, warnings } = await api.get(`/food-search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchResults(results);
      setSearchWarnings(warnings || []);
    } catch (err) {
      setSearchError(err.message);
      setSearchResults(null);
    } finally {
      setSearching(false);
    }
  };

  const useSearchResult = (result) => {
    setEditingId(null);
    setForm({
      name: result.name,
      base_quantity_g: result.base_quantity_g,
      carbs_g: result.carbs_g,
      fat_g: result.fat_g,
      protein_g: result.protein_g,
    });
    setShowDropdown(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const downloadTemplate = () => {
    downloadCsv('foods_template.csv', FOODS_TEMPLATE_HEADER, FOODS_TEMPLATE_ROWS);
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
      if (rows.length === 0) {
        throw new Error('That CSV has no data rows to import.');
      }
      const foods = rows.map((r) => ({
        name: r.name,
        base_quantity_g: r.base_quantity_g,
        carbs_g: r.carbs_g,
        fat_g: r.fat_g,
        protein_g: r.protein_g,
      }));
      const result = await api.post('/foods/import', { foods });
      setImportResult(result);
      await load();
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const toggleUsedIn = async (food) => {
    if (expandedId === food.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(food.id);
    if (!usedIn[food.id]) {
      const { usedIn: list } = await api.get(`/foods/${food.id}/used-in`);
      setUsedIn((prev) => ({ ...prev, [food.id]: list }));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Foods</h1>

      <div className="bg-white dark:bg-slate-800 shadow rounded p-4 space-y-2">
        <h2 className="font-medium">Import from CSV</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          base_quantity_g is whatever serving size you have macros for — not necessarily 100 (see the
          template's 1-cup oats example).
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
                    Row {e.row} ({e.name}): {e.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div ref={searchBoxRef} className="relative bg-white dark:bg-slate-800 shadow rounded p-4 space-y-3">
        <h2 className="font-medium">Search online</h2>
        <form onSubmit={onSearch} className="flex gap-2">
          <input
            placeholder="e.g. hamburger bun"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => (searchResults || searchError) && setShowDropdown(true)}
            className="flex-1 border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
          />
          <button
            type="submit"
            disabled={searching}
            className="bg-emerald-700 text-white rounded px-4 py-2 hover:bg-emerald-800 disabled:opacity-50 shrink-0"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {showDropdown && (searchResults || searchError) && (
          <div className="absolute left-4 right-4 top-full mt-1 z-20 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded shadow-lg max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Results</span>
              <button
                type="button"
                onClick={() => setShowDropdown(false)}
                aria-label="Close results"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {searchError && <p className="text-red-600 dark:text-red-400 text-sm p-3">{searchError}</p>}
            {searchWarnings.map((w) => (
              <p key={w} className="text-amber-600 dark:text-amber-400 text-xs px-3 pt-2">
                {w}
              </p>
            ))}
            {searchResults && searchResults.length === 0 && (
              <p className="p-3 text-sm text-slate-500 dark:text-slate-400">
                No matches found — try a different search term.
              </p>
            )}
            {searchResults && searchResults.length > 0 && (
              <div className="divide-y dark:divide-slate-700">
                {searchResults.map((result) => (
                  <div
                    key={`${result.source}:${result.externalId}`}
                    className="p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {result.name}
                        {result.brand && (
                          <span className="text-slate-400 dark:text-slate-500 font-normal"> — {result.brand}</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {SOURCE_LABELS[result.source] || result.source} · per 100g: {result.carbs_g}g carbs ·{' '}
                        {result.fat_g}g fat · {result.protein_g}g protein · {Math.round(result.calories)} kcal
                      </p>
                    </div>
                    <button
                      onClick={() => useSearchResult(result)}
                      className="shrink-0 border border-emerald-700 dark:border-emerald-400 text-emerald-700 dark:text-emerald-400 rounded px-3 py-1 text-sm hover:bg-emerald-50 dark:hover:bg-slate-700"
                    >
                      Use this
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400 dark:text-slate-500 p-3 border-t dark:border-slate-700">
              Picking a result fills in the form below — review it (and adjust if it's not quite your
              product) before adding it.
            </p>
          </div>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-white dark:bg-slate-800 shadow rounded p-4 grid grid-cols-2 sm:grid-cols-6 gap-3 items-end"
      >
        <div className="col-span-2 sm:col-span-2">
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Per grams</label>
          <input
            type="number"
            min="1"
            required
            value={form.base_quantity_g}
            onFocus={() => setBaseAtFocus(Number(form.base_quantity_g) || null)}
            onBlur={onBaseQuantityBlur}
            onChange={(e) => setForm({ ...form, base_quantity_g: e.target.value })}
            className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
          />
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Changing this scales carbs/fat/protein below to match. Not sure how many grams your serving
            is? Use the converter (ruler icon in the nav).
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Carbs (g)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            required
            value={form.carbs_g}
            onChange={(e) => setForm({ ...form, carbs_g: e.target.value })}
            className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fat (g)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            required
            value={form.fat_g}
            onChange={(e) => setForm({ ...form, fat_g: e.target.value })}
            className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Protein (g)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            required
            value={form.protein_g}
            onChange={(e) => setForm({ ...form, protein_g: e.target.value })}
            className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
          />
        </div>
        <div className="col-span-2 sm:col-span-6 flex gap-2">
          <button type="submit" className="bg-emerald-700 text-white rounded px-4 py-2 hover:bg-emerald-800">
            {editingId ? 'Save changes' : 'Add food'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
              className="border dark:border-slate-600 rounded px-4 py-2"
            >
              Cancel
            </button>
          )}
        </div>
        {error && <p className="text-red-600 dark:text-red-400 text-sm col-span-6">{error}</p>}
      </form>

      <div className="bg-white dark:bg-slate-800 shadow rounded divide-y dark:divide-slate-700">
        {foods.length === 0 && (
          <p className="p-4 text-slate-500 dark:text-slate-400">No foods yet — add your first ingredient above.</p>
        )}
        {foods.map((food) => (
          <div key={food.id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{food.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Per {food.base_quantity_g}g: {Number(food.carbs_g)}g carbs · {Number(food.fat_g)}g fat ·{' '}
                  {Number(food.protein_g)}g protein · {Math.round(food.calories)} kcal
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                <button onClick={() => toggleUsedIn(food)} className="text-emerald-700 dark:text-emerald-400 underline">
                  Used in
                </button>
                <button onClick={() => startEdit(food)} className="text-slate-600 dark:text-slate-300 underline">
                  Edit
                </button>
                <button onClick={() => remove(food.id)} className="text-red-600 dark:text-red-400 underline">
                  Delete
                </button>
              </div>
            </div>
            {expandedId === food.id && (
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {usedIn[food.id] && usedIn[food.id].length > 0 ? (
                  <ul className="list-disc list-inside">
                    {usedIn[food.id].map((r) => (
                      <li key={r.id}>
                        {r.name} ({r.quantity_g}g)
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Not used in any recipe yet.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

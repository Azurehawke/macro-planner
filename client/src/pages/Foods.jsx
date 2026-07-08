import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';

const emptyForm = { name: '', base_quantity_g: 100, carbs_g: '', fat_g: '', protein_g: '' };

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
            onChange={(e) => setForm({ ...form, base_quantity_g: e.target.value })}
            className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
          />
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

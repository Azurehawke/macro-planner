import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { csvToObjects, downloadCsv } from '../utils/csv.js';
import { SERVING_UNITS, convertWeight, isWeightUnit } from '../utils/unitConversion.js';

const emptyForm = {
  name: '',
  servings: 1,
  serving_size_qty: 100,
  serving_size_unit: 'g',
  manual_grams: '',
  carbs_g: '',
  fat_g: '',
  protein_g: '',
  fiber_g: '',
};

// Scales a macro field by `ratio`, leaving it untouched if it isn't a valid
// number yet (e.g. still blank while adding a new food).
function scaleField(value, ratio) {
  const num = Number(value);
  if (value === '' || !Number.isFinite(num)) return value;
  return Math.round(num * ratio * 10) / 10;
}

// Divides a macro field by `servings`, e.g. when the user typed in the total
// carbs/fat/protein for a whole container that covers several servings.
// Leaves it untouched if it isn't a valid number yet.
function divideField(value, servings) {
  const num = Number(value);
  if (value === '' || !Number.isFinite(num)) return value;
  return Math.round((num / servings) * 100) / 100;
}

// The one gram figure everything downstream (recipes, shopping list, diary
// fractions) actually multiplies against - always qty * grams-per-one-unit,
// same shape regardless of unit. Weight units convert exactly (grams per oz/
// lb/kg is a fixed constant); volume units and "each" need the food's own
// density/size, which only the user can supply (the manual_grams field, read
// as "grams per one {unit}", e.g. grams per cup).
function resolvedGrams(f) {
  const qty = Number(f.serving_size_qty);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  let perUnitGrams;
  if (f.serving_size_unit === 'g') {
    perUnitGrams = 1;
  } else if (isWeightUnit(f.serving_size_unit)) {
    perUnitGrams = convertWeight(1, f.serving_size_unit, 'g');
  } else {
    const manual = Number(f.manual_grams);
    if (!Number.isFinite(manual) || manual <= 0) return null;
    perUnitGrams = manual;
  }
  return qty * perUnitGrams;
}

function unitLabel(unit) {
  return SERVING_UNITS.find((u) => u.value === unit)?.label || unit;
}

// Short singular form for "grams per ___" phrasing - the dropdown's own
// labels are either plural ("cups") or too long ("each (e.g. 1 egg...)") to
// read naturally there.
const SHORT_UNIT = { cup: 'cup', tbsp: 'tbsp', tsp: 'tsp', mL: 'mL', L: 'L', flOz: 'fl oz', each: 'each' };

function pluralUnit(unit, qty) {
  const short = SHORT_UNIT[unit] || unit;
  if (short === 'each' || Number(qty) === 1) return short;
  return `${short}s`;
}

const FOODS_TEMPLATE_HEADER = [
  'name',
  'serving_size_g',
  'serving_size_qty',
  'serving_size_unit',
  'carbs_g',
  'fat_g',
  'protein_g',
  'fiber_g',
];
const FOODS_TEMPLATE_ROWS = [
  ['Chicken Breast', '100', '100', 'g', '0', '3.6', '31', ''],
  // serving_size_g is the one required gram figure - here it's a 1-cup (90g)
  // serving; serving_size_qty/unit are just the label ("1 cup") shown for it.
  // fiber_g is optional - leave blank if you don't track it.
  ['Rolled Oats', '90', '1', 'cup', '59.4', '6.3', '15.3', '9.5'],
];

const SOURCE_LABELS = {
  usda: 'USDA FoodData Central',
  openfoodfacts: 'Open Food Facts',
};

export default function Foods() {
  const { user } = useAuth();
  const trackNetCarbs = Boolean(user?.track_net_carbs);

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

  // The resolved gram amount at the moment the qty/manual-grams field was
  // focused, so blurring it can scale the macro fields by how much that
  // amount changed - e.g. going from a 100g to a 250g serving doubles-and-a-
  // half carbs/fat/protein/fiber to match, instead of leaving them as if
  // nothing changed. Only fires on blur (not every keystroke) so typing
  // "2", "25", "250" doesn't scale three times over.
  const [gramsAtFocus, setGramsAtFocus] = useState(null);

  const captureGramsAtFocus = () => setGramsAtFocus(resolvedGrams(form));

  const scaleIfChanged = (nextForm, before) => {
    const after = resolvedGrams(nextForm);
    if (before && after && after !== before) {
      const ratio = after / before;
      return {
        ...nextForm,
        carbs_g: scaleField(nextForm.carbs_g, ratio),
        fat_g: scaleField(nextForm.fat_g, ratio),
        protein_g: scaleField(nextForm.protein_g, ratio),
        fiber_g: scaleField(nextForm.fiber_g, ratio),
      };
    }
    return nextForm;
  };

  const onQtyOrGramsBlur = () => {
    setForm((f) => scaleIfChanged(f, gramsAtFocus));
    setGramsAtFocus(null);
  };

  // Changing the unit is a single deliberate action (not typed character by
  // character), so it scales immediately rather than waiting for a blur.
  const onUnitChange = (unit) => {
    const before = resolvedGrams(form);
    setForm((f) => scaleIfChanged({ ...f, serving_size_unit: unit }, before));
  };

  const servingGrams = resolvedGrams(form);
  const needsManualGrams = form.serving_size_unit !== 'g' && !isWeightUnit(form.serving_size_unit);

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
    if (!servingGrams) {
      setError('Enter how many grams one serving is (use the converter if you only know a volume amount).');
      return;
    }
    const servings = Number(form.servings) || 1;
    const payload = {
      name: form.name,
      serving_size_g: servingGrams,
      serving_size_qty: Number(form.serving_size_qty),
      serving_size_unit: form.serving_size_unit,
      carbs_g: divideField(form.carbs_g, servings),
      fat_g: divideField(form.fat_g, servings),
      protein_g: divideField(form.protein_g, servings),
      fiber_g: form.fiber_g === '' ? null : divideField(form.fiber_g, servings),
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
    const unit = food.serving_size_unit || 'g';
    const qty = food.serving_size_qty ?? food.serving_size_g;
    // manual_grams is "grams per one {unit}", so reverse the qty multiplication
    // to get back to that per-unit figure from the stored total.
    const perUnitGrams = unit !== 'g' && !isWeightUnit(unit) && qty > 0 ? food.serving_size_g / qty : null;
    setForm({
      name: food.name,
      servings: 1,
      serving_size_qty: qty,
      serving_size_unit: unit,
      manual_grams: perUnitGrams != null ? String(Math.round(perUnitGrams * 100) / 100) : '',
      carbs_g: food.carbs_g,
      fat_g: food.fat_g,
      protein_g: food.protein_g,
      fiber_g: food.fiber_g ?? '',
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
      servings: 1,
      serving_size_qty: result.base_quantity_g,
      serving_size_unit: 'g',
      manual_grams: '',
      carbs_g: result.carbs_g,
      fat_g: result.fat_g,
      protein_g: result.protein_g,
      fiber_g: '',
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
        serving_size_g: r.serving_size_g,
        serving_size_qty: r.serving_size_qty,
        serving_size_unit: r.serving_size_unit,
        carbs_g: r.carbs_g,
        fat_g: r.fat_g,
        protein_g: r.protein_g,
        fiber_g: r.fiber_g,
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
          serving_size_g is the one required gram figure — not necessarily 100 (see the template's 1-cup
          oats example). serving_size_qty/serving_size_unit are just the label shown for it (default to
          matching serving_size_g in grams). fiber_g is optional.
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
          <label className="block text-sm font-medium mb-1">Servings</label>
          <input
            type="number"
            min="0.01"
            step="any"
            required
            value={form.servings}
            onChange={(e) => setForm({ ...form, servings: e.target.value })}
            className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
          />
          {Number(form.servings) !== 1 && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Carbs/fat/protein below are totals for all {form.servings} servings - divided down to
              one serving when saved.
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Serving size</label>
          <input
            type="number"
            min="0.01"
            step="any"
            required
            value={form.serving_size_qty}
            onFocus={captureGramsAtFocus}
            onBlur={onQtyOrGramsBlur}
            onChange={(e) => setForm({ ...form, serving_size_qty: e.target.value })}
            className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Unit</label>
          <select
            value={form.serving_size_unit}
            onChange={(e) => onUnitChange(e.target.value)}
            className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
          >
            {SERVING_UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
          {!needsManualGrams && form.serving_size_unit !== 'g' && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">= {servingGrams ? Math.round(servingGrams * 10) / 10 : '?'}g</p>
          )}
        </div>
        {needsManualGrams ? (
          <div>
            <label className="block text-sm font-medium mb-1">
              Grams per {SHORT_UNIT[form.serving_size_unit] || form.serving_size_unit}
            </label>
            <input
              type="number"
              min="0.1"
              step="any"
              required
              placeholder="e.g. 240"
              value={form.manual_grams}
              onFocus={captureGramsAtFocus}
              onBlur={onQtyOrGramsBlur}
              onChange={(e) => setForm({ ...form, manual_grams: e.target.value })}
              className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
            />
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Depends on this food's density/size — use the converter (ruler icon in the nav) if you only
              know a volume.{' '}
              {servingGrams
                ? `${Math.round(servingGrams * 100) / 100}g total for ${form.serving_size_qty} ${pluralUnit(form.serving_size_unit, form.serving_size_qty)}.`
                : ''}
            </p>
          </div>
        ) : (
          <div />
        )}
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
        {trackNetCarbs && (
          <div>
            <label className="block text-sm font-medium mb-1">Fiber (g)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              placeholder="optional"
              value={form.fiber_g}
              onChange={(e) => setForm({ ...form, fiber_g: e.target.value })}
              className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
            />
          </div>
        )}
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
        <p className="col-span-2 sm:col-span-6 text-[11px] text-slate-400 dark:text-slate-500">
          Changing serving size scales carbs/fat/protein{trackNetCarbs ? '/fiber' : ''} below to match.
          Set Servings above 1 if the numbers you're entering are a total across multiple servings
          (e.g. copying a whole container's macros) - they'll be divided down to one serving on save.
        </p>
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
                  Per {food.serving_size_qty}{' '}
                  {food.serving_size_unit === 'g'
                    ? unitLabel(food.serving_size_unit)
                    : pluralUnit(food.serving_size_unit, food.serving_size_qty)}
                  {food.serving_size_unit !== 'g' ? ` (${food.serving_size_g}g)` : ''}:{' '}
                  {Number(food.carbs_g)}g carbs
                  {trackNetCarbs && food.fiber_g != null && ` (${Number(food.net_carbs_g).toFixed(1)}g net)`} ·{' '}
                  {Number(food.fat_g)}g fat · {Number(food.protein_g)}g protein
                  {trackNetCarbs && food.fiber_g != null && ` · ${Number(food.fiber_g)}g fiber`} ·{' '}
                  {Math.round(food.calories)} kcal
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

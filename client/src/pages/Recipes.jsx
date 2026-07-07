import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';

function emptyComponent() {
  return { food_id: '', quantity_g: '' };
}

export default function Recipes() {
  const [recipes, setRecipes] = useState([]);
  const [foods, setFoods] = useState([]);
  const [name, setName] = useState('');
  const [components, setComponents] = useState([emptyComponent()]);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState('');

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
        .filter((c) => c.food_id && c.quantity_g)
        .map((c) => ({ food_id: Number(c.food_id), quantity_g: Number(c.quantity_g) })),
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
      recipe.components.map((c) => ({ food_id: String(c.food_id), quantity_g: String(c.quantity_g) }))
    );
    setExpandedId(null);
  };

  const remove = async (id) => {
    if (!confirm('Delete this recipe?')) return;
    await api.del(`/recipes/${id}`);
    await load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Recipes</h1>

      <form onSubmit={onSubmit} className="bg-white shadow rounded p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Recipe name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded px-2 py-1 max-w-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Components</label>
          {components.map((c, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <select
                required
                value={c.food_id}
                onChange={(e) => updateComponent(idx, 'food_id', e.target.value)}
                className="border rounded px-2 py-1 flex-1"
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
                min="0"
                step="0.1"
                required
                placeholder="grams"
                value={c.quantity_g}
                onChange={(e) => updateComponent(idx, 'quantity_g', e.target.value)}
                className="border rounded px-2 py-1 w-28"
              />
              {components.length > 1 && (
                <button type="button" onClick={() => removeComponentRow(idx)} className="text-red-600 text-sm">
                  Remove
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addComponentRow} className="text-emerald-700 text-sm underline">
            + Add component
          </button>
        </div>

        <div className="flex gap-2">
          <button type="submit" className="bg-emerald-700 text-white rounded px-4 py-2 hover:bg-emerald-800">
            {editingId ? 'Save changes' : 'Add recipe'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="border rounded px-4 py-2">
              Cancel
            </button>
          )}
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </form>

      <div className="bg-white shadow rounded divide-y">
        {recipes.length === 0 && (
          <p className="p-4 text-slate-500">No recipes yet — build one from your foods above.</p>
        )}
        {recipes.map((recipe) => (
          <div key={recipe.id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{recipe.name}</p>
                <p className="text-sm text-slate-500">
                  Total: {Math.round(recipe.totals.carbs_g)}g carbs · {Math.round(recipe.totals.fat_g)}g fat ·{' '}
                  {Math.round(recipe.totals.protein_g)}g protein · {Math.round(recipe.totals.calories)} kcal
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                <button
                  onClick={() => setExpandedId(expandedId === recipe.id ? null : recipe.id)}
                  className="text-emerald-700 underline"
                >
                  {expandedId === recipe.id ? 'Hide' : 'Components'}
                </button>
                <button onClick={() => startEdit(recipe)} className="text-slate-600 underline">
                  Edit
                </button>
                <button onClick={() => remove(recipe.id)} className="text-red-600 underline">
                  Delete
                </button>
              </div>
            </div>
            {expandedId === recipe.id && (
              <ul className="mt-2 text-sm text-slate-600 list-disc list-inside">
                {recipe.components.map((c) => (
                  <li key={c.food_id}>
                    {c.food_name} — {c.quantity_g}g ({Math.round(c.calories)} kcal)
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

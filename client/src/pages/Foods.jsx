import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';

const emptyForm = { name: '', base_quantity_g: 100, carbs_g: '', fat_g: '', protein_g: '' };

export default function Foods() {
  const [foods, setFoods] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [usedIn, setUsedIn] = useState({});
  const [error, setError] = useState('');

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

      <form onSubmit={onSubmit} className="bg-white shadow rounded p-4 grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
        <div className="col-span-2 sm:col-span-2">
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded px-2 py-1"
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
            className="w-full border rounded px-2 py-1"
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
            className="w-full border rounded px-2 py-1"
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
            className="w-full border rounded px-2 py-1"
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
            className="w-full border rounded px-2 py-1"
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
              className="border rounded px-4 py-2"
            >
              Cancel
            </button>
          )}
        </div>
        {error && <p className="text-red-600 text-sm col-span-6">{error}</p>}
      </form>

      <div className="bg-white shadow rounded divide-y">
        {foods.length === 0 && <p className="p-4 text-slate-500">No foods yet — add your first ingredient above.</p>}
        {foods.map((food) => (
          <div key={food.id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{food.name}</p>
                <p className="text-sm text-slate-500">
                  Per {food.base_quantity_g}g: {Number(food.carbs_g)}g carbs · {Number(food.fat_g)}g fat ·{' '}
                  {Number(food.protein_g)}g protein · {Math.round(food.calories)} kcal
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                <button onClick={() => toggleUsedIn(food)} className="text-emerald-700 underline">
                  Used in
                </button>
                <button onClick={() => startEdit(food)} className="text-slate-600 underline">
                  Edit
                </button>
                <button onClick={() => remove(food.id)} className="text-red-600 underline">
                  Delete
                </button>
              </div>
            </div>
            {expandedId === food.id && (
              <div className="mt-2 text-sm text-slate-600">
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

import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack', 'other'];

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

export default function Diary() {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState(null);
  const [foods, setFoods] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [itemType, setItemType] = useState('food');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [mealSlot, setMealSlot] = useState('breakfast');
  const [error, setError] = useState('');

  const load = async () => {
    const [diary, { foods }, { recipes }] = await Promise.all([
      api.get(`/diary?date=${date}`),
      api.get('/foods'),
      api.get('/recipes'),
    ]);
    setData(diary);
    setFoods(foods);
    setRecipes(recipes);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!itemId || !quantity) return;
    try {
      await api.post('/diary', {
        entry_date: date,
        item_type: itemType,
        food_id: itemType === 'food' ? Number(itemId) : undefined,
        recipe_id: itemType === 'recipe' ? Number(itemId) : undefined,
        quantity_g: Number(quantity),
        meal_slot: mealSlot,
      });
      setItemId('');
      setQuantity('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeEntry = async (id) => {
    await api.del(`/diary/${id}`);
    await load();
  };

  const options = itemType === 'food' ? foods : recipes;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Diary</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-2 py-1"
        />
      </div>

      {data && (
        <div className="bg-white shadow rounded p-4 space-y-3">
          <h2 className="font-medium">Totals for {date}</h2>
          <GoalBar label="Carbs" value={data.totals.carbs_g} goal={data.goals.carbs_g} />
          <GoalBar label="Fat" value={data.totals.fat_g} goal={data.goals.fat_g} />
          <GoalBar label="Protein" value={data.totals.protein_g} goal={data.goals.protein_g} />
          <p className="text-sm text-slate-500">{Math.round(data.totals.calories)} kcal total</p>
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
          <label className="block text-sm font-medium mb-1">Grams</label>
          <input
            type="number"
            min="0"
            step="0.1"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="border rounded px-2 py-1 w-24"
          />
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
          Add
        </button>
        {error && <p className="text-red-600 text-sm w-full">{error}</p>}
      </form>

      <div className="bg-white shadow rounded divide-y">
        {data && data.entries.length === 0 && <p className="p-4 text-slate-500">Nothing logged yet.</p>}
        {data &&
          data.entries.map((entry) => (
            <div key={entry.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {entry.name} <span className="text-xs text-slate-400">({entry.meal_slot})</span>
                </p>
                <p className="text-sm text-slate-500">
                  {entry.quantity_g}g · {Math.round(entry.macros.carbs_g)}g carbs ·{' '}
                  {Math.round(entry.macros.fat_g)}g fat · {Math.round(entry.macros.protein_g)}g protein ·{' '}
                  {Math.round(entry.macros.calories)} kcal
                </p>
              </div>
              <button onClick={() => removeEntry(entry.id)} className="text-red-600 underline text-sm">
                Remove
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

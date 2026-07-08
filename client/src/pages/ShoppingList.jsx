import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function ShoppingList() {
  const [lists, setLists] = useState([]);
  const [activeListId, setActiveListId] = useState(null);
  const [list, setList] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [foods, setFoods] = useState([]);
  const [recipeId, setRecipeId] = useState('');
  const [multiplier, setMultiplier] = useState('1');
  const [foodId, setFoodId] = useState('');
  const [foodQty, setFoodQty] = useState('');
  const [newListName, setNewListName] = useState('');
  const [error, setError] = useState('');

  const loadLists = async () => {
    let { shoppingLists } = await api.get('/shopping-lists');
    if (shoppingLists.length === 0) {
      const { shoppingList } = await api.post('/shopping-lists', { name: 'Shopping List' });
      shoppingLists = [shoppingList];
    }
    setLists(shoppingLists);
    setActiveListId((prev) => prev || shoppingLists[0].id);
  };

  const loadList = async (id) => {
    if (!id) return;
    const { shoppingList } = await api.get(`/shopping-lists/${id}`);
    setList(shoppingList);
  };

  useEffect(() => {
    loadLists();
    api.get('/recipes').then(({ recipes }) => setRecipes(recipes));
    api.get('/foods').then(({ foods }) => setFoods(foods));
  }, []);

  useEffect(() => {
    loadList(activeListId);
  }, [activeListId]);

  const addRecipe = async (e) => {
    e.preventDefault();
    setError('');
    if (!recipeId) return;
    try {
      await api.post(`/shopping-lists/${activeListId}/items/from-recipe`, {
        recipe_id: Number(recipeId),
        multiplier: Number(multiplier) || 1,
      });
      setRecipeId('');
      setMultiplier('1');
      await loadList(activeListId);
    } catch (err) {
      setError(err.message);
    }
  };

  const addFood = async (e) => {
    e.preventDefault();
    setError('');
    if (!foodId || !foodQty) return;
    try {
      await api.post(`/shopping-lists/${activeListId}/items`, {
        food_id: Number(foodId),
        quantity_g: Number(foodQty),
      });
      setFoodId('');
      setFoodQty('');
      await loadList(activeListId);
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleChecked = async (item) => {
    await api.put(`/shopping-lists/${activeListId}/items/${item.id}`, { checked: !item.checked });
    await loadList(activeListId);
  };

  const removeItem = async (item) => {
    await api.del(`/shopping-lists/${activeListId}/items/${item.id}`);
    await loadList(activeListId);
  };

  const createList = async (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    const { shoppingList } = await api.post('/shopping-lists', { name: newListName.trim() });
    setNewListName('');
    await loadLists();
    setActiveListId(shoppingList.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">Shopping List</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={activeListId || ''}
            onChange={(e) => setActiveListId(Number(e.target.value))}
            className="border dark:border-slate-600 dark:bg-slate-800 rounded px-2 py-1 min-w-0"
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <form onSubmit={createList} className="flex gap-1 min-w-0">
            <input
              placeholder="New list name"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              className="border dark:border-slate-600 dark:bg-slate-800 rounded px-2 py-1 text-sm w-32 min-w-0"
            />
            <button type="submit" className="border dark:border-slate-600 rounded px-2 py-1 text-sm shrink-0">
              + New list
            </button>
          </form>
        </div>
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        Shared with your whole household — anyone in your household sees the same list and can check
        items off.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <form onSubmit={addRecipe} className="bg-white dark:bg-slate-800 shadow rounded p-4 space-y-2">
          <h2 className="font-medium">Add from a recipe</h2>
          <select
            value={recipeId}
            onChange={(e) => setRecipeId(e.target.value)}
            className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
          >
            <option value="">Select recipe...</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <label className="text-sm">Servings multiplier</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
              className="border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1 w-20"
            />
          </div>
          <button type="submit" className="bg-emerald-700 text-white rounded px-4 py-2 hover:bg-emerald-800">
            Add ingredients
          </button>
        </form>

        <form onSubmit={addFood} className="bg-white dark:bg-slate-800 shadow rounded p-4 space-y-2">
          <h2 className="font-medium">Add a single item</h2>
          <select
            value={foodId}
            onChange={(e) => setFoodId(e.target.value)}
            className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
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
            placeholder="grams"
            value={foodQty}
            onChange={(e) => setFoodQty(e.target.value)}
            className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
          />
          <button type="submit" className="bg-emerald-700 text-white rounded px-4 py-2 hover:bg-emerald-800">
            Add item
          </button>
        </form>
      </div>

      {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}

      <div className="bg-white dark:bg-slate-800 shadow rounded divide-y dark:divide-slate-700">
        {list && list.items.length === 0 && (
          <p className="p-4 text-slate-500 dark:text-slate-400">List is empty.</p>
        )}
        {list &&
          list.items.map((item) => (
            <div key={item.id} className="p-4 flex items-center justify-between">
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={item.checked} onChange={() => toggleChecked(item)} />
                <span className={item.checked ? 'line-through text-slate-400 dark:text-slate-500' : ''}>
                  {item.food_name} — {Math.round(item.quantity_g)}g
                  {item.source_recipe_name && (
                    <span className="text-xs text-slate-400 dark:text-slate-500"> (for {item.source_recipe_name})</span>
                  )}
                </span>
              </label>
              <button onClick={() => removeItem(item)} className="text-red-600 dark:text-red-400 underline text-sm">
                Remove
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

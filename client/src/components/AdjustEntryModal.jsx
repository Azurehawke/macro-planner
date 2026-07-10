import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { dayOfWeekLabel, formatShortDate } from '../utils/date.js';

const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack', 'other'];
const MEAL_SLOT_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack', other: 'Other' };
// A serving isn't capped at "3x" the way a vague fraction was - a food whose
// serving is small (e.g. one almond) can reasonably need many servings.
const MAX_SERVINGS = 10;

function scaleMacros(unitMacros, fraction) {
  return {
    carbs_g: unitMacros.carbs_g * fraction,
    fat_g: unitMacros.fat_g * fraction,
    protein_g: unitMacros.protein_g * fraction,
    net_carbs_g: (unitMacros.net_carbs_g ?? unitMacros.carbs_g) * fraction,
    calories: unitMacros.calories * fraction,
  };
}

// Opened by clicking a placed card in the week grid. Day/meal changes save
// immediately (same effect as dragging the card to another cell) and just
// refresh the grid behind the modal; only Remove/Done actually close it.
export default function AdjustEntryModal({ entry, days, onRefresh, onClose }) {
  const { user } = useAuth();
  const trackNetCarbs = Boolean(user?.track_net_carbs);
  const [day, setDay] = useState(entry.entry_date);
  const [slot, setSlot] = useState(entry.meal_slot);
  const [fraction, setFraction] = useState(entry.item_type === 'food' ? entry.fraction : null);
  const [removing, setRemoving] = useState(false);

  const changeLocation = async (nextDay, nextSlot) => {
    setDay(nextDay);
    setSlot(nextSlot);
    await api.patch(`/diary/${entry.id}`, { entry_date: nextDay, meal_slot: nextSlot });
    onRefresh();
  };

  const commitFraction = async (value) => {
    await api.put(`/diary/${entry.id}`, { fraction: value });
    onRefresh();
  };

  const remove = async () => {
    setRemoving(true);
    await api.del(`/diary/${entry.id}`);
    onClose();
  };

  const previewMacros = entry.item_type === 'food' ? scaleMacros(entry.unit_macros, fraction) : entry.macros;
  const carbsValue = trackNetCarbs ? previewMacros.net_carbs_g : previewMacros.carbs_g;
  const carbsLabel = trackNetCarbs ? 'net carbs' : 'carbs';

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded shadow-lg w-full max-w-sm p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="font-medium">{entry.name}</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 capitalize">{entry.item_type}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1 text-slate-500 dark:text-slate-400">Day</label>
            <select
              value={day}
              onChange={(e) => changeLocation(e.target.value, slot)}
              className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1 text-sm"
            >
              {days.map((d) => (
                <option key={d.date} value={d.date}>
                  {dayOfWeekLabel(d.date)}, {formatShortDate(d.date)}
                </option>
              ))}
              {!days.some((d) => d.date === day) && <option value={day}>{formatShortDate(day)}</option>}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-slate-500 dark:text-slate-400">Meal</label>
            <select
              value={slot}
              onChange={(e) => changeLocation(day, e.target.value)}
              className="w-full border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1 text-sm"
            >
              {MEAL_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {MEAL_SLOT_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {entry.item_type === 'food' ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Servings</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">{fraction.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max={MAX_SERVINGS}
              step="0.05"
              value={fraction}
              onChange={(e) => setFraction(Number(e.target.value))}
              onMouseUp={(e) => commitFraction(Number(e.target.value))}
              onTouchEnd={(e) => commitFraction(Number(e.target.value))}
              onKeyUp={(e) => commitFraction(Number(e.target.value))}
              className="w-full accent-emerald-700"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {Math.round(previewMacros.calories)} kcal · {Math.round(carbsValue)}g {carbsLabel} ·{' '}
              {Math.round(previewMacros.fat_g)}g fat · {Math.round(previewMacros.protein_g)}g protein
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {Math.round(previewMacros.calories)} kcal · {Math.round(carbsValue)}g {carbsLabel} ·{' '}
              {Math.round(previewMacros.fat_g)}g fat · {Math.round(previewMacros.protein_g)}g protein
            </p>
            <Link
              to={`/plan/${day}`}
              onClick={onClose}
              className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              Adjust ingredient amounts on the Day view →
            </Link>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={remove}
            disabled={removing}
            className="text-rose-600 dark:text-rose-400 text-sm hover:underline disabled:opacity-50"
          >
            Remove
          </button>
          <button
            onClick={onClose}
            className="bg-emerald-700 text-white rounded px-4 py-1.5 text-sm hover:bg-emerald-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

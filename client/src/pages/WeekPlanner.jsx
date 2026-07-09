import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { api } from '../api/client.js';
import AdjustEntryModal from '../components/AdjustEntryModal.jsx';
import { addDays, dayNum, dayOfWeekLabel, formatShortDate, startOfWeek, todayISO } from '../utils/date.js';

const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_SLOT_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

// Same Atwater conversion the server uses (server/src/utils/macros.js), just
// needed here to turn the gram-based goals from Settings into a calorie
// figure for the grid's per-day totals row.
function goalCalories(goals) {
  if (goals.carbs_g == null || goals.fat_g == null || goals.protein_g == null) return null;
  return Number(goals.carbs_g) * 4 + Number(goals.fat_g) * 9 + Number(goals.protein_g) * 4;
}

function PaletteItem({ kind, id, name }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${kind}-${id}`,
    data: { source: 'palette', item_type: kind, id },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing touch-none ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <span className="text-slate-400 dark:text-slate-500">⠿⠿</span>
      <span className="truncate flex-1">{name}</span>
      <span className="uppercase text-[9px] text-slate-400 dark:text-slate-500">{kind}</span>
    </div>
  );
}

function PlacedCard({ entry, onOpen }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `entry-${entry.id}`,
    data: { source: 'placed', entryId: entry.id },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(entry)}
      className={`bg-white dark:bg-slate-800 border dark:border-slate-700 border-l-4 border-l-emerald-600 rounded px-1.5 py-1 text-[11px] cursor-pointer shadow-sm touch-none ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <div className="font-medium truncate">{entry.name}</div>
      <div className="text-slate-400 dark:text-slate-500">{Math.round(entry.macros.calories)} kcal</div>
    </div>
  );
}

function GridCell({ date, slot, entries, onOpenEntry, onCopyRequest }) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell-${date}-${slot}`, data: { date, slot } });
  return (
    <div
      ref={setNodeRef}
      className={`border-r border-b dark:border-slate-700 p-1.5 min-h-[4.5rem] flex flex-col gap-1 ${
        isOver ? 'bg-emerald-50 dark:bg-emerald-950/40' : ''
      }`}
    >
      {entries.map((entry) => (
        <PlacedCard key={entry.id} entry={entry} onOpen={onOpenEntry} />
      ))}
      {entries.length === 0 && (
        <button
          onClick={() => onCopyRequest(date, slot)}
          className="text-[10px] text-slate-300 dark:text-slate-600 hover:text-emerald-600 dark:hover:text-emerald-400 text-left"
        >
          + copy...
        </button>
      )}
    </div>
  );
}

export default function WeekPlanner() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayISO()));
  const [weekData, setWeekData] = useState(null);
  const [foods, setFoods] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [search, setSearch] = useState('');
  const [openEntry, setOpenEntry] = useState(null);
  const [copyTarget, setCopyTarget] = useState(null);
  const [copyOptions, setCopyOptions] = useState(null);
  const [copyingWeek, setCopyingWeek] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const load = async (start) => {
    const [week, { foods }, { recipes }] = await Promise.all([
      api.get(`/diary/week?start=${start}`),
      api.get('/foods'),
      api.get('/recipes'),
    ]);
    setWeekData(week);
    setFoods(foods);
    setRecipes(recipes);
  };

  useEffect(() => {
    load(weekStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const days = weekData?.days ?? [];
  const goals = weekData?.goals ?? {};
  const goalKcal = goalCalories(goals);

  const entriesBySlot = (day) => {
    const map = { breakfast: [], lunch: [], dinner: [], snack: [] };
    for (const e of day.entries) {
      const slot = MEAL_SLOTS.includes(e.meal_slot) ? e.meal_slot : 'snack';
      map[slot].push(e);
    }
    return map;
  };

  const filteredFoods = useMemo(
    () => foods.filter((f) => f.name.toLowerCase().includes(search.toLowerCase())),
    [foods, search]
  );
  const filteredRecipes = useMemo(
    () => recipes.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [recipes, search]
  );

  const addToCell = async (date, slot, item_type, id) => {
    await api.post('/diary', {
      entry_date: date,
      item_type,
      food_id: item_type === 'food' ? id : undefined,
      recipe_id: item_type === 'recipe' ? id : undefined,
      meal_slot: slot,
    });
    await load(weekStart);
  };

  const moveEntry = async (entryId, date, slot) => {
    await api.patch(`/diary/${entryId}`, { entry_date: date, meal_slot: slot });
    await load(weekStart);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    const { date, slot } = over.data.current;
    const from = active.data.current;
    if (from.source === 'palette') {
      addToCell(date, slot, from.item_type, from.id);
    } else if (from.source === 'placed') {
      const entry = days.flatMap((d) => d.entries).find((e) => e.id === from.entryId);
      if (entry && (entry.entry_date !== date || entry.meal_slot !== slot)) {
        moveEntry(from.entryId, date, slot);
      }
    }
  };

  const openCopyOptions = async (date, slot) => {
    setCopyTarget({ date, slot });
    setCopyOptions(null);
    const candidates = [addDays(date, -1), addDays(date, -7)];
    const results = await Promise.all(
      candidates.map(async (candidateDate) => {
        try {
          const res = await api.get(`/diary?date=${candidateDate}`);
          return { date: candidateDate, items: res.entries.filter((e) => e.meal_slot === slot) };
        } catch {
          return { date: candidateDate, items: [] };
        }
      })
    );
    setCopyOptions(results.filter((r) => r.items.length > 0));
  };

  const doCopy = async (fromDate) => {
    if (!copyTarget) return;
    await api.post('/diary/copy', { from_date: fromDate, to_date: copyTarget.date, meal_slot: copyTarget.slot });
    setCopyTarget(null);
    setCopyOptions(null);
    await load(weekStart);
  };

  const copyLastWeek = async () => {
    setCopyingWeek(true);
    try {
      const prevStart = addDays(weekStart, -7);
      await Promise.all(
        Array.from({ length: 7 }, (_, i) =>
          api.post('/diary/copy', { from_date: addDays(prevStart, i), to_date: addDays(weekStart, i) })
        )
      );
      await load(weekStart);
    } finally {
      setCopyingWeek(false);
    }
  };

  const closeAndReload = () => {
    setOpenEntry(null);
    load(weekStart);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">Weekly Plan</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="border dark:border-slate-600 rounded px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800"
            aria-label="Previous week"
          >
            ‹
          </button>
          <span className="text-sm font-medium">
            {formatShortDate(weekStart)} – {formatShortDate(addDays(weekStart, 6))}
          </span>
          <button
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="border dark:border-slate-600 rounded px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800"
            aria-label="Next week"
          >
            ›
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(todayISO()))}
            className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            This week
          </button>
          <button
            onClick={copyLastWeek}
            disabled={copyingWeek}
            className="border dark:border-slate-600 rounded px-2 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {copyingWeek ? 'Copying…' : 'Copy last week'}
          </button>
        </div>
      </div>

      {/* Mobile: no room for 7 columns, so just link into each day's full view. */}
      <div className="sm:hidden space-y-2">
        {days.map((day) => {
          const isToday = day.date === todayISO();
          return (
            <Link
              key={day.date}
              to={`/plan/${day.date}`}
              className={`flex items-center justify-between bg-white dark:bg-slate-800 border dark:border-slate-700 rounded px-3 py-2 ${
                isToday ? 'ring-1 ring-emerald-600' : ''
              }`}
            >
              <span className="font-medium">
                {dayOfWeekLabel(day.date)}{' '}
                <span className="text-slate-400 dark:text-slate-500 font-normal">{formatShortDate(day.date)}</span>
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {Math.round(day.totals.calories)}
                {goalKcal ? ` / ${Math.round(goalKcal)}` : ''} kcal
              </span>
            </Link>
          );
        })}
      </div>

      {/* Desktop: drag-and-drop grid */}
      <div className="hidden sm:block bg-white dark:bg-slate-800 border dark:border-slate-700 rounded shadow overflow-hidden">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex">
            <div className="w-48 shrink-0 border-r dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 space-y-2">
              <h3 className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Add to plan</h3>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search foods & recipes…"
                className="w-full border dark:border-slate-600 dark:bg-slate-800 rounded px-2 py-1 text-xs"
              />
              <div className="space-y-1 max-h-[26rem] overflow-y-auto">
                {filteredFoods.map((f) => (
                  <PaletteItem key={`food-${f.id}`} kind="food" id={f.id} name={f.name} />
                ))}
                {filteredRecipes.map((r) => (
                  <PaletteItem key={`recipe-${r.id}`} kind="recipe" id={r.id} name={r.name} />
                ))}
                {filteredFoods.length === 0 && filteredRecipes.length === 0 && (
                  <p className="text-xs text-slate-400 dark:text-slate-500">No matches.</p>
                )}
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Drag onto a cell to plan it.</p>
            </div>

            <div className="flex-1 overflow-x-auto">
              <div
                className="grid"
                style={{ gridTemplateColumns: '5.5rem repeat(7, minmax(7.5rem, 1fr))', minWidth: '56rem' }}
              >
                <div className="border-r border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900" />
                {days.map((day) => {
                  const isToday = day.date === todayISO();
                  return (
                    <button
                      key={day.date}
                      onClick={() => navigate(`/plan/${day.date}`)}
                      className="border-r border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900 py-1.5 text-center hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400">
                        {dayOfWeekLabel(day.date)}
                      </div>
                      <div
                        className={`text-sm font-semibold ${isToday ? 'text-emerald-700 dark:text-emerald-400' : ''}`}
                      >
                        {dayNum(day.date)}
                      </div>
                    </button>
                  );
                })}

                {MEAL_SLOTS.map((slot) => (
                  <React.Fragment key={slot}>
                    <div className="border-r border-b dark:border-slate-700 px-2 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center">
                      {MEAL_SLOT_LABELS[slot]}
                    </div>
                    {days.map((day) => (
                      <GridCell
                        key={`${day.date}-${slot}`}
                        date={day.date}
                        slot={slot}
                        entries={entriesBySlot(day)[slot]}
                        onOpenEntry={setOpenEntry}
                        onCopyRequest={openCopyOptions}
                      />
                    ))}
                  </React.Fragment>
                ))}

                <div className="border-r dark:border-slate-700 px-2 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center">
                  Total
                </div>
                {days.map((day) => {
                  const over = goalKcal != null && day.totals.calories > goalKcal;
                  return (
                    <div
                      key={`total-${day.date}`}
                      className="border-r dark:border-slate-700 px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 flex items-center justify-between"
                    >
                      <span className={`font-semibold ${over ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                        {Math.round(day.totals.calories)}
                      </span>
                      {goalKcal != null && (
                        <span className="text-slate-400 dark:text-slate-500">/ {Math.round(goalKcal)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DndContext>
      </div>

      {openEntry && <AdjustEntryModal entry={openEntry} days={days} onRefresh={() => load(weekStart)} onClose={closeAndReload} />}

      {copyTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setCopyTarget(null)}>
          <div
            className="bg-white dark:bg-slate-800 rounded shadow-lg w-72 p-4 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-medium text-sm">
              Copy into {dayOfWeekLabel(copyTarget.date)} {MEAL_SLOT_LABELS[copyTarget.slot]}
            </h3>
            {copyOptions == null && <p className="text-xs text-slate-400 dark:text-slate-500">Checking recent days…</p>}
            {copyOptions && copyOptions.length === 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                No recent {MEAL_SLOT_LABELS[copyTarget.slot].toLowerCase()} to copy from.
              </p>
            )}
            {copyOptions &&
              copyOptions.map((opt) => (
                <button
                  key={opt.date}
                  onClick={() => doCopy(opt.date)}
                  className="w-full text-left border dark:border-slate-600 rounded px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  {dayOfWeekLabel(opt.date)} {formatShortDate(opt.date)}: {opt.items.map((i) => i.name).join(', ')}
                </button>
              ))}
            <button onClick={() => setCopyTarget(null)} className="text-xs text-slate-400 dark:text-slate-500 hover:underline">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

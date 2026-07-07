const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireHousehold } = require('../middleware/auth');
const { scaleFood, sumMacros } = require('../utils/macros');

const router = express.Router();
router.use(requireAuth, requireHousehold);

async function fetchEntryRows(userId, date) {
  const { rows } = await pool.query(
    `SELECT de.*, f.name AS food_name, f.base_quantity_g AS food_base_quantity_g,
            f.carbs_g AS food_carbs_g, f.fat_g AS food_fat_g, f.protein_g AS food_protein_g,
            r.name AS recipe_name
     FROM diary_entries de
     LEFT JOIN foods f ON f.id = de.food_id
     LEFT JOIN recipes r ON r.id = de.recipe_id
     WHERE de.user_id = $1 AND de.entry_date = $2
     ORDER BY de.created_at ASC`,
    [userId, date]
  );
  return rows;
}

async function fetchComponentsForEntries(entryIds) {
  if (entryIds.length === 0) return new Map();
  const { rows } = await pool.query(
    `SELECT dec.diary_entry_id, dec.fraction, dec.base_quantity_g,
            f.id AS food_id, f.name AS food_name,
            f.base_quantity_g AS food_base_quantity_g, f.carbs_g, f.fat_g, f.protein_g
     FROM diary_entry_components dec
     JOIN foods f ON f.id = dec.food_id
     WHERE dec.diary_entry_id = ANY($1::int[])
     ORDER BY f.name ASC`,
    [entryIds]
  );
  const byEntry = new Map();
  for (const row of rows) {
    const foodLike = {
      base_quantity_g: row.food_base_quantity_g,
      carbs_g: row.carbs_g,
      fat_g: row.fat_g,
      protein_g: row.protein_g,
    };
    // unit_macros = macros for the full recipe-defined amount (fraction 1), so the
    // frontend can recompute macros for any fraction locally as unit_macros * fraction.
    const unit_macros = scaleFood(foodLike, Number(row.base_quantity_g));
    const fraction = Number(row.fraction);
    const quantity_g = Number(row.base_quantity_g) * fraction;
    const component = {
      food_id: row.food_id,
      food_name: row.food_name,
      base_quantity_g: Number(row.base_quantity_g),
      fraction,
      quantity_g,
      unit_macros,
      macros: scaleFood(foodLike, quantity_g),
    };
    if (!byEntry.has(row.diary_entry_id)) byEntry.set(row.diary_entry_id, []);
    byEntry.get(row.diary_entry_id).push(component);
  }
  return byEntry;
}

function buildFoodEntry(row) {
  const foodLike = {
    base_quantity_g: row.food_base_quantity_g,
    carbs_g: row.food_carbs_g,
    fat_g: row.food_fat_g,
    protein_g: row.food_protein_g,
  };
  const fraction = Number(row.fraction);
  const base_quantity_g = Number(row.food_base_quantity_g);
  const quantity_g = base_quantity_g * fraction;
  // unit_macros = macros for one full base_quantity_g serving (fraction 1).
  const unit_macros = scaleFood(foodLike, base_quantity_g);
  return {
    id: row.id,
    entry_date: row.entry_date,
    item_type: 'food',
    food_id: row.food_id,
    recipe_id: null,
    name: row.food_name,
    meal_slot: row.meal_slot,
    fraction,
    base_quantity_g,
    quantity_g,
    unit_macros,
    macros: scaleFood(foodLike, quantity_g),
  };
}

function buildRecipeEntry(row, components) {
  return {
    id: row.id,
    entry_date: row.entry_date,
    item_type: 'recipe',
    food_id: null,
    recipe_id: row.recipe_id,
    name: row.recipe_name,
    meal_slot: row.meal_slot,
    components,
    macros: sumMacros(components.map((c) => c.macros)),
  };
}

async function buildEntries(rows) {
  const recipeRows = rows.filter((r) => r.item_type === 'recipe');
  const componentsByEntry = await fetchComponentsForEntries(recipeRows.map((r) => r.id));
  return rows.map((row) =>
    row.item_type === 'food' ? buildFoodEntry(row) : buildRecipeEntry(row, componentsByEntry.get(row.id) || [])
  );
}

router.get('/', async (req, res) => {
  const date = req.query.date;
  if (!date) return res.status(400).json({ error: 'date query param (YYYY-MM-DD) is required' });

  const rows = await fetchEntryRows(req.user.id, date);
  const entries = await buildEntries(rows);
  const totals = sumMacros(entries.map((e) => e.macros));

  res.json({
    date,
    entries,
    totals,
    goals: {
      carbs_g: req.user.daily_carbs_goal_g,
      fat_g: req.user.daily_fat_goal_g,
      protein_g: req.user.daily_protein_goal_g,
    },
  });
});

router.post('/', async (req, res) => {
  const { entry_date, item_type, food_id, recipe_id, meal_slot } = req.body || {};
  if (!entry_date || !item_type) {
    return res.status(400).json({ error: 'entry_date and item_type are required' });
  }
  if (item_type !== 'food' && item_type !== 'recipe') {
    return res.status(400).json({ error: "item_type must be 'food' or 'recipe'" });
  }
  if (item_type === 'food' && !food_id) return res.status(400).json({ error: 'food_id is required' });
  if (item_type === 'recipe' && !recipe_id) return res.status(400).json({ error: 'recipe_id is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (item_type === 'food') {
      const { rows: foodRows } = await client.query(
        'SELECT id FROM foods WHERE id = $1 AND household_id = $2',
        [food_id, req.user.household_id]
      );
      if (foodRows.length === 0) throw Object.assign(new Error('Food not found'), { status: 400 });
    }

    const { rows } = await client.query(
      `INSERT INTO diary_entries (user_id, entry_date, item_type, food_id, recipe_id, meal_slot)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        req.user.id,
        entry_date,
        item_type,
        item_type === 'food' ? food_id : null,
        item_type === 'recipe' ? recipe_id : null,
        meal_slot || 'other',
      ]
    );
    const entryId = rows[0].id;

    if (item_type === 'recipe') {
      const { rows: components } = await client.query(
        `SELECT rc.food_id, rc.quantity_g
         FROM recipe_components rc
         JOIN recipes r ON r.id = rc.recipe_id
         WHERE rc.recipe_id = $1 AND r.household_id = $2`,
        [recipe_id, req.user.household_id]
      );
      if (components.length === 0) {
        throw Object.assign(new Error('Recipe not found or has no components'), { status: 400 });
      }
      for (const c of components) {
        await client.query(
          `INSERT INTO diary_entry_components (diary_entry_id, food_id, base_quantity_g, fraction)
           VALUES ($1, $2, $3, 1)`,
          [entryId, c.food_id, c.quantity_g]
        );
      }
    }

    await client.query('COMMIT');

    const entryRows = await pool.query(
      `SELECT de.*, f.name AS food_name, f.base_quantity_g AS food_base_quantity_g,
              f.carbs_g AS food_carbs_g, f.fat_g AS food_fat_g, f.protein_g AS food_protein_g,
              r.name AS recipe_name
       FROM diary_entries de
       LEFT JOIN foods f ON f.id = de.food_id
       LEFT JOIN recipes r ON r.id = de.recipe_id
       WHERE de.id = $1`,
      [entryId]
    );
    const [entry] = await buildEntries(entryRows.rows);
    res.status(201).json({ entry });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(err.status || 500).json({ error: err.message || 'Failed to add entry' });
  } finally {
    client.release();
  }
});

// Adjust a plain food entry's overall fraction (e.g. "I'll only eat half of this serving").
router.put('/:id', async (req, res) => {
  const { fraction } = req.body || {};
  if (fraction == null || fraction < 0) return res.status(400).json({ error: 'A non-negative fraction is required' });

  const { rows } = await pool.query(
    `UPDATE diary_entries SET fraction = $1
     WHERE id = $2 AND user_id = $3 AND item_type = 'food'
     RETURNING id`,
    [fraction, req.params.id, req.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Entry not found' });

  const entryRows = await pool.query(
    `SELECT de.*, f.name AS food_name, f.base_quantity_g AS food_base_quantity_g,
            f.carbs_g AS food_carbs_g, f.fat_g AS food_fat_g, f.protein_g AS food_protein_g,
            r.name AS recipe_name
     FROM diary_entries de
     LEFT JOIN foods f ON f.id = de.food_id
     LEFT JOIN recipes r ON r.id = de.recipe_id
     WHERE de.id = $1`,
    [req.params.id]
  );
  const [entry] = await buildEntries(entryRows.rows);
  res.json({ entry });
});

// Adjust a single ingredient's fraction within a planned recipe (e.g. "just the bottom bun, 0.5x").
router.put('/:id/components/:foodId', async (req, res) => {
  const { fraction } = req.body || {};
  if (fraction == null || fraction < 0) return res.status(400).json({ error: 'A non-negative fraction is required' });

  const { rows } = await pool.query(
    `UPDATE diary_entry_components dec SET fraction = $1
     FROM diary_entries de
     WHERE dec.diary_entry_id = de.id
       AND dec.diary_entry_id = $2 AND dec.food_id = $3 AND de.user_id = $4
     RETURNING dec.id`,
    [fraction, req.params.id, req.params.foodId, req.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Component not found' });

  const entryRows = await pool.query(
    `SELECT de.*, f.name AS food_name, f.base_quantity_g AS food_base_quantity_g,
            f.carbs_g AS food_carbs_g, f.fat_g AS food_fat_g, f.protein_g AS food_protein_g,
            r.name AS recipe_name
     FROM diary_entries de
     LEFT JOIN foods f ON f.id = de.food_id
     LEFT JOIN recipes r ON r.id = de.recipe_id
     WHERE de.id = $1`,
    [req.params.id]
  );
  const [entry] = await buildEntries(entryRows.rows);
  res.json({ entry });
});

router.delete('/:id', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM diary_entries WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.user.id,
  ]);
  if (rowCount === 0) return res.status(404).json({ error: 'Entry not found' });
  res.status(204).end();
});

module.exports = router;

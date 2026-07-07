const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireHousehold } = require('../middleware/auth');
const { scaleFood, sumMacros } = require('../utils/macros');

const router = express.Router();
router.use(requireAuth, requireHousehold);

// Recipe macros are computed per gram of the finished recipe (total component
// weight), so logging "150g of granola eaten" scales correctly.
async function computeRecipeMacrosPerGram(householdId, recipeId) {
  const { rows } = await pool.query(
    `SELECT f.base_quantity_g, f.carbs_g, f.fat_g, f.protein_g, rc.quantity_g
     FROM recipe_components rc
     JOIN foods f ON f.id = rc.food_id
     JOIN recipes r ON r.id = rc.recipe_id
     WHERE rc.recipe_id = $1 AND r.household_id = $2`,
    [recipeId, householdId]
  );
  if (rows.length === 0) return null;

  const componentMacros = rows.map((row) => scaleFood(row, Number(row.quantity_g)));
  const totals = sumMacros(componentMacros);
  const totalWeightG = rows.reduce((sum, row) => sum + Number(row.quantity_g), 0);
  if (totalWeightG === 0) return null;

  return {
    carbs_g: totals.carbs_g / totalWeightG,
    fat_g: totals.fat_g / totalWeightG,
    protein_g: totals.protein_g / totalWeightG,
    calories: totals.calories / totalWeightG,
  };
}

async function macrosForEntry(householdId, entry) {
  if (entry.item_type === 'food') {
    const { rows } = await pool.query('SELECT * FROM foods WHERE id = $1 AND household_id = $2', [
      entry.food_id,
      householdId,
    ]);
    if (rows.length === 0) return null;
    return scaleFood(rows[0], Number(entry.quantity_g));
  }
  const perGram = await computeRecipeMacrosPerGram(householdId, entry.recipe_id);
  if (!perGram) return null;
  const q = Number(entry.quantity_g);
  return {
    carbs_g: perGram.carbs_g * q,
    fat_g: perGram.fat_g * q,
    protein_g: perGram.protein_g * q,
    calories: perGram.calories * q,
  };
}

router.get('/', async (req, res) => {
  const date = req.query.date;
  if (!date) return res.status(400).json({ error: 'date query param (YYYY-MM-DD) is required' });

  const { rows } = await pool.query(
    `SELECT de.*, f.name AS food_name, r.name AS recipe_name
     FROM diary_entries de
     LEFT JOIN foods f ON f.id = de.food_id
     LEFT JOIN recipes r ON r.id = de.recipe_id
     WHERE de.user_id = $1 AND de.entry_date = $2
     ORDER BY de.created_at ASC`,
    [req.user.id, date]
  );

  const entries = [];
  for (const row of rows) {
    const macros = await macrosForEntry(req.user.household_id, row);
    entries.push({
      id: row.id,
      entry_date: row.entry_date,
      item_type: row.item_type,
      food_id: row.food_id,
      recipe_id: row.recipe_id,
      name: row.item_type === 'food' ? row.food_name : row.recipe_name,
      quantity_g: Number(row.quantity_g),
      meal_slot: row.meal_slot,
      macros: macros || { carbs_g: 0, fat_g: 0, protein_g: 0, calories: 0 },
    });
  }

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
  const { entry_date, item_type, food_id, recipe_id, quantity_g, meal_slot } = req.body || {};
  if (!entry_date || !item_type || !quantity_g || quantity_g <= 0) {
    return res.status(400).json({ error: 'entry_date, item_type and a positive quantity_g are required' });
  }
  if (item_type !== 'food' && item_type !== 'recipe') {
    return res.status(400).json({ error: "item_type must be 'food' or 'recipe'" });
  }
  if (item_type === 'food' && !food_id) return res.status(400).json({ error: 'food_id is required' });
  if (item_type === 'recipe' && !recipe_id) return res.status(400).json({ error: 'recipe_id is required' });

  const { rows } = await pool.query(
    `INSERT INTO diary_entries (user_id, entry_date, item_type, food_id, recipe_id, quantity_g, meal_slot)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      req.user.id,
      entry_date,
      item_type,
      item_type === 'food' ? food_id : null,
      item_type === 'recipe' ? recipe_id : null,
      quantity_g,
      meal_slot || 'other',
    ]
  );
  res.status(201).json({ entry: rows[0] });
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

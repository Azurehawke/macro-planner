const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireHousehold } = require('../middleware/auth');
const { caloriesFor } = require('../utils/macros');

const router = express.Router();
router.use(requireAuth, requireHousehold);

function withCalories(food) {
  return {
    ...food,
    calories: caloriesFor(Number(food.carbs_g), Number(food.fat_g), Number(food.protein_g)),
  };
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM foods WHERE household_id = $1 ORDER BY name ASC',
    [req.user.household_id]
  );
  res.json({ foods: rows.map(withCalories) });
});

router.post('/', async (req, res) => {
  const { name, base_quantity_g, carbs_g, fat_g, protein_g } = req.body || {};
  if (!name || carbs_g == null || fat_g == null || protein_g == null) {
    return res.status(400).json({ error: 'name, carbs_g, fat_g and protein_g are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO foods (household_id, name, base_quantity_g, carbs_g, fat_g, protein_g, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.user.household_id,
        name.trim(),
        base_quantity_g || 100,
        carbs_g,
        fat_g,
        protein_g,
        req.user.id,
      ]
    );
    res.status(201).json({ food: withCalories(rows[0]) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A food with that name already exists' });
    }
    throw err;
  }
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM foods WHERE id = $1 AND household_id = $2', [
    req.params.id,
    req.user.household_id,
  ]);
  if (rows.length === 0) return res.status(404).json({ error: 'Food not found' });
  res.json({ food: withCalories(rows[0]) });
});

router.put('/:id', async (req, res) => {
  const { name, base_quantity_g, carbs_g, fat_g, protein_g } = req.body || {};
  if (!name || carbs_g == null || fat_g == null || protein_g == null) {
    return res.status(400).json({ error: 'name, carbs_g, fat_g and protein_g are required' });
  }
  const { rows } = await pool.query(
    `UPDATE foods SET name = $1, base_quantity_g = $2, carbs_g = $3, fat_g = $4, protein_g = $5
     WHERE id = $6 AND household_id = $7
     RETURNING *`,
    [name.trim(), base_quantity_g || 100, carbs_g, fat_g, protein_g, req.params.id, req.user.household_id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Food not found' });
  res.json({ food: withCalories(rows[0]) });
});

router.delete('/:id', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM foods WHERE id = $1 AND household_id = $2', [
    req.params.id,
    req.user.household_id,
  ]);
  if (rowCount === 0) return res.status(404).json({ error: 'Food not found' });
  res.status(204).end();
});

// Live reverse lookup: every recipe currently using this food as a component.
// Nothing is cached, so a recipe that adds this ingredient shows up here immediately.
router.get('/:id/used-in', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.name, rc.quantity_g
     FROM recipe_components rc
     JOIN recipes r ON r.id = rc.recipe_id
     WHERE rc.food_id = $1 AND r.household_id = $2
     ORDER BY r.name ASC`,
    [req.params.id, req.user.household_id]
  );
  res.json({ usedIn: rows });
});

module.exports = router;

const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireHousehold } = require('../middleware/auth');
const { caloriesFor } = require('../utils/macros');

const router = express.Router();
router.use(requireAuth, requireHousehold);

function withCalories(food, useNetCarbs) {
  const carbs_g = Number(food.carbs_g);
  const fiber_g = food.fiber_g != null ? Number(food.fiber_g) : null;
  const net_carbs_g = fiber_g != null ? Math.max(0, carbs_g - fiber_g) : carbs_g;
  const calorieCarbs = useNetCarbs && fiber_g != null ? net_carbs_g : carbs_g;
  return {
    ...food,
    net_carbs_g,
    calories: caloriesFor(calorieCarbs, Number(food.fat_g), Number(food.protein_g)),
  };
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM foods WHERE household_id = $1 ORDER BY name ASC',
    [req.user.household_id]
  );
  res.json({ foods: rows.map((f) => withCalories(f, req.user.track_net_carbs)) });
});

router.post('/', async (req, res) => {
  const { name, serving_size_g, serving_size_qty, serving_size_unit, carbs_g, fat_g, protein_g, fiber_g } =
    req.body || {};
  if (!name || carbs_g == null || fat_g == null || protein_g == null) {
    return res.status(400).json({ error: 'name, carbs_g, fat_g and protein_g are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO foods (household_id, name, serving_size_g, serving_size_qty, serving_size_unit, carbs_g, fat_g, protein_g, fiber_g, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        req.user.household_id,
        name.trim(),
        serving_size_g || 100,
        serving_size_qty || serving_size_g || 100,
        (serving_size_unit || 'g').trim(),
        carbs_g,
        fat_g,
        protein_g,
        fiber_g === '' || fiber_g == null ? null : fiber_g,
        req.user.id,
      ]
    );
    res.status(201).json({ food: withCalories(rows[0], req.user.track_net_carbs) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A food with that name already exists' });
    }
    throw err;
  }
});

// Bulk import from a client-parsed CSV. Upserts by (household_id, name) - a
// second import of an edited template updates existing foods rather than
// erroring on the duplicate-name constraint. Each row is inserted in its own
// query so one bad row doesn't block the rest of the batch. serving_size_qty
// and serving_size_unit are optional in the CSV - a plain gram amount in
// serving_size_g is all that's required, matching how most people's existing
// spreadsheets already look.
router.post('/import', async (req, res) => {
  const { foods } = req.body || {};
  if (!Array.isArray(foods) || foods.length === 0) {
    return res.status(400).json({ error: 'foods must be a non-empty array' });
  }

  let created = 0;
  let updated = 0;
  const errors = [];

  for (let i = 0; i < foods.length; i++) {
    const row = foods[i] || {};
    const name = (row.name || '').toString().trim();
    const serving_size_g = Number(row.serving_size_g) || 100;
    const serving_size_qty = Number(row.serving_size_qty) || serving_size_g;
    const serving_size_unit = (row.serving_size_unit || 'g').toString().trim();
    // Number('') is 0, not NaN, so a blank required cell must be rejected by
    // checking the raw string first - otherwise a missing macro silently
    // imports as a zero instead of surfacing as a row error.
    const carbsRaw = (row.carbs_g ?? '').toString().trim();
    const fatRaw = (row.fat_g ?? '').toString().trim();
    const proteinRaw = (row.protein_g ?? '').toString().trim();
    const carbs_g = Number(carbsRaw);
    const fat_g = Number(fatRaw);
    const protein_g = Number(proteinRaw);
    const fiberRaw = (row.fiber_g ?? '').toString().trim();
    const fiber_g = fiberRaw === '' ? null : Number(fiberRaw);

    if (
      !name ||
      carbsRaw === '' ||
      fatRaw === '' ||
      proteinRaw === '' ||
      !Number.isFinite(carbs_g) ||
      !Number.isFinite(fat_g) ||
      !Number.isFinite(protein_g) ||
      (fiberRaw !== '' && !Number.isFinite(fiber_g))
    ) {
      errors.push({
        row: i + 1,
        name: name || '(blank)',
        error: 'name, carbs_g, fat_g and protein_g are required numbers (fiber_g, if present, must be a number too)',
      });
      continue;
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO foods (household_id, name, serving_size_g, serving_size_qty, serving_size_unit, carbs_g, fat_g, protein_g, fiber_g, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (household_id, name)
         DO UPDATE SET serving_size_g = EXCLUDED.serving_size_g, serving_size_qty = EXCLUDED.serving_size_qty,
                       serving_size_unit = EXCLUDED.serving_size_unit, carbs_g = EXCLUDED.carbs_g,
                       fat_g = EXCLUDED.fat_g, protein_g = EXCLUDED.protein_g, fiber_g = EXCLUDED.fiber_g
         RETURNING (xmax = 0) AS inserted`,
        [
          req.user.household_id,
          name,
          serving_size_g,
          serving_size_qty,
          serving_size_unit,
          carbs_g,
          fat_g,
          protein_g,
          fiber_g,
          req.user.id,
        ]
      );
      if (rows[0].inserted) created++;
      else updated++;
    } catch (err) {
      errors.push({ row: i + 1, name, error: err.message });
    }
  }

  res.json({ created, updated, errors });
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM foods WHERE id = $1 AND household_id = $2', [
    req.params.id,
    req.user.household_id,
  ]);
  if (rows.length === 0) return res.status(404).json({ error: 'Food not found' });
  res.json({ food: withCalories(rows[0], req.user.track_net_carbs) });
});

router.put('/:id', async (req, res) => {
  const { name, serving_size_g, serving_size_qty, serving_size_unit, carbs_g, fat_g, protein_g, fiber_g } =
    req.body || {};
  if (!name || carbs_g == null || fat_g == null || protein_g == null) {
    return res.status(400).json({ error: 'name, carbs_g, fat_g and protein_g are required' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE foods SET name = $1, serving_size_g = $2, serving_size_qty = $3, serving_size_unit = $4,
                        carbs_g = $5, fat_g = $6, protein_g = $7, fiber_g = $8
       WHERE id = $9 AND household_id = $10
       RETURNING *`,
      [
        name.trim(),
        serving_size_g || 100,
        serving_size_qty || serving_size_g || 100,
        (serving_size_unit || 'g').trim(),
        carbs_g,
        fat_g,
        protein_g,
        fiber_g === '' || fiber_g == null ? null : fiber_g,
        req.params.id,
        req.user.household_id,
      ]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Food not found' });
    res.json({ food: withCalories(rows[0], req.user.track_net_carbs) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A food with that name already exists' });
    }
    throw err;
  }
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

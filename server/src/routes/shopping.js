const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireHousehold } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireHousehold);

async function loadListWithItems(householdId, listId) {
  const { rows: listRows } = await pool.query(
    'SELECT * FROM shopping_lists WHERE id = $1 AND household_id = $2',
    [listId, householdId]
  );
  if (listRows.length === 0) return null;

  const { rows: items } = await pool.query(
    `SELECT sli.*, f.name AS food_name, u.name AS added_by_name, r.name AS source_recipe_name
     FROM shopping_list_items sli
     JOIN foods f ON f.id = sli.food_id
     LEFT JOIN users u ON u.id = sli.added_by
     LEFT JOIN recipes r ON r.id = sli.source_recipe_id
     WHERE sli.shopping_list_id = $1
     ORDER BY f.name ASC`,
    [listId]
  );
  return { ...listRows[0], items };
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM shopping_lists WHERE household_id = $1 ORDER BY created_at ASC',
    [req.user.household_id]
  );
  res.json({ shoppingLists: rows });
});

router.post('/', async (req, res) => {
  const { name } = req.body || {};
  const { rows } = await pool.query(
    'INSERT INTO shopping_lists (household_id, name) VALUES ($1, $2) RETURNING *',
    [req.user.household_id, (name && name.trim()) || 'Shopping List']
  );
  res.status(201).json({ shoppingList: rows[0] });
});

router.get('/:id', async (req, res) => {
  const list = await loadListWithItems(req.user.household_id, req.params.id);
  if (!list) return res.status(404).json({ error: 'Shopping list not found' });
  res.json({ shoppingList: list });
});

router.delete('/:id', async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM shopping_lists WHERE id = $1 AND household_id = $2',
    [req.params.id, req.user.household_id]
  );
  if (rowCount === 0) return res.status(404).json({ error: 'Shopping list not found' });
  res.status(204).end();
});

// Add (or top up) a single food item on the list.
router.post('/:id/items', async (req, res) => {
  const { food_id, quantity_g } = req.body || {};
  if (!food_id || !quantity_g || quantity_g <= 0) {
    return res.status(400).json({ error: 'food_id and a positive quantity_g are required' });
  }

  const list = await pool.query('SELECT id FROM shopping_lists WHERE id = $1 AND household_id = $2', [
    req.params.id,
    req.user.household_id,
  ]);
  if (list.rows.length === 0) return res.status(404).json({ error: 'Shopping list not found' });

  const food = await pool.query('SELECT id FROM foods WHERE id = $1 AND household_id = $2', [
    food_id,
    req.user.household_id,
  ]);
  if (food.rows.length === 0) return res.status(400).json({ error: 'Food not found' });

  await pool.query(
    `INSERT INTO shopping_list_items (shopping_list_id, food_id, quantity_g, added_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (shopping_list_id, food_id)
     DO UPDATE SET quantity_g = shopping_list_items.quantity_g + excluded.quantity_g, checked = false`,
    [req.params.id, food_id, quantity_g, req.user.id]
  );

  const updated = await loadListWithItems(req.user.household_id, req.params.id);
  res.status(201).json({ shoppingList: updated });
});

// Expand a recipe's components (scaled by `multiplier`) onto the list, merging quantities.
router.post('/:id/items/from-recipe', async (req, res) => {
  const { recipe_id, multiplier } = req.body || {};
  const scale = multiplier && multiplier > 0 ? Number(multiplier) : 1;
  if (!recipe_id) return res.status(400).json({ error: 'recipe_id is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const list = await client.query(
      'SELECT id FROM shopping_lists WHERE id = $1 AND household_id = $2',
      [req.params.id, req.user.household_id]
    );
    if (list.rows.length === 0) {
      throw Object.assign(new Error('Shopping list not found'), { status: 404 });
    }

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
        `INSERT INTO shopping_list_items (shopping_list_id, food_id, quantity_g, added_by, source_recipe_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (shopping_list_id, food_id)
         DO UPDATE SET quantity_g = shopping_list_items.quantity_g + excluded.quantity_g, checked = false`,
        [req.params.id, c.food_id, Number(c.quantity_g) * scale, req.user.id, recipe_id]
      );
    }

    await client.query('COMMIT');
    const updated = await loadListWithItems(req.user.household_id, req.params.id);
    res.status(201).json({ shoppingList: updated });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(err.status || 500).json({ error: err.message || 'Failed to add recipe to list' });
  } finally {
    client.release();
  }
});

router.put('/:id/items/:itemId', async (req, res) => {
  const { checked, quantity_g } = req.body || {};
  const fields = [];
  const values = [];
  let i = 1;
  if (checked !== undefined) {
    fields.push(`checked = $${i++}`);
    values.push(checked);
  }
  if (quantity_g !== undefined) {
    if (quantity_g <= 0) return res.status(400).json({ error: 'quantity_g must be positive' });
    fields.push(`quantity_g = $${i++}`);
    values.push(quantity_g);
  }
  if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  values.push(req.params.itemId, req.params.id, req.user.household_id);
  const { rows } = await pool.query(
    `UPDATE shopping_list_items SET ${fields.join(', ')}
     WHERE id = $${i++} AND shopping_list_id = $${i++}
     AND shopping_list_id IN (SELECT id FROM shopping_lists WHERE household_id = $${i++})
     RETURNING *`,
    values
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Item not found' });
  res.json({ item: rows[0] });
});

router.delete('/:id/items/:itemId', async (req, res) => {
  const { rowCount } = await pool.query(
    `DELETE FROM shopping_list_items
     WHERE id = $1 AND shopping_list_id = $2
     AND shopping_list_id IN (SELECT id FROM shopping_lists WHERE household_id = $3)`,
    [req.params.itemId, req.params.id, req.user.household_id]
  );
  if (rowCount === 0) return res.status(404).json({ error: 'Item not found' });
  res.status(204).end();
});

module.exports = router;

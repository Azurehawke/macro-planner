const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireHousehold } = require('../middleware/auth');
const { scaleFood, sumMacros } = require('../utils/macros');

const router = express.Router();
router.use(requireAuth, requireHousehold);

async function fetchComponentsForRecipes(householdId, recipeIds, useNetCarbs) {
  if (recipeIds.length === 0) return new Map();
  const { rows } = await pool.query(
    `SELECT rc.recipe_id, rc.quantity_g, f.id AS food_id, f.name AS food_name,
            f.serving_size_g, f.carbs_g, f.fat_g, f.protein_g, f.fiber_g
     FROM recipe_components rc
     JOIN foods f ON f.id = rc.food_id
     JOIN recipes r ON r.id = rc.recipe_id
     WHERE r.household_id = $1 AND rc.recipe_id = ANY($2::int[])
     ORDER BY f.name ASC`,
    [householdId, recipeIds]
  );

  const byRecipe = new Map();
  for (const row of rows) {
    const macros = scaleFood(row, Number(row.quantity_g), useNetCarbs);
    const component = {
      food_id: row.food_id,
      food_name: row.food_name,
      quantity_g: Number(row.quantity_g),
      ...macros,
    };
    if (!byRecipe.has(row.recipe_id)) byRecipe.set(row.recipe_id, []);
    byRecipe.get(row.recipe_id).push(component);
  }
  return byRecipe;
}

router.get('/', async (req, res) => {
  const { rows: recipes } = await pool.query(
    'SELECT * FROM recipes WHERE household_id = $1 ORDER BY name ASC',
    [req.user.household_id]
  );
  const componentsByRecipe = await fetchComponentsForRecipes(
    req.user.household_id,
    recipes.map((r) => r.id),
    req.user.track_net_carbs
  );
  const result = recipes.map((recipe) => {
    const components = componentsByRecipe.get(recipe.id) || [];
    return { ...recipe, components, totals: sumMacros(components) };
  });
  res.json({ recipes: result });
});

router.post('/', async (req, res) => {
  const { name, components } = req.body || {};
  if (!name || !Array.isArray(components) || components.length === 0) {
    return res.status(400).json({ error: 'name and at least one component are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO recipes (household_id, name, created_by) VALUES ($1, $2, $3) RETURNING *',
      [req.user.household_id, name.trim(), req.user.id]
    );
    const recipe = rows[0];

    for (const c of components) {
      if (!c.food_id || !c.quantity_g || c.quantity_g <= 0) {
        throw Object.assign(new Error('Each component needs a food_id and a positive quantity_g'), {
          status: 400,
        });
      }
      const { rows: foodRows } = await client.query(
        'SELECT id FROM foods WHERE id = $1 AND household_id = $2',
        [c.food_id, req.user.household_id]
      );
      if (foodRows.length === 0) {
        throw Object.assign(new Error(`Food ${c.food_id} not found`), { status: 400 });
      }
      await client.query(
        'INSERT INTO recipe_components (recipe_id, food_id, quantity_g) VALUES ($1, $2, $3)',
        [recipe.id, c.food_id, c.quantity_g]
      );
    }

    await client.query('COMMIT');
    const componentsByRecipe = await fetchComponentsForRecipes(req.user.household_id, [recipe.id], req.user.track_net_carbs);
    const withComponents = componentsByRecipe.get(recipe.id) || [];
    res.status(201).json({ recipe: { ...recipe, components: withComponents, totals: sumMacros(withComponents) } });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A recipe with that name already exists' });
    }
    res.status(err.status || 500).json({ error: err.message || 'Failed to create recipe' });
  } finally {
    client.release();
  }
});

// Bulk import from a client-parsed CSV. The CSV is "long" format - one row
// per (recipe, food, quantity) - so the client groups rows by recipe name
// before posting here as { name, components: [{ food_name, quantity_g }] }.
// Each recipe is upserted by (household_id, name) in its own transaction, so
// one recipe with an unresolvable food name doesn't block the rest of the
// batch. food_name is matched case-insensitively against existing foods -
// foods must already exist (import foods first).
router.post('/import', async (req, res) => {
  const { recipes } = req.body || {};
  if (!Array.isArray(recipes) || recipes.length === 0) {
    return res.status(400).json({ error: 'recipes must be a non-empty array' });
  }

  let created = 0;
  let updated = 0;
  const errors = [];

  for (const recipe of recipes) {
    const name = (recipe.name || '').toString().trim();
    const componentRows = Array.isArray(recipe.components) ? recipe.components : [];
    if (!name || componentRows.length === 0) {
      errors.push({ name: name || '(blank)', error: 'A recipe needs a name and at least one component row' });
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const resolvedComponents = [];
      for (const c of componentRows) {
        const foodName = (c.food_name || '').toString().trim();
        const quantity_g = Number(c.quantity_g);
        if (!foodName || !Number.isFinite(quantity_g) || quantity_g <= 0) {
          throw Object.assign(
            new Error(`Invalid component "${foodName || '(blank)'}" - needs a food_name and a positive quantity_g`),
            { status: 400 }
          );
        }
        const { rows: foodRows } = await client.query(
          'SELECT id FROM foods WHERE household_id = $1 AND lower(name) = lower($2)',
          [req.user.household_id, foodName]
        );
        if (foodRows.length === 0) {
          throw Object.assign(new Error(`Food "${foodName}" not found - import it first`), { status: 400 });
        }
        resolvedComponents.push({ food_id: foodRows[0].id, quantity_g });
      }

      const { rows: existingRows } = await client.query(
        'SELECT id FROM recipes WHERE household_id = $1 AND name = $2',
        [req.user.household_id, name]
      );

      let recipeId;
      if (existingRows.length > 0) {
        recipeId = existingRows[0].id;
        await client.query('DELETE FROM recipe_components WHERE recipe_id = $1', [recipeId]);
        updated++;
      } else {
        const { rows: inserted } = await client.query(
          'INSERT INTO recipes (household_id, name, created_by) VALUES ($1, $2, $3) RETURNING id',
          [req.user.household_id, name, req.user.id]
        );
        recipeId = inserted[0].id;
        created++;
      }

      for (const c of resolvedComponents) {
        await client.query(
          'INSERT INTO recipe_components (recipe_id, food_id, quantity_g) VALUES ($1, $2, $3)',
          [recipeId, c.food_id, c.quantity_g]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      errors.push({ name, error: err.message });
    } finally {
      client.release();
    }
  }

  res.json({ created, updated, errors });
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM recipes WHERE id = $1 AND household_id = $2', [
    req.params.id,
    req.user.household_id,
  ]);
  if (rows.length === 0) return res.status(404).json({ error: 'Recipe not found' });
  const componentsByRecipe = await fetchComponentsForRecipes(req.user.household_id, [rows[0].id], req.user.track_net_carbs);
  const components = componentsByRecipe.get(rows[0].id) || [];
  res.json({ recipe: { ...rows[0], components, totals: sumMacros(components) } });
});

router.put('/:id', async (req, res) => {
  const { name, components } = req.body || {};
  if (!name || !Array.isArray(components) || components.length === 0) {
    return res.status(400).json({ error: 'name and at least one component are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'UPDATE recipes SET name = $1 WHERE id = $2 AND household_id = $3 RETURNING *',
      [name.trim(), req.params.id, req.user.household_id]
    );
    if (rows.length === 0) {
      throw Object.assign(new Error('Recipe not found'), { status: 404 });
    }
    const recipe = rows[0];

    await client.query('DELETE FROM recipe_components WHERE recipe_id = $1', [recipe.id]);
    for (const c of components) {
      if (!c.food_id || !c.quantity_g || c.quantity_g <= 0) {
        throw Object.assign(new Error('Each component needs a food_id and a positive quantity_g'), {
          status: 400,
        });
      }
      const { rows: foodRows } = await client.query(
        'SELECT id FROM foods WHERE id = $1 AND household_id = $2',
        [c.food_id, req.user.household_id]
      );
      if (foodRows.length === 0) {
        throw Object.assign(new Error(`Food ${c.food_id} not found`), { status: 400 });
      }
      await client.query(
        'INSERT INTO recipe_components (recipe_id, food_id, quantity_g) VALUES ($1, $2, $3)',
        [recipe.id, c.food_id, c.quantity_g]
      );
    }

    await client.query('COMMIT');
    const componentsByRecipe = await fetchComponentsForRecipes(req.user.household_id, [recipe.id], req.user.track_net_carbs);
    const withComponents = componentsByRecipe.get(recipe.id) || [];
    res.json({ recipe: { ...recipe, components: withComponents, totals: sumMacros(withComponents) } });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A recipe with that name already exists' });
    }
    res.status(err.status || 500).json({ error: err.message || 'Failed to update recipe' });
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM recipes WHERE id = $1 AND household_id = $2', [
    req.params.id,
    req.user.household_id,
  ]);
  if (rowCount === 0) return res.status(404).json({ error: 'Recipe not found' });
  res.status(204).end();
});

module.exports = router;

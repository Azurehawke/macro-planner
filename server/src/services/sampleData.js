// Seeded into every newly-created household so new visitors land on a
// populated Foods/Recipes page instead of an empty one - real enough to plan
// a day with, not meant to be nutritionally definitive.
// fiber_g is only set on a few foods where it's a meaningfully large share of
// the carbs (oats, veg, fruit) - enough to make the Net Carbs household
// setting show a visible difference right away without claiming precision
// this app was never meant to have for every ingredient.
const SAMPLE_FOODS = [
  { name: 'Chicken Breast (cooked)', carbs_g: 0, fat_g: 3.6, protein_g: 31 },
  { name: 'Brown Rice (cooked)', carbs_g: 23, fat_g: 0.9, protein_g: 2.6, fiber_g: 1.8 },
  { name: 'Broccoli', carbs_g: 7, fat_g: 0.4, protein_g: 2.8, fiber_g: 2.6 },
  { name: 'Rolled Oats (dry)', carbs_g: 66, fat_g: 7, protein_g: 17, fiber_g: 10.6 },
  { name: 'Banana', carbs_g: 23, fat_g: 0.3, protein_g: 1.1, fiber_g: 2.6 },
  { name: 'Greek Yogurt (plain)', carbs_g: 3.6, fat_g: 2, protein_g: 10 },
  { name: 'Almonds', carbs_g: 22, fat_g: 50, protein_g: 21, fiber_g: 12.5 },
  { name: 'Whole Wheat Bread', carbs_g: 41, fat_g: 3.2, protein_g: 13, fiber_g: 6.8 },
  { name: 'Peanut Butter', carbs_g: 20, fat_g: 50, protein_g: 25, fiber_g: 6 },
  { name: 'Salmon (cooked)', carbs_g: 0, fat_g: 13, protein_g: 25 },
  { name: 'Sweet Potato', carbs_g: 20, fat_g: 0.1, protein_g: 1.6, fiber_g: 3 },
  { name: 'Olive Oil', carbs_g: 0, fat_g: 100, protein_g: 0 },
  { name: 'Spinach', carbs_g: 3.6, fat_g: 0.4, protein_g: 2.9, fiber_g: 2.2 },
];

// Quantities are grams of each food per recipe - matches how recipe_components
// already works, so these show up with real computed macros immediately.
const SAMPLE_RECIPES = [
  {
    name: 'Chicken & Rice Bowl',
    components: [
      { food: 'Chicken Breast (cooked)', quantity_g: 150 },
      { food: 'Brown Rice (cooked)', quantity_g: 150 },
      { food: 'Broccoli', quantity_g: 100 },
      { food: 'Olive Oil', quantity_g: 10 },
    ],
  },
  {
    name: 'Peanut Butter Banana Toast',
    components: [
      { food: 'Whole Wheat Bread', quantity_g: 60 },
      { food: 'Peanut Butter', quantity_g: 32 },
      { food: 'Banana', quantity_g: 100 },
    ],
  },
  {
    name: 'Greek Yogurt Parfait',
    components: [
      { food: 'Greek Yogurt (plain)', quantity_g: 200 },
      { food: 'Rolled Oats (dry)', quantity_g: 40 },
      { food: 'Almonds', quantity_g: 15 },
    ],
  },
  {
    name: 'Salmon & Sweet Potato',
    components: [
      { food: 'Salmon (cooked)', quantity_g: 150 },
      { food: 'Sweet Potato', quantity_g: 200 },
      { food: 'Spinach', quantity_g: 80 },
      { food: 'Olive Oil', quantity_g: 10 },
    ],
  },
];

async function seedSampleData(client, householdId, userId) {
  const foodIdByName = new Map();
  for (const food of SAMPLE_FOODS) {
    const { rows } = await client.query(
      `INSERT INTO foods (household_id, name, carbs_g, fat_g, protein_g, fiber_g, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [householdId, food.name, food.carbs_g, food.fat_g, food.protein_g, food.fiber_g ?? null, userId]
    );
    foodIdByName.set(food.name, rows[0].id);
  }

  for (const recipe of SAMPLE_RECIPES) {
    const { rows } = await client.query(
      `INSERT INTO recipes (household_id, name, created_by) VALUES ($1, $2, $3) RETURNING id`,
      [householdId, recipe.name, userId]
    );
    const recipeId = rows[0].id;
    for (const c of recipe.components) {
      await client.query(`INSERT INTO recipe_components (recipe_id, food_id, quantity_g) VALUES ($1, $2, $3)`, [
        recipeId,
        foodIdByName.get(c.food),
        c.quantity_g,
      ]);
    }
  }
}

module.exports = { seedSampleData };

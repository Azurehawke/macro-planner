const { caloriesFor } = require('../utils/macros');

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';
const OFF_BASE = 'https://world.openfoodfacts.org';

// USDA nutrient numbers are stable, standardized IDs (not names), so they
// survive renames/localization in the "nutrientName" field.
const USDA_NUTRIENT_NUMBERS = { carbs: '205', fat: '204', protein: '203', calories: '208' };

function round2(n) {
  return Math.round(n * 100) / 100;
}

// The search endpoint and the food-detail endpoint shape nutrient rows
// differently ({nutrientNumber, value} vs {nutrient: {number}, amount}) -
// check both so this doesn't silently break if USDA changes which shape a
// given query returns.
function usdaNutrientValue(foodNutrients, number) {
  if (!Array.isArray(foodNutrients)) return null;
  const match = foodNutrients.find(
    (n) => n.nutrientNumber === number || n.number === number || n.nutrient?.number === number
  );
  if (!match) return null;
  const value = match.value ?? match.amount;
  return value == null ? null : Number(value);
}

function normalizeUsdaFood(food) {
  const nutrients = food.foodNutrients || [];
  const carbs_g = usdaNutrientValue(nutrients, USDA_NUTRIENT_NUMBERS.carbs);
  const fat_g = usdaNutrientValue(nutrients, USDA_NUTRIENT_NUMBERS.fat);
  const protein_g = usdaNutrientValue(nutrients, USDA_NUTRIENT_NUMBERS.protein);
  if (carbs_g == null || fat_g == null || protein_g == null || !food.description) return null;

  const reportedCalories = usdaNutrientValue(nutrients, USDA_NUTRIENT_NUMBERS.calories);
  return {
    source: 'usda',
    externalId: String(food.fdcId),
    name: food.description,
    brand: food.brandName || food.brandOwner || null,
    base_quantity_g: 100,
    carbs_g: round2(carbs_g),
    fat_g: round2(fat_g),
    protein_g: round2(protein_g),
    calories: round2(reportedCalories != null ? reportedCalories : caloriesFor(carbs_g, fat_g, protein_g)),
  };
}

async function searchUsda(query) {
  const apiKey = process.env.USDA_FDC_API_KEY;
  if (!apiKey) return { results: [], disabled: true };

  const url = `${USDA_BASE}/foods/search?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(
    query
  )}&pageSize=10`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`USDA FoodData Central returned ${res.status}`);

  const data = await res.json();
  const results = (data.foods || []).map(normalizeUsdaFood).filter(Boolean);
  return { results, disabled: false };
}

function normalizeOffProduct(product) {
  const n = product.nutriments || {};
  const carbs_g = n.carbohydrates_100g;
  const fat_g = n.fat_100g;
  const protein_g = n.proteins_100g;
  const name = product.product_name || product.generic_name;
  if (carbs_g == null || fat_g == null || protein_g == null || !name) return null;

  const reportedCalories = n['energy-kcal_100g'];
  return {
    source: 'openfoodfacts',
    externalId: product.code || product._id || name,
    name,
    brand: product.brands || null,
    base_quantity_g: 100,
    carbs_g: round2(carbs_g),
    fat_g: round2(fat_g),
    protein_g: round2(protein_g),
    calories: round2(reportedCalories != null ? reportedCalories : caloriesFor(carbs_g, fat_g, protein_g)),
  };
}

async function searchOpenFoodFacts(query) {
  const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(
    query
  )}&search_simple=1&action=process&json=1&page_size=10`;
  // Open Food Facts' usage policy asks for a descriptive User-Agent identifying the app.
  const userAgent = process.env.OFF_USER_AGENT || 'MacroPlanner (self-hosted macro planning app)';
  const res = await fetch(url, { headers: { 'User-Agent': userAgent } });
  if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}`);

  const data = await res.json();
  const results = (data.products || []).map(normalizeOffProduct).filter(Boolean);
  return { results, disabled: false };
}

module.exports = { searchUsda, searchOpenFoodFacts };

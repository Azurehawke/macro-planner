// Calories via the standard Atwater factors (kcal per gram).
const KCAL_PER_G_CARBS = 4;
const KCAL_PER_G_FAT = 9;
const KCAL_PER_G_PROTEIN = 4;

function caloriesFor(carbsG, fatG, proteinG) {
  return carbsG * KCAL_PER_G_CARBS + fatG * KCAL_PER_G_FAT + proteinG * KCAL_PER_G_PROTEIN;
}

// Scales a food's per-serving macros to an arbitrary gram quantity. When
// useNetCarbs is on and the food has a fiber_g value, calories are computed
// from net carbs (carbs minus fiber) instead of total carbs - carbs_g itself
// is always the true total, net_carbs_g is reported alongside it so the UI
// can show either.
function scaleFood(food, quantityG, useNetCarbs) {
  const factor = quantityG / Number(food.serving_size_g);
  const carbs_g = Number(food.carbs_g) * factor;
  const fat_g = Number(food.fat_g) * factor;
  const protein_g = Number(food.protein_g) * factor;
  const fiber_g = food.fiber_g != null ? Number(food.fiber_g) * factor : null;
  const net_carbs_g = fiber_g != null ? Math.max(0, carbs_g - fiber_g) : carbs_g;
  const calorieCarbs = useNetCarbs && fiber_g != null ? net_carbs_g : carbs_g;
  return {
    carbs_g,
    fat_g,
    protein_g,
    fiber_g,
    net_carbs_g,
    calories: caloriesFor(calorieCarbs, fat_g, protein_g),
  };
}

function sumMacros(list) {
  return list.reduce(
    (acc, m) => ({
      carbs_g: acc.carbs_g + m.carbs_g,
      fat_g: acc.fat_g + m.fat_g,
      protein_g: acc.protein_g + m.protein_g,
      fiber_g: acc.fiber_g + (m.fiber_g || 0),
      net_carbs_g: acc.net_carbs_g + (m.net_carbs_g ?? m.carbs_g),
      calories: acc.calories + m.calories,
    }),
    { carbs_g: 0, fat_g: 0, protein_g: 0, fiber_g: 0, net_carbs_g: 0, calories: 0 }
  );
}

module.exports = { caloriesFor, scaleFood, sumMacros };

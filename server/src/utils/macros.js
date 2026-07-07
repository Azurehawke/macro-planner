// Calories via the standard Atwater factors (kcal per gram).
const KCAL_PER_G_CARBS = 4;
const KCAL_PER_G_FAT = 9;
const KCAL_PER_G_PROTEIN = 4;

function caloriesFor(carbsG, fatG, proteinG) {
  return carbsG * KCAL_PER_G_CARBS + fatG * KCAL_PER_G_FAT + proteinG * KCAL_PER_G_PROTEIN;
}

// Scales a food's per-base-quantity macros to an arbitrary gram quantity.
function scaleFood(food, quantityG) {
  const factor = quantityG / Number(food.base_quantity_g);
  const carbs_g = Number(food.carbs_g) * factor;
  const fat_g = Number(food.fat_g) * factor;
  const protein_g = Number(food.protein_g) * factor;
  return {
    carbs_g,
    fat_g,
    protein_g,
    calories: caloriesFor(carbs_g, fat_g, protein_g),
  };
}

function sumMacros(list) {
  return list.reduce(
    (acc, m) => ({
      carbs_g: acc.carbs_g + m.carbs_g,
      fat_g: acc.fat_g + m.fat_g,
      protein_g: acc.protein_g + m.protein_g,
      calories: acc.calories + m.calories,
    }),
    { carbs_g: 0, fat_g: 0, protein_g: 0, calories: 0 }
  );
}

module.exports = { caloriesFor, scaleFood, sumMacros };

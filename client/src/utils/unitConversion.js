// Weight conversions are exact - grams are the canonical unit throughout the
// app (foods/recipes/shopping list all store quantity_g), so every other
// weight unit just needs its factor to grams.
export const WEIGHT_UNITS = [
  { value: 'g', label: 'grams (g)', toGrams: 1 },
  { value: 'kg', label: 'kilograms (kg)', toGrams: 1000 },
  { value: 'oz', label: 'ounces (oz)', toGrams: 28.3495 },
  { value: 'lb', label: 'pounds (lb)', toGrams: 453.592 },
];

// Volume conversions are also exact - a cup of anything is the same number
// of milliliters regardless of what's in it.
export const VOLUME_UNITS = [
  { value: 'mL', label: 'milliliters (mL)', toMl: 1 },
  { value: 'L', label: 'liters (L)', toMl: 1000 },
  { value: 'tsp', label: 'teaspoons (tsp)', toMl: 4.92892 },
  { value: 'tbsp', label: 'tablespoons (tbsp)', toMl: 14.7868 },
  { value: 'cup', label: 'cups', toMl: 236.588 },
  { value: 'flOz', label: 'fluid ounces (fl oz)', toMl: 29.5735 },
];

// Grams per US cup - going from volume to weight needs the ingredient's
// density, which these approximate (source: King Arthur Baking's ingredient
// weight chart and similar widely-published references). Always prefer a
// number from the actual product's label when you have one - brand,
// moisture content and how firmly something is packed all shift these.
export const INGREDIENT_DENSITIES = [
  { name: 'Water', gramsPerCup: 236 },
  { name: 'Milk', gramsPerCup: 245 },
  { name: 'All-purpose flour (spooned)', gramsPerCup: 120 },
  { name: 'Whole wheat flour', gramsPerCup: 113 },
  { name: 'Granulated sugar', gramsPerCup: 200 },
  { name: 'Brown sugar (packed)', gramsPerCup: 213 },
  { name: 'Powdered sugar', gramsPerCup: 113 },
  { name: 'Butter', gramsPerCup: 227 },
  { name: 'Vegetable oil', gramsPerCup: 218 },
  { name: 'Honey', gramsPerCup: 340 },
  { name: 'Peanut butter', gramsPerCup: 258 },
  { name: 'Rolled oats', gramsPerCup: 90 },
  { name: 'White rice (uncooked)', gramsPerCup: 185 },
  { name: 'Shredded cheese', gramsPerCup: 113 },
  { name: 'Chopped nuts', gramsPerCup: 120 },
  { name: 'Cocoa powder', gramsPerCup: 84 },
];

export function convertWeight(value, fromUnit, toUnit) {
  const from = WEIGHT_UNITS.find((u) => u.value === fromUnit);
  const to = WEIGHT_UNITS.find((u) => u.value === toUnit);
  if (!from || !to || !Number.isFinite(value)) return null;
  return (value * from.toGrams) / to.toGrams;
}

export function convertVolume(value, fromUnit, toUnit) {
  const from = VOLUME_UNITS.find((u) => u.value === fromUnit);
  const to = VOLUME_UNITS.find((u) => u.value === toUnit);
  if (!from || !to || !Number.isFinite(value)) return null;
  return (value * from.toMl) / to.toMl;
}

// gramsPerCup is the ingredient's density (from INGREDIENT_DENSITIES or a
// custom value the user supplies from a product label).
export function volumeToGrams(value, volumeUnit, gramsPerCup) {
  const unit = VOLUME_UNITS.find((u) => u.value === volumeUnit);
  if (!unit || !Number.isFinite(value) || !Number.isFinite(gramsPerCup)) return null;
  const cups = (value * unit.toMl) / 236.588;
  return cups * gramsPerCup;
}

// Mifflin-St Jeor BMR + standard activity multipliers + goal-based calorie
// adjustment and macro split, modeled on MyFitnessPal's published macro
// calculator methodology (blog.myfitnesspal.com/macro-calculator/).

export const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary (little or no exercise)', multiplier: 1.2 },
  { value: 'light', label: 'Lightly active (light exercise 1-3 days/week)', multiplier: 1.375 },
  { value: 'moderate', label: 'Moderately active (moderate exercise 3-5 days/week)', multiplier: 1.55 },
  { value: 'very', label: 'Very active (hard exercise 6-7 days/week)', multiplier: 1.725 },
  { value: 'extra', label: 'Extra active (very hard exercise, physical job)', multiplier: 1.9 },
];

// calorieAdjustment: a ~500 kcal deficit/surplus is the standard "about 1
// lb/week" pace; splits are round-number picks within MyFitnessPal's
// published ranges for each goal (carbs/protein/fat, must sum to 1).
export const GOALS = [
  {
    value: 'lose',
    label: 'Lose weight',
    calorieAdjustment: -500,
    splits: { carbs: 0.4, protein: 0.3, fat: 0.3 },
  },
  {
    value: 'maintain',
    label: 'Maintain weight',
    calorieAdjustment: 0,
    splits: { carbs: 0.5, protein: 0.2, fat: 0.3 },
  },
  {
    value: 'gain',
    label: 'Gain weight / build muscle',
    calorieAdjustment: 350,
    splits: { carbs: 0.45, protein: 0.3, fat: 0.25 },
  },
];

// Below this, even an aggressive deficit shouldn't push the target -
// matches common calculators' safety floor.
const MIN_CALORIES = 1200;

const LB_TO_KG = 0.45359237;
const IN_TO_CM = 2.54;

export function calculateMacros({ sex, ageYears, weightLb, heightIn, activity, goal }) {
  const weightKg = weightLb * LB_TO_KG;
  const heightCm = heightIn * IN_TO_CM;

  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + (sex === 'male' ? 5 : -161);

  const activityInfo = ACTIVITY_LEVELS.find((a) => a.value === activity);
  const tdee = bmr * activityInfo.multiplier;

  const goalInfo = GOALS.find((g) => g.value === goal);
  const rawTarget = tdee + goalInfo.calorieAdjustment;
  const targetCalories = Math.round(Math.max(MIN_CALORIES, rawTarget));
  const cappedAtFloor = rawTarget < MIN_CALORIES;

  const carbs_g = Math.round((targetCalories * goalInfo.splits.carbs) / 4);
  const protein_g = Math.round((targetCalories * goalInfo.splits.protein) / 4);
  const fat_g = Math.round((targetCalories * goalInfo.splits.fat) / 9);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories,
    cappedAtFloor,
    carbs_g,
    fat_g,
    protein_g,
  };
}

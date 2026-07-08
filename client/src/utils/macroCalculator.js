// Mifflin-St Jeor BMR + standard activity multipliers + goal-based calorie
// adjustment and macro split, modeled on MyFitnessPal's published macro
// calculator methodology (blog.myfitnesspal.com/macro-calculator/).

// The classic 5-tier scale (1.2/1.375/1.55/1.725/1.9) is the most commonly
// cited version, but several established TDEE calculators (e.g. NASM/ACE
// guidance referenced by tdeehelper.com and similar) interpolate two extra
// steps between "light" and "very active" for finer control, since real
// activity habits rarely land cleanly on one of only 5 buckets.
export const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary — little or no exercise, desk job', multiplier: 1.2 },
  { value: 'light1', label: 'Lightly active — light exercise 1-2 days/week', multiplier: 1.3 },
  { value: 'light2', label: 'Lightly active — light exercise/sports 3 days/week', multiplier: 1.375 },
  { value: 'moderate1', label: 'Moderately active — moderate exercise 4 days/week', multiplier: 1.465 },
  { value: 'moderate2', label: 'Moderately active — moderate exercise/sports 5 days/week', multiplier: 1.55 },
  { value: 'very', label: 'Very active — hard exercise/sports 6-7 days/week', multiplier: 1.725 },
  { value: 'extra', label: 'Extra active — very hard exercise, physical job, or 2x/day training', multiplier: 1.9 },
];

// A pound of body fat is ~3,500 kcal, so a target weekly loss rate converts
// to a daily deficit as rate * 3500 / 7 (== rate * 500). This is how
// MyFitnessPal's calculator derives its deficit from the rate you pick,
// rather than using one fixed number regardless of how fast you want to lose.
export const WEEKLY_LOSS_RATES = [0.5, 1, 1.5, 2];
const KCAL_PER_LB = 3500;

// splits are round-number picks within MyFitnessPal's published ranges for
// each goal (carbs/protein/fat, must sum to 1). "lose" has no fixed
// calorieAdjustment - its deficit comes from the chosen weekly loss rate.
export const GOALS = [
  {
    value: 'lose',
    label: 'Lose weight',
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

// If knownBmr is supplied (e.g. from a DEXA scan or metabolic cart test),
// it's used as-is instead of the Mifflin-St Jeor estimate - a measured BMR
// is more accurate than any formula, which is only ever a population average.
export function calculateMacros({ sex, ageYears, weightLb, heightIn, activity, goal, weeklyLossLb, knownBmr }) {
  const usingKnownBmr = Boolean(knownBmr && knownBmr > 0);

  let bmr;
  if (usingKnownBmr) {
    bmr = knownBmr;
  } else {
    const weightKg = weightLb * LB_TO_KG;
    const heightCm = heightIn * IN_TO_CM;
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + (sex === 'male' ? 5 : -161);
  }

  const activityInfo = ACTIVITY_LEVELS.find((a) => a.value === activity);
  const tdee = bmr * activityInfo.multiplier;

  const goalInfo = GOALS.find((g) => g.value === goal);
  const calorieAdjustment =
    goal === 'lose' ? -((weeklyLossLb || 0) * KCAL_PER_LB) / 7 : goalInfo.calorieAdjustment;
  const rawTarget = tdee + calorieAdjustment;
  const targetCalories = Math.round(Math.max(MIN_CALORIES, rawTarget));
  const cappedAtFloor = rawTarget < MIN_CALORIES;

  const carbs_g = Math.round((targetCalories * goalInfo.splits.carbs) / 4);
  const protein_g = Math.round((targetCalories * goalInfo.splits.protein) / 4);
  const fat_g = Math.round((targetCalories * goalInfo.splits.fat) / 9);

  return {
    bmr: Math.round(bmr),
    usingKnownBmr,
    tdee: Math.round(tdee),
    targetCalories,
    cappedAtFloor,
    carbs_g,
    fat_g,
    protein_g,
  };
}

// How many weeks to go from the current weight to a goal weight at the
// chosen weekly rate - purely informational, doesn't affect the calorie
// target (which is always based on current stats, not goal stats).
export function estimateWeeksToGoal(currentWeightLb, goalWeightLb, weeklyLossLb) {
  if (!goalWeightLb || goalWeightLb <= 0 || !weeklyLossLb || weeklyLossLb <= 0) return null;
  const toLose = currentWeightLb - goalWeightLb;
  if (toLose <= 0) return null;
  return Math.ceil(toLose / weeklyLossLb);
}

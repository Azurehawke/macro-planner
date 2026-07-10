-- Foods move from a single "per this many grams" number to a proper
-- serving concept: how many (serving_size_qty) of what unit
-- (serving_size_unit, e.g. 'cup', 'oz', defaulting to 'g') make up one
-- serving, with serving_size_g always holding the gram equivalent - the
-- number every downstream calculation (recipes, shopping list, diary
-- fractions) actually multiplies against. Renaming (not adding a parallel
-- column) keeps there being exactly one gram figure to reason about.
ALTER TABLE foods RENAME COLUMN base_quantity_g TO serving_size_g;
ALTER TABLE foods ADD COLUMN serving_size_unit text NOT NULL DEFAULT 'g';
ALTER TABLE foods ADD COLUMN serving_size_qty numeric NOT NULL DEFAULT 100;

-- Backfill: every existing food's serving_size_qty must match its actual
-- serving_size_g (the ADD COLUMN default above just filled every row with
-- 100 regardless of what serving_size_g really is), and its unit really was
-- grams all along.
UPDATE foods SET serving_size_qty = serving_size_g, serving_size_unit = 'g';

-- Optional per-food fiber, used to compute "net carbs" (carbs minus fiber)
-- when a household turns that on below. NULL means "not tracked for this
-- food" and calorie math falls back to plain carbs.
ALTER TABLE foods ADD COLUMN fiber_g numeric;

-- Household-wide (not per-user) so a shared food/recipe shows the same
-- calorie total to everyone in the household regardless of who's looking.
ALTER TABLE households ADD COLUMN track_net_carbs boolean NOT NULL DEFAULT false;

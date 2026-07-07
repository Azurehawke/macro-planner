CREATE TABLE IF NOT EXISTS households (
  id serial PRIMARY KEY,
  name text NOT NULL,
  invite_code text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  household_id integer REFERENCES households(id) ON DELETE SET NULL,
  daily_carbs_goal_g numeric,
  daily_fat_goal_g numeric,
  daily_protein_goal_g numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS foods (
  id serial PRIMARY KEY,
  household_id integer NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name text NOT NULL,
  base_quantity_g numeric NOT NULL DEFAULT 100,
  carbs_g numeric NOT NULL,
  fat_g numeric NOT NULL,
  protein_g numeric NOT NULL,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, name)
);

CREATE TABLE IF NOT EXISTS recipes (
  id serial PRIMARY KEY,
  household_id integer NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, name)
);

CREATE TABLE IF NOT EXISTS recipe_components (
  id serial PRIMARY KEY,
  recipe_id integer NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  food_id integer NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  quantity_g numeric NOT NULL,
  UNIQUE (recipe_id, food_id)
);

-- A planned entry for a day. For item_type='food', `fraction` scales the
-- food's own base_quantity_g. For item_type='recipe', the actual amounts
-- live in diary_entry_components below (one row per recipe component),
-- each independently adjustable so e.g. only half a bun can be planned in.
CREATE TABLE IF NOT EXISTS diary_entries (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('food', 'recipe')),
  food_id integer REFERENCES foods(id) ON DELETE CASCADE,
  recipe_id integer REFERENCES recipes(id) ON DELETE CASCADE,
  fraction numeric NOT NULL DEFAULT 1,
  meal_slot text NOT NULL DEFAULT 'other',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (item_type = 'food' AND food_id IS NOT NULL AND recipe_id IS NULL) OR
    (item_type = 'recipe' AND recipe_id IS NOT NULL AND food_id IS NULL)
  )
);

-- Snapshot of a recipe's components at the time it was planned, so editing
-- the recipe later doesn't retroactively change an already-planned day.
CREATE TABLE IF NOT EXISTS diary_entry_components (
  id serial PRIMARY KEY,
  diary_entry_id integer NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
  food_id integer NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  base_quantity_g numeric NOT NULL,
  fraction numeric NOT NULL DEFAULT 1,
  UNIQUE (diary_entry_id, food_id)
);

CREATE TABLE IF NOT EXISTS shopping_lists (
  id serial PRIMARY KEY,
  household_id integer NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Shopping List',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id serial PRIMARY KEY,
  shopping_list_id integer NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  food_id integer NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  quantity_g numeric NOT NULL,
  checked boolean NOT NULL DEFAULT false,
  added_by integer REFERENCES users(id) ON DELETE SET NULL,
  source_recipe_id integer REFERENCES recipes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shopping_list_id, food_id)
);

CREATE INDEX IF NOT EXISTS idx_foods_household ON foods(household_id);
CREATE INDEX IF NOT EXISTS idx_recipes_household ON recipes(household_id);
CREATE INDEX IF NOT EXISTS idx_recipe_components_food ON recipe_components(food_id);
CREATE INDEX IF NOT EXISTS idx_diary_user_date ON diary_entries(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_diary_entry_components_entry ON diary_entry_components(diary_entry_id);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_household ON shopping_lists(household_id);

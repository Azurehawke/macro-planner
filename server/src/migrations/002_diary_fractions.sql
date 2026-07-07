-- Upgrades a diary_entries table created before the slider-based planner
-- (which used a NOT NULL quantity_g column) to the fraction-based schema.
-- Safe to run on a fresh database too: every statement is a no-op if the
-- column/table already matches (IF [NOT] EXISTS everywhere).
ALTER TABLE diary_entries ADD COLUMN IF NOT EXISTS fraction numeric NOT NULL DEFAULT 1;
ALTER TABLE diary_entries DROP COLUMN IF EXISTS quantity_g;

CREATE TABLE IF NOT EXISTS diary_entry_components (
  id serial PRIMARY KEY,
  diary_entry_id integer NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
  food_id integer NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  base_quantity_g numeric NOT NULL,
  fraction numeric NOT NULL DEFAULT 1,
  UNIQUE (diary_entry_id, food_id)
);

CREATE INDEX IF NOT EXISTS idx_diary_entry_components_entry ON diary_entry_components(diary_entry_id);

# Macro Planner

A self-hosted web app for planning daily macros (carbs/fat/protein) across a household.

## Features

- Multi-user accounts, grouped into **households** via an invite code
- A shared **foods** database (macros per gram, entered from scratch)
- **Recipes** built from foods (or other components), with total macros computed
  live from the ingredients — editing a food's macros immediately updates every
  recipe that uses it
- Each food shows every recipe currently using it ("used in"), updated live —
  no manual re-linking needed
- Per-user **daily macro goals**, set on the Settings page — either by hand,
  or via the built-in **macro calculator** (sex, age, weight, height, 7-level
  activity scale, goal, and — for weight loss — a target rate up to 2 lb/week
  plus an optional goal weight with an estimated time-to-goal) using the
  Mifflin-St Jeor formula, the same one MyFitnessPal's calculator is built
  on. If you already know your BMR (e.g. from a metabolic test), you can
  enter it directly instead of estimating it. A **Body recomposition** goal
  (build muscle while losing fat) is available alongside Lose/Maintain/Gain,
  using a modest deficit with protein and fat set from bodyweight rather than
  a percentage of calories. That same bodyweight-based approach can also be
  opted into for Lose/Maintain/Gain via a "cross-training / athlete mode"
  checkbox, for anyone training heavily (lifting, running, cycling, sports)
  who wants a higher protein floor than the standard percentage split gives.
  "Use these targets" writes straight into your goals, so it's easy to
  recompute every 15-20 lbs or whenever your goal changes
- A per-user **daily plan** for what you intend to eat (not a consumption log —
  pair it with whatever app you already use to track what you actually ate).
  Each planned food or recipe has a slider to dial its amount down or up
  (e.g. plan in just half a bun from a sandwich recipe). Carbs/fat/protein
  each get their own card showing what's planned so far and what's left
  against your Settings-page goal
- A **shopping list** shared by the whole household — add ingredients straight
  from a recipe (scaled by a servings multiplier) or as one-off items, and
  check items off collaboratively
- **Search online** for a food (e.g. "hamburger bun") from the Foods page —
  queries USDA FoodData Central and Open Food Facts and lets you pick a match
  to prefill the add-food form, which you can still review/edit before saving
- **Import from CSV** on both the Foods and Recipes pages, each with a
  "Download CSV template" link so you know the exact columns expected.
  Foods import upserts by name (re-importing an edited file updates existing
  foods instead of erroring on the duplicate). Recipes import uses a "long"
  CSV — one row per ingredient, with the recipe name repeated for each of its
  components — and resolves each `food_name` against your household's
  existing foods, so import your foods CSV first. Bad rows/recipes are
  skipped individually with a reason shown, without blocking the rest of the
  batch
- **Dark mode** — a quick toggle in the nav, plus a Light/Dark/Match system
  selector on the Settings page. Preference is remembered per browser
  (localStorage) with no flash of the wrong theme on load

## Stack

- **Backend:** Node.js + Express, PostgreSQL (via `pg`), JWT cookie auth
- **Frontend:** React + Vite + Tailwind CSS
- **Deploy:** Docker Compose (single `app` container serving the API and the
  built frontend, plus a `db` container for Postgres)

## Running on your server (Docker Compose)

1. Copy the env template and fill in real secrets:
   ```sh
   cp .env.example .env
   ```
   Set `POSTGRES_PASSWORD` and `JWT_SECRET` to long random values, e.g.
   `openssl rand -hex 32`.

2. Build and start:
   ```sh
   docker compose up -d --build
   ```

3. The app is now listening on `http://<server>:9125` (change `APP_PORT` in
   `.env` if you want a different port). No reverse proxy is required — point
   Cloudflare (or your tunnel/DNS setup of choice) at this port directly.

Data persists in the `db_data` Docker volume. To update after pulling new
code: `docker compose up -d --build` — database schema changes are applied
automatically on startup (see `server/src/migrations/`, tracked in a
`schema_migrations` table) without needing to reset the volume or lose data.

**Note on plain-HTTP testing:** the login cookie is marked `Secure` by
default, which browsers silently refuse to store over `http://`. If you're
sanity-checking the deploy by hitting the server's IP directly (before
Cloudflare/DNS is wired up) and login seems to "work" but every other action
says "Not authenticated", set `COOKIE_SECURE=false` in `.env` and
`docker compose up -d` again. Switch it back to `true` once you're accessing
the site over `https://`.

**Optional: online food search.** The Foods page can search USDA FoodData
Central and Open Food Facts to prefill a new food's macros. Open Food Facts
needs no setup. For USDA, sign up for a free key at
https://fdc.nal.usda.gov/api-key-signup.html and set `USDA_FDC_API_KEY` in
`.env`; without it, USDA results are just skipped (Open Food Facts still
works). Search results are only ever a starting point — nothing is saved
until you review and submit the add-food form yourself.

Open Food Facts migrated its full-text search to a new Elasticsearch-backed
service (`search.openfoodfacts.org`) that's still labeled beta on their end,
so if you see an "Open Food Facts search failed" warning, check the `app`
container logs (`docker compose logs app`) — a failed request logs the
response status/body, and an unrecognized response shape logs a sample
product, which is enough to fix the field mapping in
`server/src/services/foodSearchProviders.js`.

## Local development (without Docker)

Requires Node 20+ and a local Postgres.

```sh
# backend
cd server
npm install
DATABASE_URL=postgres://user:pass@localhost:5432/macro_planner JWT_SECRET=dev npm run dev

# frontend (separate terminal)
cd client
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:3000` (override with
`API_PROXY_TARGET`). Visit `http://localhost:5173`.

## Data model notes

- `foods` — base ingredients with macros stored per `base_quantity_g` grams
  (defaults to 100g), scoped to a household.
- `recipes` + `recipe_components` — a recipe is a list of foods with a
  quantity in grams; macros are always computed on the fly from the current
  component data, so there's nothing to keep in sync manually.
- `diary_entries` + `diary_entry_components` — a user's plan for a given
  date/meal slot. A food entry has one adjustable `fraction` (0x-3x of its
  base quantity); a recipe entry snapshots each of the recipe's components
  into `diary_entry_components`, each with its own independently adjustable
  `fraction` — so a planned sandwich can be dialed down to "just half the
  bottom bun" without changing the underlying recipe.
- `shopping_lists` + `shopping_list_items` — scoped to a household (not a
  single user), so any household member can add to or check off the same
  list. Adding a recipe expands its components into (aggregated) list items.

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
- A per-user **diary** to log meals for a day and track totals against daily
  macro goals
- A **shopping list** shared by the whole household — add ingredients straight
  from a recipe (scaled by a servings multiplier) or as one-off items, and
  check items off collaboratively

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
code: `docker compose up -d --build`.

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
- `diary_entries` — a user logs a food or recipe eaten on a given date/meal
  slot; recipe macros are scaled per gram of the finished recipe.
- `shopping_lists` + `shopping_list_items` — scoped to a household (not a
  single user), so any household member can add to or check off the same
  list. Adding a recipe expands its components into (aggregated) list items.

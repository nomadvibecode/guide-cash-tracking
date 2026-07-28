# Guide Cash Tracking

Guide Cash Tracking is a web app for tour guides to track cash-in/cash-out
expenses per tour, submit expense reports with receipts, and let admins
oversee all tours, guide profiles, and expense reports from one place.

## What it does

- Guides sign in, see the tours they're assigned to, and log cash
  transactions (money in / money out) per tour as **expense report lines**.
- Each tour has one **expense report** per guide, with a running balance
  that carries over between tours.
- Guides can attach receipt files (images/PDF) to their expense reports.
- Guides manage their own profile (name, phone, bank/reimbursement details,
  profile picture).
- Admins get a dedicated **Admin Panel** with full CRUD over:
  - **Tours** — create/edit/delete tours and allocate up to 3 guides per tour.
  - **Guide Profiles** — edit/delete any guide's profile.
  - **Expense Reports** — create/edit/delete any guide's expense report.

## Tech stack

- **Frontend:** Vanilla JavaScript (ES modules), [Vite](https://vitejs.dev/),
  [Bootstrap 5](https://getbootstrap.com/) — no framework (no React/Vue),
  no TypeScript.
- **Backend:** [Supabase](https://supabase.com/) — Postgres database,
  Auth, Row-Level Security, and Storage.
- **Hosting:** [Netlify](https://www.netlify.com/) (see [netlify.toml](netlify.toml)).

## Architecture

Multi-page app with a shared shell (header/footer) and a lightweight
client-side router (no full page reloads).

```
index.html                 Single HTML entry point mounted by Vite
src/
  main.js                  App bootstrap
  router/router.js         Path -> page render function mapping
  layout/app-shell.js       Renders header + <main> + footer shell
  components/
    header/                 Nav bar (auth-aware links, admin link, logout)
    footer/                 Site footer
  pages/                    One folder per route, each with .html/.js/.css
    home/                   Public landing page
    login/                  Sign in / sign up
    dashboard/               Guide's tour + balance overview
    tours/                   Guide's "My Tours" page
    expense-reports/         Guide's expense reports + line items + receipts
    my-profile/              Guide's own profile editor
    admin/                   Admin panel (Tours / Guide Profiles / Expense Reports tabs)
    not-found/                404 page
  services/                 Supabase data-access layer (one file per domain)
    supabase-client.js       Creates the Supabase client from env vars
    auth.js                  Sign in/up/out, session, role check (checkAdmin)
    profile.js               Guide profile CRUD (self + admin)
    tours.js                 Tour CRUD + guide allocation
    expense-reports.js        Expense report CRUD + currency lookup
    expense-report-attachments.js  Receipt upload/download via Storage
    guide-workspace.js        Shared helpers for the guide's assigned tours
  utils/
    fragment-loader.js       Loads a page's .html fragment + injects it
  styles/global.css          Shared global styles
supabase/
  schema.sql                 Full current schema snapshot
  migrations/                Timestamped SQL migrations (source of truth for DB changes)
  config.toml                Local Supabase CLI config
docs/database-schema.md      Narrative schema description + ER diagram
scripts/seed-sample-data.js  Seeds demo guides, tours, and expense data
```

Each page is a self-contained module exporting a `render*Page()` function
that the router calls with the `<main>` container. Business logic and
Supabase calls live in `services/`, not in the page files.

## Database schema

See [docs/database-schema.md](docs/database-schema.md) for the full entity
description and ER diagram. Summary:

| Table | Purpose |
|---|---|
| `guide_profiles` | 1:1 with `auth.users`; display name, phone, bank/reimbursement details, profile picture |
| `tours` | A guided tour (name, dates, status, guest count) |
| `tour_guides` | Join table allocating up to 3 guides to a tour |
| `expense_reports` | One cash report per guide per tour (status, currency, running balance) |
| `expense_report_lines` | Individual cash-in/cash-out transactions within a report |
| `expense_report_line_currency` | Lookup table of allowed currencies (EUR/CHF/USD) |
| `expense_report_attachments` | Receipt files linked to an expense report |
| `roles` / `user_roles` | Role-based access control (`admin` / regular user) |

Row-Level Security is enabled on every table. Regular guides can only
read/write rows they own (via `auth.uid()`); admins get explicit
`admin`-only policies backed by a `public.has_role('admin')`
`SECURITY DEFINER` function so they can manage all tours, profiles, and
expense reports. Schema changes are tracked as migrations in
[supabase/migrations](supabase/migrations).

## Authentication & roles

- Supabase Auth handles sign up / sign in / sign out (email + password).
- Roles are modeled with `roles` + `user_roles` tables; `checkAdmin()` in
  [src/services/auth.js](src/services/auth.js) calls the `has_role` RPC to
  decide whether to show the Admin nav link and admin-only actions.
- Admin role must currently be granted directly in the database (insert a
  row into `user_roles` linking a user to the `admin` role) — there is no
  self-service way to become an admin.

## Storage

Expense report receipts are stored in the `expense-report-receipts`
Supabase Storage bucket (5 MB limit, image/PDF only), scoped by object
path prefix `<user_id>/<report_id>/...` with per-user storage policies.
Guide profile pictures are stored in a public bucket.

## Local development setup

**Prerequisites:** Node.js (latest LTS), npm, and a Supabase project.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the env template and fill in your Supabase project values:
   ```bash
   cp .env.example .env
   ```
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — used by the browser app.
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — used only by the local
     seed script, never exposed to the browser.
3. Apply the database schema/migrations to your Supabase project (via the
   Supabase CLI or dashboard) using the files in
   [supabase/migrations](supabase/migrations).
4. (Optional) Seed sample data — creates demo guide accounts, tours, and
   expense reports:
   ```bash
   npm run seed:db
   ```
5. Start the dev server:
   ```bash
   npm run dev
   ```
6. Build / preview a production bundle:
   ```bash
   npm run build
   npm run preview
   ```

## Demo credentials

The seed script ([scripts/seed-sample-data.js](scripts/seed-sample-data.js))
creates guide accounts `guide-10@example.com` … `guide-14@example.com` with
password `demo1234`, each with sample tours and expense reports. To test
the Admin Panel, grant one of these users (or your own account) the
`admin` role via the `user_roles` table.

## Deployment

The app is a static Vite build deployed to Netlify. [netlify.toml](netlify.toml)
runs `npm run build` and publishes `dist/`, with an SPA redirect
(`/* -> /index.html`) so client-side routes resolve correctly. Set the
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables in
the Netlify site settings.

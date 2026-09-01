# Offer Desk

An acquisitions platform for real-estate investors and wholesalers: log
properties, fire off LOIs with proof of funds, analyze the deal, and generate a
shareable pitch — from the field or the desk. One codebase, three platforms
(iOS, Android, web).

Built for the Joseph Real Estate / Deo Volente acquisitions team, architected to
become a paid product for other investors.

**Status: phase 1 in progress.** Foundations are complete and the pipeline,
comps, and multi-strategy analyzer are built. Still to come in phase 1: the LOI
generator, sending an LOI with proof of funds, the deal pitch, and live
dashboard KPIs.

## Quick start

```bash
git clone https://github.com/Franciscodadon/offer-desk.git
cd offer-desk
npm install
npm start          # then press w for web, i for iOS, a for Android
```

Every `npm run` command in this README has to be run from inside the
`offer-desk` folder. "No package.json found" means you are somewhere else.

The app boots without a backend and shows a setup screen explaining what is
missing. There are two ways to give it one.

### Option A: entirely on your machine, no cloud account

Supabase is open source and the whole stack runs locally. This adds no project
to any account and costs nothing. It needs Docker Desktop running.

```bash
npm run db:start    # boots Postgres, Auth, Storage, Realtime and Studio
npm run db:reset    # applies supabase/migrations in filename order
npm run db:status   # prints the local API URL and anon key
```

Copy the `API URL` and `anon key` that `db:status` prints into `.env.local`
(start from `.env.example`), then `npx expo start --clear`.

This is the right setup for building and for verifying the whole flow end to
end. Its one limit is inherent, not a licensing catch: the database lives on
that machine, so a phone on cell data cannot reach it. Local is for
development; sharing a pipeline across devices needs Option B.

### Option B: a hosted project, for real use across devices

The PRD's whole premise is a phone in the field and the web at the desk sharing
one pipeline, and that needs a database both can reach.

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema. `npm run db:bundle` writes
   `supabase/schema.bundle.sql`; paste it into the dashboard's SQL Editor and
   run it. It is one transaction, so it either all lands or none of it does.
   (With the CLI instead: `npx supabase link --project-ref <ref>` then
   `npm run db:push`.)
3. `npm run connect` and paste the Project URL and anon key when prompted. It
   validates both and writes `.env.local` for you.
4. `npm run doctor` confirms the project is reachable, the tables exist, and
   Row-Level Security is on. It names the specific fix for anything that is not.
5. `npx expo start --clear`, then sign up.

The full walkthrough, including the settings worth changing, is in
[`docs/connect-supabase.md`](docs/connect-supabase.md).

If you would rather not use Supabase's hosting at all, the same stack
self-hosts on any VPS you control - it is the same open-source images
`db:start` runs locally, just pointed at a server. That trades roughly ten
dollars a month and some setup for full ownership.

Sign up, and the database creates your workspace automatically.

## What is built

| Area | What is in place |
| --- | --- |
| App shell | Expo SDK 57 + Expo Router, running on iOS, Android, and web from one codebase |
| Design system | Emerald-on-slate tokens, Archivo / IBM Plex Sans / IBM Plex Mono, full light and dark themes, tabular numerals for money |
| UI primitives | `Text`, `Button`, `Card`, `TextField`, `Screen`, `StatusPill`, `Chip`, `EmptyState` - 44pt tap targets, WCAG-AA contrast |
| Auth | Email + password sign-up and sign-in, session persisted in the device keychain, restored on cold start |
| Workspaces | Signing up creates an org, makes you its owner, and seeds a subscription row |
| Data model | All 13 tables from PRD section 9, with indexes, soft deletes, and `updated_at` triggers |
| Security | Row-Level Security on every table, private storage buckets, OAuth token columns unreachable from any client |
| Offline | TanStack Query with on-device persistence; cached reads and local search work with no connection |
| Pipeline (7.2) | List, search by address or agent, status filters with counts, four sort orders, inline status change, offer-to-list on every row |
| Capture (7.3) | One form for the deal, its property facts, and its listing agent; tap-to-call and tap-to-email the agent |
| Analyzer (7.6) | Wholesale, Fix & Flip, BRRRR, and Turnkey. The flip model carries multiple loans, interest-only or amortized, holding and transaction costs, and solves Max Offer exactly |
| Comps (7.7) | Comp rows with per-comp $/sqft, averages, and an ARV suggestion with an upside note |
| Migration path | Prototype JSON export maps onto `deals` + `properties` + `comps` + `analyses`, reporting every row it cannot map |

Not yet built: the LOI generator (7.4), mailbox connection and sending (7.5),
the deal pitch (7.8), and live dashboard KPIs (7.9). See `docs/phase-0.md` for
the foundations handoff and the section 7.5 scope decision.

### The deal math is a specification

PRD 7.6 states the analyzer must reproduce appendix D to the dollar, and gives
an acceptance case. That case is a test (`src/domain/analyzer/__tests__/`), it
passes on every figure the PRD states, and a second test drives the same case
through the real UI so a units bug in a percent field cannot quietly break it.

## Using it without installing anything

The web app builds and deploys itself. Every push to the default branch runs
the checks and, if they pass, publishes to GitHub Pages at
`https://franciscodadon.github.io/offer-desk/`, which works in any browser
including a phone.

Two one-time settings enable it:

1. **Settings -> Pages -> Source**: choose **GitHub Actions**.
2. **Settings -> Secrets and variables -> Actions**, add two repository secrets:
   `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`, the same two
   values from your Supabase dashboard.

Then re-run the latest workflow under the Actions tab.

Both values end up compiled into the published bundle, because the browser has
to reach Supabase somehow. That is safe for the anon key: it grants nothing on
its own, and Row-Level Security decides what any signed-in user can read. The
`service_role` key must never be added as a secret here.

Note that iOS and Android builds still need a build service (EAS), which builds
in the cloud and does not require a Mac. The web app above is enough to use the
product day to day.

## Commands

| Command | What it does |
| --- | --- |
| `npm start` | Expo dev server |
| `npm run web` / `ios` / `android` | Start on one platform |
| `npm test` | Jest unit tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run connect` | Prompts for your Supabase URL and key and writes `.env.local` |
| `npm run doctor` | Checks the connection, the schema, and RLS, and names any fix |
| `npm run db:bundle` | Writes every migration into one file to paste into the SQL Editor |
| `npm run db:start` / `db:stop` | Boots or stops the full Supabase stack locally (needs Docker) |
| `npm run db:reset` | Applies every migration to the local stack |
| `npm run db:status` | Prints the local API URL and anon key |
| `npm run db:push` | Pushes migrations to a linked hosted project |
| `npm run db:test` | Applies every migration to a scratch Postgres and runs the RLS isolation tests |
| `npm run test:integration` | Runs the app's real data layer against a real PostgREST (see below) |

`npm run db:test` needs a local Postgres. It never touches your Supabase
project — it drops and recreates a scratch database, so do not point it at
anything real.

## Architecture

```
Expo app (iOS / Android / Web)
   |
   |  supabase-js over HTTPS
   v
Supabase
   Postgres  - data, Row-Level Security enforcing org isolation
   Auth      - email/password now; Apple and Google sign-in configured in the dashboard
   Storage   - private buckets for LOIs, proof of funds, pitches
   Realtime  - cross-device sync
   Edge Fns  - phase 1+: PDF rendering, Gmail/Graph send, data enrichment
```

Third-party API keys are called only from Edge Functions, so they never reach
the client bundle.

### Why the anon key is safe to ship

It grants nothing by itself. Every table has Row-Level Security enabled and
policies that resolve the caller's workspace from their signed-in identity, so
the key is only ever a ticket to ask — the database decides what comes back.
`supabase/tests/rls_test.sql` proves this: it signs in as one user and asserts
that another workspace's deals are invisible and unwritable. The **service
role** key is a different matter entirely and must never appear in this
repository or in any `EXPO_PUBLIC_*` variable.

## Project layout

See `AGENTS.md` for the directory map, house rules, and the pre-push checklist.

## License

See `LICENSE`.

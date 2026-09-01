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
npm install
npm start          # then press w for web, i for iOS, a for Android
```

The app boots without a backend and shows a setup screen explaining what is
missing. To connect one:

1. Create a free project at [supabase.com](https://supabase.com). The free tier
   (500MB Postgres, 1GB storage, 50k monthly active users) covers the internal
   build comfortably.
2. In the dashboard, open **Project Settings → API** and copy the **Project URL**
   and the **anon public** key.
3. `cp .env.example .env.local` and paste both values in.
4. Apply the schema, either with the Supabase CLI:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   or by pasting each file in `supabase/migrations/` into the dashboard SQL
   editor, **in filename order**.
5. Restart with `npx expo start --clear`. The `--clear` matters: Metro caches
   the transform that inlines `EXPO_PUBLIC_*` values, so without it the app
   keeps reading the old (empty) config.

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

## Commands

| Command | What it does |
| --- | --- |
| `npm start` | Expo dev server |
| `npm run web` / `ios` / `android` | Start on one platform |
| `npm test` | Jest unit tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:test` | Applies every migration to a scratch Postgres and runs the RLS isolation tests |

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

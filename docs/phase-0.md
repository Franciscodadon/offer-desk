# Phase 0 — Foundations

Scope, decisions, and verification for the foundations release. Maps to the
"0 Foundations" roadmap item in the PRD (section 15).

## What was asked for

> Expo + Supabase scaffold, auth, org/user, data model + RLS, design tokens
> ported from the prototype, offline cache. Import the existing JSON so today's
> deals carry over.

## What was built

### App shell
Expo SDK 57, React Native 0.86, React 19, Expo Router with typed routes. One
codebase produces iOS, Android, and a static web build. Routes are grouped as
`(auth)` for signed-out screens and `(app)` for signed-in ones, with a guard in
each group layout so a route can never render on the wrong side of the auth
boundary.

The root layout mounts providers in dependency order — safe area, theme,
offline query cache, auth — and holds the splash screen until both the fonts
and the stored session have loaded, so the app never flashes a signed-out frame
at someone who is already signed in. A font that fails to download does not
block the app; it renders with system fallbacks instead.

### Design system
PRD Appendix C, implemented in `src/theme/`:

- **Emerald `#0E7A57`** on cool-slate neutrals, with a full 10-step scale so
  later screens have room without inventing new colors.
- **Archivo** (display), **IBM Plex Sans** (UI), **IBM Plex Mono** (numbers).
  The mono variants set `font-variant: tabular-nums`, so columns of money line
  up — the analyzer and comps table depend on this.
- **Light and dark**, defined as semantic roles (`surface`, `textMuted`,
  `accent`, `positive`) rather than raw colors. Screens never touch the palette
  directly, which makes the v3 white-label swap a one-file change.
- 44pt minimum tap targets and AA-contrast pairs throughout, per PRD 12.

### Data model
All 13 tables from PRD section 9, in `supabase/migrations/`. Every table carries
`org_id`, `created_at`, `updated_at` (maintained by trigger), and `deleted_at`.
Indexes cover the access paths the PRD names: `org_id`, `status`,
`submitted_at`, plus a trigram index backing address search and partial indexes
that skip soft-deleted rows.

`subscriptions` is created now even though billing is v3, so the multi-tenant
shape never has to change under a live database.

### Security
Row-Level Security is enabled on every table with policies keyed on
`current_org_id()`, a `SECURITY DEFINER` function that resolves the caller's
workspace from `public.users`. Its `search_path` is pinned so a caller cannot
shadow `public` and redirect the lookup.

Two decisions worth flagging:

1. **Table grants are explicit.** A hosted Supabase project grants CRUD to
   `anon` and `authenticated` by default. Relying on that leaves the security
   posture unstated and unportable, so the migration revokes everything and
   grants back deliberately: `anon` gets nothing at all, `authenticated` gets
   CRUD still filtered by policy, and `subscriptions` is read-only to clients.
2. **OAuth tokens are unreachable, not merely hidden.** `email_accounts` holds
   the Gmail and Microsoft refresh tokens that phase 1's send feature depends
   on. Beyond the policy restricting rows to their owner, the token columns are
   revoked at the column level, so even a future policy mistake cannot expose
   them. Only Edge Functions, running as the service role, can read them.

Storage uses private buckets with org-prefixed paths (`<org_id>/<deal_id>/...`)
and matching policies, so a signed URL is the only way to read a document.

### Auth and workspace bootstrap
Email and password sign-up and sign-in. A database trigger on `auth.users`
creates the matching profile row and, for a new account, the org that owns it
and its subscription row — so a user is never left signed in with no workspace
and no `org_id` for RLS to match on. The trigger already handles the v2 invite
case: a signup carrying an `org_id` in its metadata joins that org as a member
instead of founding a new one.

Sessions persist in the device keychain via `expo-secure-store`. SecureStore
rejects values over about 2KB and a Supabase session can exceed that, so
`src/lib/secureStorage.ts` splits values across numbered chunks and reassembles
them on read; a partial write reads back as absent rather than as a truncated
session. Web falls back to `localStorage`. Token refresh is tied to app
foreground state, so a phone that has been in a pocket all afternoon comes back
with a live session.

Signing out clears the offline cache, so the next account on a shared device
cannot read the previous one's deals out of it.

### Offline cache
TanStack Query with AsyncStorage persistence. Cached data stays usable for a
week without a connection, mutations retry, and queries refetch on reconnect.
Deal records are small, so one persisted cache is enough; if the pipeline grows
past a few thousand rows the persister can be swapped for SQLite without
touching calling code.

### Prototype import
`src/features/import/legacyImport.ts` maps the prototype's JSON export onto
`deals`, `properties`, `comps`, and `analyses`. Two rules shaped it:

- **A partial import is worse than a reported one.** Every row that cannot be
  mapped lands in `warnings` with enough detail to fix by hand. A deal with no
  address is skipped and reported; an unrecognized status still imports the
  deal, parked in Follow Up, and says so.
- **It does not write to the database.** It returns rows for the caller to
  insert in one transaction, so a failed import leaves no half-populated
  pipeline behind.

It normalizes what the prototype actually emits: `$300,000` becomes `300000`,
`8/31/2026` becomes `2026-08-31`, `"LOI Sent"` becomes `loi_sent`, and a MAO of
`70` becomes the ratio `0.7`.

**This is the one piece written against an assumed shape.** The real export was
not available, so the readers accept several plausible spellings of each field.
When a real export exists, drop it into the fixture test and tighten them.

## Verification

Everything below was run, not assumed.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Clean |
| `npm test` | 22 tests, all passing |
| `npm run db:test` | All 4 migrations apply to a clean Postgres 16; RLS isolation assertions pass |
| Mutation test of the RLS suite | Disabling RLS on `deals` makes the suite fail as intended, so it is not vacuous |
| `npx expo export --platform web` | Bundles and statically renders all 14 routes |
| Browser render (Chromium, light and dark) | Setup, sign-in, and sign-up screens render with correct fonts and colors; zero console errors |

The RLS tests assert that two independently created workspaces are isolated:
one user sees exactly their own deal, org, and profile; a cross-org insert is
rejected; a cross-org update matches zero rows; and a caller with no user id
sees nothing at all.

## Decisions and deviations

**Styling is a typed token system, not NativeWind or Tamagui.** The PRD suggests
either. Both add a build-time layer (a Tailwind compiler or a Babel plugin) whose
compatibility has to be re-verified against each SDK bump, in exchange for
authoring speed. Since the real requirement is the Appendix C token set, and
tokens are the thing later screens consume, this ships the tokens as typed
objects that work identically on all three platforms today. Either library can
be layered on later without rework, because the tokens stay the source of truth.

**Email confirmation is left on.** The signup trigger creates the workspace on
insert into `auth.users`, so an unconfirmed account still has a valid workspace
waiting. Turning confirmation off would speed up internal onboarding; it is a
one-setting change in the dashboard.

**Apple and Google sign-in are configured but not templated.** PRD 7.1 asks for
them. They need client secrets, which belong in the hosted dashboard and must
never be committed, so `supabase/config.toml` deliberately leaves them out.
Enabling them is dashboard configuration plus a `signInWithOAuth` call.

## The PRD conflict that needs a decision

Section 7.5 marks Gmail and Outlook OAuth send as **P0 · v1**, while section 6's
scope table and section 10's stack section both say v1 ships native
share-sheet/mailto and OAuth send is P1/v2. These cannot both hold.

The sequencing constraint is real regardless of which is chosen: OAuth send
needs deployed Edge Functions, a Google Cloud project, and Google's
sensitive-scope verification review, which the PRD itself budgets days for.
Nothing about that work can be shortened by starting it earlier in the app.

The recommendation is to build the send abstraction in phase 1 with a
share-sheet implementation behind it, start Google verification in parallel, and
drop the OAuth implementation in behind the same interface when it clears. That
gets a sendable LOI into the team's hands in phase 1 without a rewrite when
verification lands.

## Phase 1 entry points

The scaffolding each phase-1 feature plugs into:

| Feature | Where it goes | What is already there |
| --- | --- | --- |
| Deal pipeline (7.2) | `src/app/(app)/pipeline.tsx` | Statuses, colors, pills, `offerToList`, query keys, `deals` table + indexes |
| Property & agent capture (7.3) | `src/features/deals/` | `properties` and `contacts` tables, domain types |
| LOI generator (7.4) | Edge Function + `src/features/loi/` | `templates` and `documents` tables, org branding fields, private bucket |
| Mailbox connect & send (7.5) | Edge Functions + `src/features/email/` | `email_accounts` table with locked-down token columns, `activities` audit log |
| Analyzer (7.6) | `src/features/analyzer/` | `analyses` table with `inputs`/`computed` JSONB, `parseNumericInput`, mono/tabular number styles |
| Comps (7.7) | `src/features/comps/` | `comps` table, `formatMoneyCents` for $/sqft |
| Pitch (7.8) | Edge Function + hosted route | `documents` table, pitch document type |
| Dashboard KPIs (7.9) | `src/app/(app)/dashboard.tsx` | KPI frame, `DECIDED_STATUSES` for acceptance rate, `submitted_at` index |

**Start with the analyzer math.** PRD Appendix D is a specification and section
7.6 gives an exact acceptance case (ARV 357,244 → Max Offer 237,483, margin
14.0%, cash-on-cash 49%). Write that as a test first, build the math as a pure
module with no React in it, then put UI on top. It is the highest-risk piece to
get wrong and the easiest to verify.

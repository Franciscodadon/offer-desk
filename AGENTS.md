# Working in this repository

## Expo has changed

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before
writing any code. This project is on Expo SDK 57 / React Native 0.86 / React 19.
Patterns from older SDKs (especially anything pre-Expo-Router, or `expo install`
guidance written for SDK 50) will be wrong.

## Where things live

| Path | What it holds |
| --- | --- |
| `src/app/` | Expo Router routes. `(auth)` is signed out, `(app)` is signed in. |
| `src/components/ui/` | Shared primitives. Screens compose these, not raw `View`/`Text`. |
| `src/theme/` | Design tokens, light/dark themes, fonts. The only place colors are defined. |
| `src/domain/` | Deal statuses, record types, comps math, and the analyzer. No React, no I/O. |
| `src/lib/` | Supabase client, env, offline query cache, formatting. |
| `src/features/` | Feature modules (`auth`, `deals`, `comps`, `analyzer`, `import`). |
| `supabase/migrations/` | Schema and RLS. Applied in filename order; never edit an applied migration. |
| `supabase/tests/` | RLS isolation tests plus the local Postgres shim they run against. |
| `src/test/` | Shared render helper for component tests. |

## House rules

1. **Never define a color outside `src/theme/`.** Screens read semantic roles
   (`theme.color.accent`), not raw palette values, so the v3 white-label swap is
   a one-file change.
2. **Every table is org-scoped.** Any new table gets `org_id`, timestamps,
   `deleted_at`, RLS enabled, and a policy keyed on `current_org_id()`. Add a
   case to `supabase/tests/rls_test.sql` when you add one.
3. **Money is never a float in disguise.** Parse user input with
   `parseNumericInput`, which returns `null` rather than `0` for partial input,
   so a half-typed field cannot silently corrupt deal math.
4. **Secrets never enter `src/`.** Only `EXPO_PUBLIC_*` values reach the client
   bundle. OAuth client secrets, the service-role key, and data-provider keys
   belong in Edge Function secrets.
5. **The deal math in PRD Appendix D is a specification.** The section 7.6
   acceptance case is a test and it passes to the dollar. Never change
   `src/domain/analyzer` without running it, and never adjust the expected
   figures to make a change pass.
6. **Rates are ratios, everywhere.** 12.5% is `0.125` in every model and every
   stored row. The conversion happens once, in `PercentInput`. Dividing by 100
   anywhere else means something is already wrong.

## Before you push

```bash
npm run typecheck   # tsc --noEmit
npm test            # jest
npm run db:test     # migrations + RLS isolation, needs a local Postgres
```

When you touch a policy, a grant, or anything in `src/features/*/api.ts`, also
run the integration tests. They are the only thing that proves the policies and
the queries agree:

```bash
./scripts/integration-up.sh && npm run test:integration
```

## Gotcha: env changes need a cache clear

Metro caches the transform that inlines `EXPO_PUBLIC_*` values. After editing
`.env.local`, restart with `npx expo start --clear` (or
`npx expo export --clear`) or the app will keep reading the previous values.

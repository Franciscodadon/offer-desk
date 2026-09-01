# Connecting Offer Desk to a Supabase project

Start to finish this is about ten minutes, most of it waiting for the project to
provision. Nothing here is irreversible, and none of it touches the code.

## 0. Get the code onto your machine

This project lives on GitHub, not on your laptop, until you clone it. Every
`npm run` command below has to be run from inside the project folder, so this
comes first.

```bash
git clone https://github.com/Franciscodadon/offer-desk.git
cd offer-desk
npm install
```

`git clone` puts you on the right branch automatically, since it is the
repository's default. Confirm you are in the right place before continuing:

```bash
npm run          # should list db:bundle, connect, doctor, and the rest
```

If that errors with "no package.json", you are in the wrong folder. `cd` into
`offer-desk` and try again.

## 1. Create the project

In the Supabase dashboard, **New project**.

- **Name**: Offer Desk
- **Database password**: generate one and save it in your password manager. You
  will need it if you ever use the CLI, and it cannot be retrieved later - only
  reset.
- **Region**: pick the one closest to where the team works. For Florida that is
  `us-east-1`.

Provisioning takes a minute or two.

## 2. Copy the two values the app needs

**Project Settings -> API**, then copy:

| Dashboard label | Goes into |
| --- | --- |
| Project URL | `EXPO_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | `EXPO_PUBLIC_SUPABASE_ANON_KEY` |

Do **not** copy the `service_role` key. It bypasses every security policy in the
database, and anything prefixed `EXPO_PUBLIC_` is compiled into the app bundle
that ships to phones. The anon key is safe there precisely because it grants
nothing on its own - Row-Level Security decides what any signed-in user can
read.

## 3. Apply the schema

Two ways. The first needs nothing installed.

### Option A: paste it (simplest for the first setup)

**This is for a database with nothing in it.** To update one that already has
the schema, skip to "Updating an existing database" below.

```bash
npm run db:bundle
```

That writes `supabase/schema.bundle.sql` - all four migrations concatenated in
order, wrapped in a single transaction. In the dashboard open **SQL Editor ->
New query**, paste the whole file, and **Run**.

Because it is one transaction, either the whole schema lands or none of it
does. There is no half-applied state to clean up if something goes wrong.

### Option B: the CLI (better for ongoing work)

```bash
npx supabase login                              # opens a browser
npx supabase link --project-ref <your-ref>      # asks for the DB password
npm run db:push
```

The project ref is the subdomain of your Project URL: for
`https://abcdefgh.supabase.co` the ref is `abcdefgh`.

Once linked, future schema changes are one `npm run db:push` instead of another
paste, so it is worth doing at some point even if you start with Option A.

## Updating an existing database

`supabase/schema.sql` builds the schema from nothing, so running it a second
time fails on the first type it tries to create:

```
ERROR: 42710: type "org_role" already exists
```

That failure is harmless. The file is wrapped in a single transaction, so it
rolls back and the database is exactly as it was. But it is not how to apply a
change.

To update, apply only the migrations you have not run yet, from
`supabase/migrations/`, oldest first. Each file stands alone: open it, copy it,
paste it into the SQL Editor, Run. The migrations after the initial four are
written to be safe to run twice, so re-applying one you already have is not a
problem.

With the CLI it is one command instead:

```bash
npm run db:push
```

## 4. Point the app at it

```bash
cp .env.example .env.local
```

Fill in the two values from step 2. `.env.local` is gitignored, so the keys stay
on your machine.

## 5. Restart with a cleared cache

```bash
npx expo start --clear
```

The `--clear` is not optional. Metro caches the transform that inlines
`EXPO_PUBLIC_*` values, so without it the app keeps reading the previous
(empty) config and still shows the setup screen. If you skip this and wonder
why nothing changed, this is why.

## 6. Sign up

The setup screen should be gone, replaced by sign-in. Create an account with
your name and workspace name. A database trigger creates the org, makes you its
owner, and seeds a subscription row, so the pipeline is ready immediately.

### If you do not get in

New Supabase projects have **Confirm email** switched on, so signing up sends a
confirmation link before the account can sign in. Check your inbox, including
spam.

For an internal team that is friction with no benefit - you already trust
everyone signing up. To turn it off: **Authentication -> Sign In / Providers ->
Email**, then switch off **Confirm email**. Turn it back on before anyone
outside the team gets an account, since without it anyone can register with an
address they do not control.

While you are in Authentication, set **URL Configuration -> Site URL** to
wherever the web build runs (`http://localhost:8081` during development), and
add `offerdesk://` to the redirect allow-list so confirmation links can return
to the mobile app.

## A note on confirmation email

Supabase's built-in mailer is for development, not for running a team on. It is
rate limited to a handful of messages an hour, and on a new project it will
only deliver to addresses that belong to the project's own organization. A
confirmation sent to anyone else is accepted by the API and then never arrives,
which looks exactly like a lost email.

That leaves two workable setups:

- **Internal team, now:** turn off **Confirm email** under Authentication ->
  Sign In / Providers -> Email. Everyone signing up is already trusted, and it
  removes the whole failure mode. Turn it back on before outside users get
  accounts.
- **Real users, later:** configure custom SMTP under Authentication -> Emails
  (Resend and Postmark both have free tiers). That is required before anyone
  outside the organization can confirm an account at all, and it is the same
  work PRD 10 anticipates for transactional email.

If an account is already stuck half-confirmed, delete it under Authentication
-> Users and sign up again once the setting is changed.

## 7. Confirm it works

Log a deal from the pipeline, then reload the page. If it is still there, the
whole path is working: auth issued a token, RLS resolved your workspace from
it, and the write landed.

## What this does not turn on

- **Apple and Google sign-in** (PRD 7.1) need client secrets configured in the
  dashboard under Authentication -> Sign In / Providers. Email and password
  works without them.
- **Sending LOIs from your own mailbox** (PRD 7.5) needs Edge Functions and
  Google's verification review. That is its own piece of work.
- **Storage buckets** are created by the migrations, but nothing writes to them
  until the LOI generator lands.

## Cost

Nothing here leaves the free tier. The internal build's whole year of deals,
LOIs, and proof-of-funds documents fits inside 500MB of Postgres and 1GB of
file storage with room to spare.

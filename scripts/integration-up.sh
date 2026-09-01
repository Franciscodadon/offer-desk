#!/usr/bin/env bash
# Brings up the backend the integration tests run against: a real Postgres with
# every migration applied, fronted by a real PostgREST.
#
#   ./scripts/integration-up.sh
#   npm run test:integration
#   ./scripts/integration-down.sh
#
# Why not `supabase start`? That is the better tool when Docker is available and
# it is what the README recommends for development. This path exists because it
# needs only two ordinary binaries, so the same tests can run in CI, in a
# container-less sandbox, or on a laptop that does not have Docker installed.
#
# It verifies the layer unit tests cannot reach: that the RLS policies, the
# column grants, and the queries in the app actually agree with each other.
#
# The database is DROPPED and recreated on every run.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGHOST="${PGHOST:-/var/tmp}"
PGPORT="${PGPORT:-55432}"
PGUSER="${PGUSER:-postgres}"
DBNAME="${DBNAME:-offerdesk_integration}"
POSTGREST_PORT="${INTEGRATION_POSTGREST_PORT:-3999}"
JWT_SECRET="${INTEGRATION_JWT_SECRET:-super-secret-jwt-token-with-at-least-32-characters-long}"
RUNDIR="${RUNDIR:-/var/tmp/offerdesk-integration}"

if ! command -v postgrest >/dev/null 2>&1 && [ ! -x "$RUNDIR/postgrest" ]; then
  cat >&2 <<'MSG'
PostgREST was not found.

Install it from https://github.com/PostgREST/postgrest/releases (a single
static binary), put it on your PATH, and run this script again.
MSG
  exit 1
fi

POSTGREST_BIN="$(command -v postgrest || echo "$RUNDIR/postgrest")"
mkdir -p "$RUNDIR"

psql_admin() { psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -v ON_ERROR_STOP=1 -q "$@"; }
psql_db() { psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DBNAME" -v ON_ERROR_STOP=1 -q "$@"; }

echo "==> recreating $DBNAME"
psql_admin -c "drop database if exists $DBNAME;" -c "create database $DBNAME;"

echo "==> applying shim and migrations"
psql_db -f "$ROOT/supabase/tests/shim.sql"
for file in "$ROOT"/supabase/migrations/*.sql; do
  psql_db -f "$file"
done

echo "==> seeding two workspaces through the real signup trigger"
psql_db <<'SQL'
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com',
   '{"name":"Alice","org_name":"Alpha Acquisitions"}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com',
   '{"name":"Bob","org_name":"Bravo Holdings"}'::jsonb);
SQL
psql_db -c "alter role authenticator with login password 'postgres';"

echo "==> starting PostgREST on :$POSTGREST_PORT"
cat > "$RUNDIR/postgrest.conf" <<CONF
db-uri = "postgres://authenticator:postgres@localhost:$PGPORT/$DBNAME"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-port = $POSTGREST_PORT
CONF

pkill -f "$RUNDIR/postgrest.conf" 2>/dev/null || true
nohup "$POSTGREST_BIN" "$RUNDIR/postgrest.conf" > "$RUNDIR/postgrest.log" 2>&1 &

for _ in $(seq 1 30); do
  if curl -sf -o /dev/null "http://127.0.0.1:$POSTGREST_PORT/"; then
    echo "==> ready. Run: npm run test:integration"
    exit 0
  fi
  sleep 1
done

echo "PostgREST did not come up. Log:" >&2
tail -20 "$RUNDIR/postgrest.log" >&2
exit 1

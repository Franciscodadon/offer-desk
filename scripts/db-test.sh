#!/usr/bin/env bash
# Applies every migration to a scratch Postgres and runs the RLS isolation
# tests against it. No Docker and no Supabase project required - it needs only
# a local Postgres server, which makes it safe to run in CI.
#
#   ./scripts/db-test.sh                    # uses a local cluster on :55432
#   PGURL=postgres://... ./scripts/db-test.sh   # or point it at any database
#
# The target database is DROPPED and recreated on every run. Never point this
# at a database that holds real data.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGHOST="${PGHOST:-/var/tmp}"
PGPORT="${PGPORT:-55432}"
PGUSER="${PGUSER:-postgres}"
DBNAME="${DBNAME:-offerdesk_test}"

psql_admin() { psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -v ON_ERROR_STOP=1 -q "$@"; }
psql_db() { psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DBNAME" -v ON_ERROR_STOP=1 -q "$@"; }

echo "==> recreating $DBNAME"
psql_admin -c "drop database if exists $DBNAME;" -c "create database $DBNAME;"

echo "==> applying shim (local stand-in for Supabase auth/storage)"
psql_db -f "$ROOT/supabase/tests/shim.sql"

echo "==> applying migrations"
for file in "$ROOT"/supabase/migrations/*.sql; do
  echo "    $(basename "$file")"
  psql_db -f "$file"
done

echo "==> running RLS isolation tests"
psql_db -f "$ROOT/supabase/tests/rls_test.sql" >/dev/null

echo "==> PASS: migrations apply cleanly and org isolation holds"

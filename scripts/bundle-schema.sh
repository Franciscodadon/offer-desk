#!/usr/bin/env bash
# Concatenates every migration, in filename order, into one file you can paste
# into the Supabase SQL editor in a single go.
#
#   npm run db:bundle    ->  supabase/schema.sql
#
# The output is committed so it can be opened and copied straight from GitHub
# without cloning anything. The migrations remain the source of truth; CI
# regenerates this file and fails if it differs, so the two cannot drift.
#
# Use it for the first setup of a hosted project. After that, `npm run db:push`
# applies new migrations incrementally.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$ROOT/supabase/schema.sql}"

{
  echo "-- Offer Desk - complete database schema."
  echo "--"
  echo "-- GENERATED FILE. Do not edit: edit supabase/migrations/ and run"
  echo "-- npm run db:bundle. CI checks that this file matches the migrations."
  echo "--"
  echo "-- FOR A FRESH DATABASE ONLY. This creates types and tables from"
  echo "-- nothing, so running it against a database that already has the"
  echo "-- schema fails on the first type it tries to create:"
  echo "--     ERROR: 42710: type \"org_role\" already exists"
  echo "-- That failure is safe - the whole file is one transaction, so it"
  echo "-- rolls back and changes nothing - but it is not the way to update."
  echo "--"
  echo "-- TO UPDATE AN EXISTING DATABASE, apply only the migration files you"
  echo "-- have not run yet, from supabase/migrations/, oldest first. Each one"
  echo "-- can be pasted into the SQL Editor on its own. With the CLI:"
  echo "--     npm run db:push"
  echo
  echo "begin;"
  echo
  for file in "$ROOT"/supabase/migrations/*.sql; do
    echo "-- ============================================================"
    echo "-- $(basename "$file")"
    echo "-- ============================================================"
    cat "$file"
    echo
  done
  echo "commit;"
} > "$OUT"

echo "wrote $OUT ($(wc -l < "$OUT") lines)"

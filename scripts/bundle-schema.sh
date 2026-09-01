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
  echo "-- To apply: copy this whole file into the Supabase SQL Editor and Run."
  echo "-- It is one transaction, so it either all applies or none of it does."
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

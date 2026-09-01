#!/usr/bin/env bash
# Stops the PostgREST started by integration-up.sh. The Postgres database is
# left in place; the next integration-up.sh drops and recreates it.
set -euo pipefail
RUNDIR="${RUNDIR:-/var/tmp/offerdesk-integration}"
pkill -f "$RUNDIR/postgrest.conf" 2>/dev/null && echo "stopped PostgREST" || echo "PostgREST was not running"

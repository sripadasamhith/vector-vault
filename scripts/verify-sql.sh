#!/usr/bin/env bash
# Verify the migrations against a real Postgres, with no Supabase project
# involved. Applies 0001 -> 0003 -> 0002 to a throwaway container, then runs
# supabase/test/schema_test.sql, which asserts RLS isolation and create_commit
# behaviour. Exits non-zero on the first failed assertion.
#
# Requires Docker. Usage: npm run verify:sql
set -euo pipefail

CONTAINER=vv-pg-verify
IMAGE=postgres:16
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

if ! docker info >/dev/null 2>&1; then
  echo "✗ Docker is not running. Start Docker Desktop and retry." >&2
  exit 1
fi

cleanup
echo "Starting $IMAGE ..."
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=pw "$IMAGE" >/dev/null

for _ in $(seq 1 30); do
  docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 || {
  echo "✗ Postgres did not become ready" >&2; exit 1; }

psql_run() { docker exec -i "$CONTAINER" psql -U postgres -q -v ON_ERROR_STOP=1; }

# Order matters: RLS before the RPC, matching supabase/APPLY.md.
for f in \
  "$ROOT/supabase/test/harness.sql" \
  "$ROOT/supabase/migrations/0001_init.sql" \
  "$ROOT/supabase/migrations/0003_rls.sql" \
  "$ROOT/supabase/migrations/0002_create_commit.sql"
do
  echo "Applying $(basename "$f") ..."
  psql_run < "$f" 2>&1 | grep -v "does not exist, skipping" || true
done

echo "Running assertions ..."
# Capture psql's own exit code — do NOT pipe directly into grep, or grep's
# status masks a failing psql and the gate silently always passes.
set +e
OUT="$(docker exec -i "$CONTAINER" psql -U postgres -q -v ON_ERROR_STOP=1 \
       < "$ROOT/supabase/test/schema_test.sql" 2>&1)"
CODE=$?
set -e

echo "$OUT" | grep -Ev '^\s*$|^ set_config|^-+$|^\(1 row\)|^ vv_assert|^ create_commit'

if [ "$CODE" -ne 0 ] || ! grep -q "ALL SQL ASSERTIONS PASSED" <<<"$OUT"; then
  echo "✗ SQL verification FAILED (psql exit $CODE)" >&2
  exit 1
fi
echo "✓ SQL verification passed"

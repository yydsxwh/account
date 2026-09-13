#!/bin/bash
# First-boot (and later restart) helpers for the systemd host install.
# Does not seed demo users.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p "$ROOT/data" "$ROOT/public/uploads"

if [ -f "$ROOT/.env.production" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env.production"
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="file:$ROOT/data/prod.db"
fi

npx prisma generate
npx prisma db push --schema="$ROOT/prisma/schema.prisma"
node "$ROOT/deploy/ensure-admin.mjs"

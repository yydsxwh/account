#!/bin/sh
set -e

mkdir -p /data /app/public/uploads

if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="file:/data/prod.db"
fi

if [ -f /app/node_modules/prisma/build/index.js ]; then
  node /app/node_modules/prisma/build/index.js db push --schema=/app/prisma/schema.prisma
elif command -v npx >/dev/null 2>&1; then
  npx prisma db push --schema=/app/prisma/schema.prisma
fi

if [ -f /app/deploy/ensure-admin.mjs ]; then
  node /app/deploy/ensure-admin.mjs
fi

exec node /app/server.js

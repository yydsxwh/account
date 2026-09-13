#!/bin/bash
# Run on the live VPS after the account-center files are in /var/www/account.
# Shares the login cookie with www, adds the account-center entry to the www
# login pages, installs the user-sync cron, and hands out kk numbers.
# Never prints secrets. Rebuild both apps afterwards.
set -euo pipefail

ACCOUNT_ROOT="${ACCOUNT_ROOT:-/var/www/account}"
WWW_ROOT="${WWW_ROOT:-/var/www/yyds-course-platform}"
WWW_ENV="${WWW_ROOT}/.env"
ACC_ENV="${ACCOUNT_ROOT}/.env.production"

WWW_ENV="$WWW_ENV" ACC_ENV="$ACC_ENV" python3 << 'PY'
from pathlib import Path
import os
import re

www_env = Path(os.environ["WWW_ENV"])
acc_env = Path(os.environ["ACC_ENV"])
www = www_env.read_text()
acc = acc_env.read_text()

wm = re.search(r"^AUTH_SECRET=(.*)$", www, re.M)
if not wm:
    raise SystemExit("www AUTH_SECRET missing")
secret = wm.group(1).strip().strip('"').strip("'")
if len(secret) < 16:
    raise SystemExit("www AUTH_SECRET too short")

def replace_secret(text: str) -> str:
    out, n = re.subn(
        r"^AUTH_SECRET=.*$",
        'AUTH_SECRET="%s"' % secret.replace("\\", "\\\\").replace('"', '\\"'),
        text,
        count=1,
        flags=re.M,
    )
    if n != 1:
        raise SystemExit("account AUTH_SECRET replace failed")
    return out

acc_env.write_text(replace_secret(acc))
if "COOKIE_DOMAIN=" not in www:
    if not www.endswith("\n"):
        www += "\n"
    www += 'COOKIE_DOMAIN=".yydsxwh.com"\n'
    www_env.write_text(www)
    print("added www COOKIE_DOMAIN")
else:
    print("www COOKIE_DOMAIN already set")
print("aligned AUTH_SECRET len=%s" % len(secret))
PY

install -m 0644 "$ACCOUNT_ROOT/deploy/www-sso/login-page.tsx" "$WWW_ROOT/src/app/login/page.tsx"
install -m 0644 "$ACCOUNT_ROOT/deploy/www-sso/register-page.tsx" "$WWW_ROOT/src/app/register/page.tsx"
python3 "$ACCOUNT_ROOT/deploy/www-sso/patch-www-auth.py"

CRON_LINE='*/2 * * * * /usr/bin/node /var/www/account/deploy/sync-users-both-ways.mjs >> /var/www/account/data/user-sync.log 2>&1'
current="$(crontab -l 2>/dev/null || true)"
if echo "$current" | grep -q "sync-users-both-ways.mjs"; then
  echo "cron already installed"
else
  { printf '%s\n' "$current"; printf '%s\n' "$CRON_LINE"; } | grep -v '^$' | crontab -
  echo "installed user-sync cron"
fi

cd "$ACCOUNT_ROOT"
set -a
# shellcheck disable=SC1090
. "$ACC_ENV"
set +a

# 同步先跑：它会补上 kkNumber 列，之后 prisma db push 就不用 --accept-data-loss
USER_SYNC_LOCK=off /usr/bin/node "$ACCOUNT_ROOT/deploy/sync-users-both-ways.mjs"
npx prisma generate
npx prisma db push --schema="$ACCOUNT_ROOT/prisma/schema.prisma"
/usr/bin/node "$ACCOUNT_ROOT/deploy/backfill-kk-numbers.mjs"
# 再同步一次，把刚发的 kk 号写回主站
USER_SYNC_LOCK=off /usr/bin/node "$ACCOUNT_ROOT/deploy/sync-users-both-ways.mjs"
echo "apply-live-sso done"

#!/bin/bash
# Run on the live VPS after the account-center files are in /var/www/account.
# Aligns cookie secret, copies www login/register to the account center,
# installs the user-sync cron, and syncs User rows. Does not print secrets.
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

USER_SYNC_LOCK=off /usr/bin/node "$ACCOUNT_ROOT/deploy/sync-users-both-ways.mjs"
echo "apply-live-sso done"

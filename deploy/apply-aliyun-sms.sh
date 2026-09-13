#!/bin/bash
# Write the approved Aliyun sign + template onto both live SQLite files.
# Does not print secrets. Leaves test mode on until AccessKey is present.
set -euo pipefail

ACCOUNT_DB="${ACCOUNT_DATABASE_PATH:-/var/www/account/data/prod.db}"
WWW_DB="${WWW_DATABASE_PATH:-/var/www/yyds-course-platform/prisma/prod.db}"
SIGN="${SMS_SIGN_NAME:-歪歪滴艾斯杭州科技}"
TEMPLATE="${SMS_TEMPLATE_CODE:-SMS_512395568}"

python3 - "$ACCOUNT_DB" "$WWW_DB" "$SIGN" "$TEMPLATE" << 'PY'
import sqlite3
import sys

account_db, www_db, sign, template = sys.argv[1:5]

def patch(path, label):
    con = sqlite3.connect(path)
    cols = [c[1] for c in con.execute("PRAGMA table_info(SiteSettings)")]
    needed = ["smsSignName", "smsTemplateCode", "smsEnabled", "smsTestMode",
              "smsAccessKeyId", "smsAccessKeySecret"]
    for col in needed:
        if col not in cols:
            raise SystemExit("%s missing column %s" % (label, col))
    row = con.execute("SELECT smsSignName, smsTemplateCode, smsEnabled, smsTestMode, length(smsAccessKeyId), length(smsAccessKeySecret) FROM SiteSettings WHERE id='default'").fetchone()
    if not row:
        raise SystemExit("%s has no SiteSettings" % label)
    con.execute(
        "UPDATE SiteSettings SET smsEnabled=1, smsSignName=?, smsTemplateCode=? WHERE id='default'",
        (sign, template),
    )
    con.commit()
    has_key = bool(row[4]) and bool(row[5])
    print("[%s] sign+template saved; accessKey %s; testMode %s" % (
        label,
        "set" if has_key else "MISSING",
        row[3],
    ))
    con.close()
    return has_key

acc_ready = patch(account_db, "account")
www_ready = patch(www_db, "www")
if not acc_ready:
    print("fill AccessKey at https://account.yydsxwh.com/studio/settings then turn off test mode")
PY

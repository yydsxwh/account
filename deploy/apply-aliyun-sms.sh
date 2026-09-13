#!/bin/bash
# Write approved Aliyun sign + per-scene templates onto both live SQLite files.
# If AccessKey is already present, turn off test mode so codes go to phones.
# Does not print secrets.
set -euo pipefail

ACCOUNT_DB="${ACCOUNT_DATABASE_PATH:-/var/www/account/data/prod.db}"
WWW_DB="${WWW_DATABASE_PATH:-/var/www/yyds-course-platform/prisma/prod.db}"
SIGN="${SMS_SIGN_NAME:-歪歪滴艾斯杭州科技}"
LOGIN_TEMPLATE="${SMS_TEMPLATE_CODE_LOGIN:-SMS_512395568}"
REGISTER_TEMPLATE="${SMS_TEMPLATE_CODE_REGISTER:-SMS_512395568}"
BIND_TEMPLATE="${SMS_TEMPLATE_CODE_BIND:-SMS_338610504}"

python3 - "$ACCOUNT_DB" "$WWW_DB" "$SIGN" "$LOGIN_TEMPLATE" "$REGISTER_TEMPLATE" "$BIND_TEMPLATE" << 'PY'
import sqlite3
import sys

account_db, www_db, sign, login_tpl, register_tpl, bind_tpl = sys.argv[1:7]
SCENE_COLS = [
    ("smsTemplateCodeLogin", "TEXT NOT NULL DEFAULT ''"),
    ("smsTemplateCodeRegister", "TEXT NOT NULL DEFAULT ''"),
    ("smsTemplateCodeBind", "TEXT NOT NULL DEFAULT ''"),
]

def ensure_cols(con):
    cols = [c[1] for c in con.execute("PRAGMA table_info(SiteSettings)")]
    for name, decl in SCENE_COLS:
        if name not in cols:
            con.execute("ALTER TABLE SiteSettings ADD COLUMN %s %s" % (name, decl))
            cols.append(name)
    return cols

def patch(path, label, write_scenes):
    con = sqlite3.connect(path)
    cols = ensure_cols(con)
    needed = [
        "smsSignName",
        "smsTemplateCode",
        "smsEnabled",
        "smsTestMode",
        "smsProvider",
        "smsAccessKeyId",
        "smsAccessKeySecret",
    ]
    for col in needed:
        if col not in cols:
            raise SystemExit("%s missing column %s" % (label, col))
    row = con.execute(
        "SELECT smsEnabled, smsTestMode, length(smsAccessKeyId), length(smsAccessKeySecret) "
        "FROM SiteSettings WHERE id='default'"
    ).fetchone()
    if not row:
        raise SystemExit("%s has no SiteSettings" % label)
    has_key = bool(row[2]) and bool(row[3])
    if write_scenes:
        con.execute(
            """
            UPDATE SiteSettings SET
              smsEnabled=1,
              smsSignName=?,
              smsTemplateCode=?,
              smsTemplateCodeLogin=?,
              smsTemplateCodeRegister=?,
              smsTemplateCodeBind=?
            WHERE id='default'
            """,
            (sign, login_tpl, login_tpl, register_tpl, bind_tpl),
        )
    else:
        con.execute(
            "UPDATE SiteSettings SET smsEnabled=1, smsSignName=?, smsTemplateCode=? WHERE id='default'",
            (sign, login_tpl),
        )
    if has_key:
        con.execute(
            "UPDATE SiteSettings SET smsTestMode=0, smsProvider='aliyun' WHERE id='default'"
        )
    con.commit()
    after = con.execute(
        "SELECT smsTestMode, smsProvider, smsTemplateCode, "
        + (
            "smsTemplateCodeLogin, smsTemplateCodeRegister, smsTemplateCodeBind"
            if write_scenes
            else "smsTemplateCode, smsTemplateCode, smsTemplateCode"
        )
        + " FROM SiteSettings WHERE id='default'"
    ).fetchone()
    print(
        "[%s] accessKey %s; testMode %s; provider %s; login=%s register=%s bind=%s"
        % (
            label,
            "set" if has_key else "MISSING",
            after[0],
            after[1],
            after[3],
            after[4],
            after[5],
        )
    )
    con.close()
    return has_key

acc_ready = patch(account_db, "account", True)
# www 旧代码仍读 smsTemplateCode；分场景列加上后，登录注册会用 SMS_512395568。
www_ready = patch(www_db, "www", True)
if not acc_ready:
    print("fill AccessKey at https://account.yydsxwh.com/studio/settings then turn off test mode")
PY

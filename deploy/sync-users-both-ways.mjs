#!/usr/bin/env node
/**
 * Copy User rows between the live www SQLite and the account-center SQLite.
 * Keeps the same id + passwordHash so existing passwords and course FKs still work.
 *
 * WWW_DATABASE_PATH / ACCOUNT_DATABASE_PATH can override the live paths.
 * --dry-run prints actions without writing.
 */
import { closeSync, openSync, unlinkSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";

const WWW_DB =
  process.env.WWW_DATABASE_PATH || "/var/www/yyds-course-platform/prisma/prod.db";
const ACC_DB =
  process.env.ACCOUNT_DATABASE_PATH || "/var/www/account/data/prod.db";
const LOCK_PATH =
  process.env.USER_SYNC_LOCK || "/var/www/account/data/user-sync.lock";
const DRY_RUN = process.argv.includes("--dry-run");

const ACCOUNT_COLS = [
  "id",
  "email",
  "passwordHash",
  "passwordSet",
  "name",
  "username",
  "kkNumber",
  "bio",
  "avatarUrl",
  "phone",
  "role",
  "roles",
  "requestedRole",
  "roleApplicationStatus",
  "roleApplicationNote",
  "roleReviewedAt",
  "roleReviewedById",
  "adminNote",
  "wechatOpenId",
  "wechatWebOpenId",
  "wechatMobileOpenId",
  "wechatUnionId",
  "referralCode",
  "referredById",
  "createdAt",
  "updatedAt",
];

export function timeMs(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value).trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function hasUsablePassword(user) {
  if (!user) return false;
  if (user.passwordSet === 0 || user.passwordSet === false) return false;
  return Boolean(user.passwordHash) && String(user.passwordHash).length > 20;
}

export function shouldCopyPassword(source, dest) {
  if (!source?.passwordHash) return false;
  if (!dest) return true;
  if (hasUsablePassword(source) && !hasUsablePassword(dest)) return true;
  if (!hasUsablePassword(source) && hasUsablePassword(dest)) return false;
  return timeMs(source.updatedAt) >= timeMs(dest.updatedAt);
}

export function shouldReplaceProfile(source, dest) {
  if (!dest) return true;
  return timeMs(source.updatedAt) >= timeMs(dest.updatedAt);
}

function detectTimeStyle(db) {
  const row = db.prepare("SELECT createdAt FROM User LIMIT 1").get();
  if (!row) return "ms";
  const value = row.createdAt;
  if (typeof value === "number") return "ms";
  if (/^\d+$/.test(String(value || "").trim())) return "ms";
  return "iso";
}

function formatTime(value, style) {
  const ms = timeMs(value) || Date.now();
  return style === "iso" ? new Date(ms).toISOString() : ms;
}

function open(path) {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("PRAGMA busy_timeout = 8000");
  return db;
}

function tableCols(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
}

function ensureKkColumn(db, label) {
  const cols = tableCols(db, "User");
  if (!cols.includes("kkNumber")) {
    if (!DRY_RUN) {
      db.exec("ALTER TABLE User ADD COLUMN kkNumber INTEGER");
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS User_kkNumber_key ON User(kkNumber)");
    }
    console.log(`[sync] added kkNumber column on ${label}`);
  }
}

function loadUsers(db) {
  const cols = tableCols(db, "User");
  const rows = db.prepare(`SELECT * FROM User`).all();
  return rows.map((row) => {
    const out = {};
    for (const col of ACCOUNT_COLS) {
      if (cols.includes(col)) out[col] = row[col];
      else if (col === "passwordSet") out[col] = 1;
      else if (col === "kkNumber") out[col] = null;
      else out[col] = col === "referredById" || col === "roleReviewedAt" || col === "roleReviewedById" || col === "username"
        ? null
        : "";
    }
    return out;
  });
}

export function emailKey(email) {
  return String(email || "").trim().toLowerCase();
}

/** 同一邮箱时保留目标库原有写法，避免把历史行的大小写改掉 */
export function pickEmail(sourceEmail, destEmail) {
  const source = String(sourceEmail || "").trim();
  const dest = String(destEmail || "").trim();
  if (dest && emailKey(dest) === emailKey(source)) return dest;
  return source;
}

function referralFallback(existing) {
  return existing && String(existing).trim()
    ? String(existing)
    : `YY${randomBytes(3).toString("hex").toUpperCase()}`;
}

function indexUsers(users) {
  const map = new Map();
  for (const user of users) {
    map.set(user.id, user);
    if (user.email) map.set(`email:${emailKey(user.email)}`, user);
    if (user.username) map.set(`username:${String(user.username).toLowerCase()}`, user);
    if (user.referralCode) map.set(`ref:${user.referralCode}`, user);
  }
  return map;
}

function usernameTaken(destUsers, username, selfId) {
  if (!username) return false;
  const other = destUsers.get(`username:${String(username).toLowerCase()}`);
  return Boolean(other && other.id !== selfId);
}

function referralTaken(destUsers, code, selfId) {
  if (!code) return false;
  const other = destUsers.get(`ref:${code}`);
  return Boolean(other && other.id !== selfId);
}

function mergeRow(source, dest, destUsers, timeStyle) {
  const replacing = shouldReplaceProfile(source, dest);
  const row = dest ? { ...dest } : { ...source };
  row.id = source.id;
  // 大小写只用来比对；微信/手机占位邮箱里嵌着 openid，原样保留
  row.email = pickEmail(source.email, dest?.email);
  row.createdAt = formatTime(dest?.createdAt || source.createdAt, timeStyle);
  row.updatedAt = formatTime(
    replacing || !dest ? source.updatedAt : dest.updatedAt,
    timeStyle,
  );

  if (!dest || replacing) {
    for (const col of ACCOUNT_COLS) {
      if (col === "id" || col === "email" || col === "passwordHash" || col === "passwordSet") continue;
      if (col === "createdAt" || col === "updatedAt" || col === "kkNumber") continue;
      row[col] = source[col];
    }
  }
  if (dest?.kkNumber != null && dest.kkNumber !== "") {
    row.kkNumber = dest.kkNumber;
  } else if (source.kkNumber != null && source.kkNumber !== "") {
    row.kkNumber = source.kkNumber;
  } else {
    row.kkNumber = null;
  }

  if (shouldCopyPassword(source, dest)) {
    row.passwordHash = source.passwordHash;
    row.passwordSet = source.passwordSet ?? 1;
  } else if (!dest) {
    row.passwordHash = source.passwordHash || "";
    row.passwordSet = source.passwordSet ?? 0;
  }

  let username = row.username ? String(row.username).trim() : null;
  if (usernameTaken(destUsers, username, source.id)) username = dest?.username || null;
  row.username = username || null;

  let referralCode = referralFallback(row.referralCode);
  if (referralTaken(destUsers, referralCode, source.id)) {
    referralCode = dest?.referralCode && !referralTaken(destUsers, dest.referralCode, source.id)
      ? dest.referralCode
      : referralFallback("");
  }
  row.referralCode = referralCode;

  if (row.referredById && !destUsers.has(row.referredById) && !dest) {
    row.referredById = null;
  }

  return row;
}

function remember(destUsers, row) {
  destUsers.set(row.id, row);
  if (row.email) destUsers.set(`email:${emailKey(row.email)}`, row);
  if (row.username) destUsers.set(`username:${String(row.username).toLowerCase()}`, row);
  if (row.referralCode) destUsers.set(`ref:${row.referralCode}`, row);
}

function upsertUser(db, source, destCols, destUsers, timeStyle) {
  const byId = destUsers.get(source.id);
  const email = emailKey(source.email);
  const byEmail = email ? destUsers.get(`email:${email}`) : null;
  if (byEmail && byEmail.id !== source.id) {
    return { action: "skip-email", email };
  }

  const row = mergeRow(source, byId || null, destUsers, timeStyle);
  if (!destCols.includes("referredById")) delete row.referredById;

  const cols = ACCOUNT_COLS.filter((col) => destCols.includes(col));
  if (DRY_RUN) {
    remember(destUsers, row);
    return { action: byId ? "update" : "insert", id: row.id, email };
  }

  const placeholders = cols.map(() => "?").join(", ");
  const assignments = cols
    .filter((col) => col !== "id")
    .map((col) => `${col}=excluded.${col}`)
    .join(", ");
  db.prepare(
    `INSERT INTO User (${cols.join(",")}) VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${assignments}`,
  ).run(...cols.map((col) => row[col] ?? null));

  remember(destUsers, row);
  return { action: byId ? "update" : "insert", id: row.id, email };
}

function copySettings(fromDb, toDb) {
  const fromCols = tableCols(fromDb, "SiteSettings");
  const toCols = tableCols(toDb, "SiteSettings");
  const src = fromDb.prepare("SELECT * FROM SiteSettings WHERE id='default'").get();
  if (!src) return [];
  const copied = [];
  // 不抄微信 AppID/Secret：公众号网页授权域名只授权了 www，
  // 账号中心域名没加进去之前，抄过来只会让微信按钮点了报错。
  const keys = [
    "smsEnabled",
    "smsProvider",
    "smsAccessKeyId",
    "smsAccessKeySecret",
    "smsSignName",
    "smsTemplateCode",
    "smsTestMode",
    "smsTestFixedCode",
  ];
  const dest = toDb.prepare("SELECT * FROM SiteSettings WHERE id='default'").get();
  if (!dest) return copied;
  for (const key of keys) {
    if (!fromCols.includes(key) || !toCols.includes(key)) continue;
    const value = src[key];
    if (value == null || value === "") continue;
    if (dest[key]) continue;
    if (!DRY_RUN) {
      toDb.prepare(`UPDATE SiteSettings SET ${key}=? WHERE id='default'`).run(value);
    }
    copied.push(key);
  }
  return copied;
}

function sync(fromLabel, fromDb, toLabel, toDb) {
  const destCols = tableCols(toDb, "User");
  const destUsers = indexUsers(loadUsers(toDb));
  const source = loadUsers(fromDb);
  const timeStyle = detectTimeStyle(toDb);
  const stats = { insert: 0, update: 0, skip: 0 };
  const inserted = [];
  if (!DRY_RUN) toDb.exec("BEGIN");
  try {
    for (const user of source) {
      const result = upsertUser(toDb, user, destCols, destUsers, timeStyle);
      if (result.action === "insert") {
        stats.insert += 1;
        inserted.push(result.email);
      } else if (result.action === "update") {
        stats.update += 1;
      } else {
        stats.skip += 1;
      }
    }
    if (!DRY_RUN) toDb.exec("COMMIT");
  } catch (error) {
    if (!DRY_RUN) toDb.exec("ROLLBACK");
    throw error;
  }
  const extra = inserted.length ? ` new=${inserted.join(",")}` : "";
  console.log(
    `[sync] ${fromLabel} -> ${toLabel}: +${stats.insert} ~${stats.update} skip ${stats.skip} (source ${source.length})${extra}`,
  );
  return stats;
}

function acquireLock() {
  if (DRY_RUN || process.env.USER_SYNC_LOCK === "off") return null;
  try {
    return openSync(LOCK_PATH, "wx");
  } catch {
    console.log("[sync] another run holds the lock, skip");
    process.exit(0);
  }
}

function selfTest() {
  const older = { updatedAt: 100, passwordHash: "x".repeat(30), passwordSet: 1 };
  const newer = { updatedAt: 200, passwordHash: "y".repeat(30), passwordSet: 1 };
  const stub = { updatedAt: Date.now(), passwordHash: "z".repeat(30), passwordSet: 0 };
  if (shouldCopyPassword(older, stub) !== true) throw new Error("copy hash onto stub");
  if (shouldCopyPassword(stub, older) !== false) throw new Error("do not clobber real hash");
  if (shouldReplaceProfile(newer, older) !== true) throw new Error("newer profile");
  if (shouldReplaceProfile(older, newer) !== false) throw new Error("keep newer dest");
  if (timeMs("1785968282179") !== 1785968282179) throw new Error("ms string");
  console.log("[sync] self-test ok");
}

if (process.argv.includes("--self-test")) {
  selfTest();
  process.exit(0);
}

const lockFd = acquireLock();
const www = open(WWW_DB);
const acc = open(ACC_DB);
try {
  ensureKkColumn(www, "www");
  ensureKkColumn(acc, "account");
  sync("www", www, "account", acc);
  sync("account", acc, "www", www);
  const copied = copySettings(www, acc);
  if (copied.length) {
    console.log(`[sync] copied empty account settings: ${copied.join(",")}`);
  }
  console.log(
    `[sync] www users=${www.prepare("SELECT count(*) AS n FROM User").get().n} account users=${acc.prepare("SELECT count(*) AS n FROM User").get().n}${DRY_RUN ? " (dry-run)" : ""}`,
  );
} finally {
  www.close();
  acc.close();
  if (lockFd != null) {
    closeSync(lockFd);
    try {
      unlinkSync(LOCK_PATH);
    } catch {
      /* ignore */
    }
  }
}

#!/usr/bin/env node
/**
 * 跑仓库里所有 *.test.ts。
 *
 * 每个测试文件是一个独立进程：一个挂掉不会带崩别的，
 * 也让需要自己设 DATABASE_URL 的集成测试互不干扰。
 */

import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEARCH_DIRS = ["packages/shared/src", "tests"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "data"]);

function collect(dir, found = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, found);
    // .mts 用于需要顶层 await 的集成测试（tsx 按 ESM 处理）
    else if (entry.endsWith(".test.ts") || entry.endsWith(".test.mts")) {
      found.push(full);
    }
  }
  return found;
}

const files = SEARCH_DIRS.flatMap((dir) => collect(path.join(root, dir))).sort();
if (files.length === 0) {
  console.error("no test files found");
  process.exit(1);
}

const only = process.argv[2];
const selected = only ? files.filter((f) => f.includes(only)) : files;

let failed = 0;
for (const file of selected) {
  const rel = path.relative(root, file);
  const result = spawnSync("npx", ["tsx", file], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    failed += 1;
    console.error(`FAIL ${rel}`);
  }
}

console.log(
  failed === 0
    ? `\nall ${selected.length} test file(s) passed`
    : `\n${failed} of ${selected.length} test file(s) failed`,
);
process.exit(failed === 0 ? 0 : 1);

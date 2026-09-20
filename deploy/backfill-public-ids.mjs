#!/usr/bin/env node
/**
 * 给存量用户补 publicId（usr_xxx）。
 *
 * 代码里 ensureUserPublicId 会在首次用到时懒补齐，所以这个脚本不是必须的，
 * 跑一次只是让后台和导出立刻就能看到完整数据。
 *
 *   npx prisma db push                       # 先加上字段
 *   node deploy/backfill-public-ids.mjs
 *   DRY_RUN=1 node deploy/backfill-public-ids.mjs   # 只看不写
 *
 * 用 Prisma 而不是 better-sqlite3：账号中心目录里一定有 Prisma Client。
 */

import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const DRY_RUN = process.env.DRY_RUN === "1";
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function generatePublicId() {
  const bytes = randomBytes(26);
  let body = "";
  for (let i = 0; i < 26; i += 1) body += ALPHABET[bytes[i] % ALPHABET.length];
  return `usr_${body}`;
}

const prisma = new PrismaClient();

try {
  const pending = await prisma.user.findMany({
    where: { OR: [{ publicId: null }, { publicId: "" }] },
    select: { id: true, email: true },
  });

  if (pending.length === 0) {
    console.log("[publicId] nothing to backfill");
  } else {
    let done = 0;
    for (const user of pending) {
      if (DRY_RUN) {
        done += 1;
        continue;
      }
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { publicId: generatePublicId() },
          });
          done += 1;
          break;
        } catch (error) {
          if (attempt === 4) {
            console.error(`[publicId] failed for ${user.email}`, error);
          }
        }
      }
    }
    console.log(
      `[publicId] ${DRY_RUN ? "would assign" : "assigned"} ${done} id(s)`,
    );
  }
} finally {
  await prisma.$disconnect();
}

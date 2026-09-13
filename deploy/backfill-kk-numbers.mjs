#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const KK_START = 100;
const FOUNDER_EMAIL = "yydsxwh@gmail.com";

async function ensureSequence() {
  await prisma.kkSequence.upsert({
    where: { id: "default" },
    create: { id: "default", next: KK_START },
    update: {},
  });
}

async function allocate() {
  await ensureSequence();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const seq = await prisma.kkSequence.update({
      where: { id: "default" },
      data: { next: { increment: 1 } },
    });
    const value = seq.next - 1;
    const taken = await prisma.user.findUnique({
      where: { kkNumber: value },
      select: { id: true },
    });
    if (!taken) return value;
  }
  throw new Error("分配 kk 号失败");
}

async function main() {
  await ensureSequence();
  const missing = await prisma.user.findMany({
    where: { kkNumber: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });
  const founder = missing.find(
    (user) => String(user.email).trim().toLowerCase() === FOUNDER_EMAIL,
  );
  const ordered = founder
    ? [founder, ...missing.filter((user) => user.id !== founder.id)]
    : missing;
  let assigned = 0;
  for (const user of ordered) {
    const kkNumber = await allocate();
    await prisma.user.update({
      where: { id: user.id },
      data: { kkNumber },
    });
    assigned += 1;
    console.log(`[kk] ${user.email} -> ${kkNumber}`);
  }
  const max = await prisma.user.aggregate({ _max: { kkNumber: true } });
  const next = (max._max.kkNumber || KK_START - 1) + 1;
  await prisma.kkSequence.upsert({
    where: { id: "default" },
    create: { id: "default", next },
    update: { next },
  });
  const total = await prisma.user.count();
  console.log(`[kk] assigned ${assigned}, users ${total}, next ${next}`);
}

main()
  .catch((error) => {
    console.error("[kk]", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

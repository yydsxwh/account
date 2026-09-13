import { prisma } from "./db";
import { FOUNDER_EMAIL, KK_START, nextKkNumber } from "./kk-number";

async function ensureSequence() {
  await prisma.kkSequence.upsert({
    where: { id: "default" },
    create: { id: "default", next: KK_START },
    update: {},
  });
}

/** 发出一个未占用的 kk 号。并发时靠唯一约束重试。 */
export async function allocateKkNumber(): Promise<number> {
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
  throw new Error("分配 kk 号失败，请重试");
}

async function syncSequenceToMax() {
  const max = await prisma.user.aggregate({ _max: { kkNumber: true } });
  const next = nextKkNumber(max._max.kkNumber);
  await prisma.kkSequence.upsert({
    where: { id: "default" },
    create: { id: "default", next },
    update: { next },
  });
}

/**
 * 给还没有 kk 号的用户补号。
 * 站长邮箱优先拿 100；其余按注册时间从早到晚接着排。
 */
export async function backfillMissingKkNumbers() {
  await ensureSequence();
  const missing = await prisma.user.findMany({
    where: { kkNumber: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });
  if (missing.length === 0) {
    await syncSequenceToMax();
    return { assigned: 0 };
  }

  const founder = missing.find(
    (user) => user.email.trim().toLowerCase() === FOUNDER_EMAIL,
  );
  const ordered = founder
    ? [founder, ...missing.filter((user) => user.id !== founder.id)]
    : missing;

  let assigned = 0;
  for (const user of ordered) {
    const kkNumber = await allocateKkNumber();
    await prisma.user.update({
      where: { id: user.id },
      data: { kkNumber },
    });
    assigned += 1;
  }
  await syncSequenceToMax();
  return { assigned };
}

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function referralCode() {
  return `YY${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function main() {
  const existing = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  if (existing) {
    console.log("[bootstrap] admin already exists");
    return;
  }

  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@yyds.local")
    .trim()
    .toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "123456";
  const name = process.env.BOOTSTRAP_ADMIN_NAME || "站长";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      passwordSet: true,
      role: "ADMIN",
      roles: "ADMIN",
      bio: "账号中心站长",
      referralCode: referralCode(),
    },
  });

  await prisma.siteSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "",
      smsEnabled: true,
      smsProvider: "test",
      smsTestMode: true,
      smsTestFixedCode: "123456",
    },
    update: {},
  });

  console.log(`[bootstrap] created admin ${email}`);
}

main()
  .catch((error) => {
    console.error("[bootstrap]", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

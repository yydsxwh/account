import { hashPassword, makeReferralCode } from "../packages/shared/src/password";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.smsCode.deleteMany();
  await prisma.user.deleteMany();
  await prisma.siteSettings.deleteMany();

  const passwordHash = await hashPassword("123456");

  const admin = await prisma.user.create({
    data: {
      email: "admin@yyds.local",
      name: "站长",
      passwordHash,
      passwordSet: true,
      role: "ADMIN",
      roles: "ADMIN",
      bio: "账号中心站长",
      referralCode: makeReferralCode(),
    },
  });

  const teacher = await prisma.user.create({
    data: {
      email: "teacher@yyds.local",
      name: "林知夏",
      passwordHash,
      passwordSet: true,
      role: "TEACHER",
      roles: "TEACHER",
      bio: "老师演示账号",
      referralCode: makeReferralCode(),
    },
  });

  await prisma.user.create({
    data: {
      email: "agent@yyds.local",
      name: "加盟代理演示",
      passwordHash,
      passwordSet: true,
      role: "AGENT",
      roles: "AGENT",
      bio: "演示加盟代理账号",
      referralCode: makeReferralCode(),
    },
  });

  await prisma.user.create({
    data: {
      email: "student@yyds.local",
      name: "学员小陈",
      passwordHash,
      passwordSet: true,
      role: "STUDENT",
      roles: "STUDENT",
      bio: "热爱学习的新同学",
      referralCode: makeReferralCode(),
      referredById: teacher.id,
    },
  });

  await prisma.user.create({
    data: {
      email: "merchant@yyds.local",
      name: "待审商家",
      passwordHash,
      passwordSet: true,
      role: "STUDENT",
      roles: "STUDENT",
      requestedRole: "MERCHANT",
      roleApplicationStatus: "PENDING",
      bio: "商家入驻待审核演示",
      referralCode: makeReferralCode(),
    },
  });

  await prisma.user.create({
    data: {
      email: "acc_demo_user@account.local",
      username: "demo_user",
      name: "账号登录演示",
      passwordHash,
      passwordSet: true,
      role: "STUDENT",
      roles: "STUDENT",
      bio: "用登录名 demo_user + 密码 123456 登录",
      referralCode: makeReferralCode(),
      referredById: admin.id,
    },
  });

  await prisma.siteSettings.create({
    data: {
      id: "default",
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      smsEnabled: true,
      smsProvider: "test",
      smsTestMode: true,
      smsTestFixedCode: "123456",
    },
  });

  console.log("Seeded demo accounts. Password for all: 123456");
  console.log("  admin@yyds.local / teacher@yyds.local / agent@yyds.local");
  console.log("  student@yyds.local / merchant@yyds.local");
  console.log("  username demo_user / 123456");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

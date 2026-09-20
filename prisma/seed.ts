import { hashPassword, makeReferralCode } from "../packages/shared/src/password";
import { hashClientSecret, serializeUriList } from "../packages/shared/src/oauth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.oAuthAccessToken.deleteMany();
  await prisma.oAuthCode.deleteMany();
  await prisma.oAuthClient.deleteMany();
  await prisma.smsCode.deleteMany();
  await prisma.user.deleteMany();
  await prisma.kkSequence.deleteMany();
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
      kkNumber: 100,
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
      kkNumber: 101,
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
      kkNumber: 102,
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
      kkNumber: 103,
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
      kkNumber: 104,
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
      kkNumber: 105,
      referralCode: makeReferralCode(),
      referredById: admin.id,
    },
  });

  await prisma.kkSequence.create({
    data: { id: "default", next: 106 },
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

  const docsSecret = process.env.DEMO_DOCS_CLIENT_SECRET || "demo-docs-secret";
  const shopSecret = process.env.DEMO_SHOP_CLIENT_SECRET || "demo-shop-secret";
  const rishiSecret = process.env.DEMO_RISHI_CLIENT_SECRET || "demo-rishi-secret";
  await prisma.oAuthClient.create({
    data: {
      clientId: "docs",
      clientSecret: await hashClientSecret(docsSecret),
      name: "文档",
      homepageUrl: "/demo/docs",
      redirectUris: serializeUriList([
        "/demo/docs/callback",
        "http://localhost:3000/demo/docs/callback",
        "http://127.0.0.1:3000/demo/docs/callback",
      ]),
    },
  });
  await prisma.oAuthClient.create({
    data: {
      clientId: "shop",
      clientSecret: await hashClientSecret(shopSecret),
      name: "商城",
      homepageUrl: "/demo/shop",
      redirectUris: serializeUriList([
        "/demo/shop/callback",
        "http://localhost:3000/demo/shop/callback",
        "http://127.0.0.1:3000/demo/shop/callback",
      ]),
    },
  });
  await prisma.oAuthClient.create({
    data: {
      clientId: "rishi",
      clientSecret: await hashClientSecret(rishiSecret),
      clientType: "confidential",
      name: "颗秒日事",
      homepageUrl: "https://www.yydsxwh.com/products/days/",
      allowedScopes: "openid profile email offline_access",
      requirePkce: true,
      redirectUris: serializeUriList([
        "https://www.yydsxwh.com/api/days/auth/callback",
        "http://localhost:5173/api/days/auth/callback",
        "http://127.0.0.1:5173/api/days/auth/callback",
        "http://localhost:3120/api/days/auth/callback",
        "http://127.0.0.1:3120/api/days/auth/callback",
      ]),
    },
  });

  console.log("Seeded demo accounts. Password for all: 123456");
  console.log("  admin@yyds.local / teacher@yyds.local / agent@yyds.local");
  console.log("  student@yyds.local / merchant@yyds.local");
  console.log("  username demo_user / 123456  (kk号 100–105)");
  console.log("Demo products: docs / shop  (open /demo/docs and /demo/shop)");
  console.log("Rishi OIDC client: rishi  (local secret demo-rishi-secret unless DEMO_RISHI_CLIENT_SECRET is set)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

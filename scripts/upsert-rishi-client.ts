/**
 * 在已有账号中心库里登记 / 更新日事 OIDC 客户端，不清库。
 *
 * 生产用法（在 account 机器上、带 DATABASE_URL）：
 *   RISHI_CLIENT_SECRET='…只显示一次的密钥…' \
 *   npx tsx scripts/upsert-rishi-client.ts
 *
 * 密钥从环境变量读，不要写进仓库。
 */
import { PrismaClient } from "@prisma/client";
import { hashClientSecret, serializeUriList } from "../packages/shared/src/oauth";

const prisma = new PrismaClient();

const REDIRECT_URIS = [
  "https://www.yydsxwh.com/api/days/auth/callback",
  "http://localhost:5173/api/days/auth/callback",
  "http://127.0.0.1:5173/api/days/auth/callback",
  "http://localhost:3120/api/days/auth/callback",
  "http://127.0.0.1:3120/api/days/auth/callback",
];

async function main() {
  const secret = process.env.RISHI_CLIENT_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "BLOCKED: 缺少 RISHI_CLIENT_SECRET。在账号中心后台或本脚本环境变量里配置，不要写进 Git。",
    );
  }

  const data = {
    clientId: "rishi",
    clientSecret: await hashClientSecret(secret),
    clientType: "confidential",
    name: "颗秒日事",
    homepageUrl: "https://www.yydsxwh.com/products/days/",
    allowedScopes: "openid profile email offline_access",
    grantTypes: "authorization_code refresh_token",
    requirePkce: true,
    enabled: true,
    redirectUris: serializeUriList(REDIRECT_URIS),
  };

  const existing = await prisma.oAuthClient.findUnique({ where: { clientId: "rishi" } });
  if (existing) {
    await prisma.oAuthClient.update({ where: { clientId: "rishi" }, data });
    console.log("Updated OAuth client rishi");
  } else {
    await prisma.oAuthClient.create({ data });
    console.log("Created OAuth client rishi");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

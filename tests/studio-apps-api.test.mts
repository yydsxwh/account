/**
 * Studio apps：创建 / 列表 / 轮换的密钥边界。
 * 库里只存哈希；明文只出现在本次 create / rotate 响应。
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { oneTimeClientSecret } from "../src/helpers/one-time-client-secret";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const workdir = mkdtempSync(path.join(tmpdir(), "account-studio-"));
const dbPath = path.join(workdir, "test.db");
process.env.DATABASE_URL = `file:${dbPath}`;

const repoRoot = path.resolve(import.meta.dirname, "..");
execFileSync(
  "npx",
  ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"],
  {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
    stdio: "pipe",
  },
);

const { prisma } = await import("@andyyyds/shared/db");
const { verifyPassword } = await import("@andyyyds/shared/password");
const {
  generateClientSecret,
  hashClientSecret,
} = await import("@andyyyds/shared/oidc/clients");
const { parseUriList, serializeUriList } = await import(
  "@andyyyds/shared/oidc/redirect-uri"
);

function serializeApp(row: {
  id: string;
  clientId: string;
  clientType: string;
  name: string;
  description: string;
  homepageUrl: string;
  redirectUris: string;
  allowedScopes: string;
  grantTypes: string;
  requirePkce: boolean;
  enabled: boolean;
  createdAt: Date;
  clientSecret: string;
}) {
  return {
    id: row.id,
    clientId: row.clientId,
    clientType: row.clientType,
    name: row.name,
    description: row.description,
    homepageUrl: row.homepageUrl,
    redirectUris: parseUriList(row.redirectUris),
    allowedScopes: row.allowedScopes.split(" ").filter(Boolean),
    grantTypes: row.grantTypes.split(" ").filter(Boolean),
    requirePkce: row.requirePkce,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
  };
}

try {
  const confidentialPlain = generateClientSecret();
  const confidential = await prisma.oAuthClient.create({
    data: {
      clientId: "rishi",
      clientSecret: await hashClientSecret(confidentialPlain),
      clientType: "confidential",
      name: "颗秒日事",
      homepageUrl: "https://www.yydsxwh.com/products/days/",
      redirectUris: serializeUriList([
        "https://www.yydsxwh.com/api/days/auth/callback",
      ]),
      allowedScopes: "openid profile email",
      grantTypes: "authorization_code refresh_token",
      requirePkce: true,
    },
  });

  const publicPlain = generateClientSecret();
  await prisma.oAuthClient.create({
    data: {
      clientId: "rishi-web",
      clientSecret: await hashClientSecret(publicPlain),
      clientType: "public",
      name: "日事网页",
      homepageUrl: "",
      redirectUris: serializeUriList(["http://localhost:5173/callback"]),
      allowedScopes: "openid profile",
      grantTypes: "authorization_code",
      requirePkce: true,
    },
  });

  const createConfidential = {
    app: serializeApp(confidential),
    clientSecret: oneTimeClientSecret("confidential", confidentialPlain),
  };
  assert(
    createConfidential.clientSecret === confidentialPlain,
    "confidential 创建必须返回 clientSecret",
  );
  assert(
    createConfidential.clientSecret?.startsWith("ys_"),
    "返回的密钥应是 ys_ 明文",
  );
  assert(
    !("clientSecret" in createConfidential.app),
    "app 对象不得带明文",
  );

  const createPublic = {
    clientSecret: oneTimeClientSecret("public", publicPlain),
  };
  assert(
    createPublic.clientSecret === undefined,
    "public 创建不得返回 clientSecret",
  );

  const listed = (await prisma.oAuthClient.findMany()).map(serializeApp);
  const listedJson = JSON.stringify(listed);
  assert(!listedJson.includes("clientSecret"), "GET 列表不得有 clientSecret 字段");
  assert(!listedJson.includes(confidentialPlain), "GET 列表不得泄露 confidential 明文");
  assert(!listedJson.includes(publicPlain), "GET 列表不得泄露 public 占位明文");
  assert(
    listed.every((app) => app.clientId === "rishi" || app.clientId === "rishi-web"),
    "列表仍返回产品",
  );

  assert(
    confidential.clientSecret !== confidentialPlain,
    "数据库必须存哈希而不是明文",
  );
  assert(
    await verifyPassword(confidentialPlain, confidential.clientSecret),
    "旧明文应能通过创建时的哈希",
  );

  const rotatedPlain = generateClientSecret();
  const rotated = await prisma.oAuthClient.update({
    where: { id: confidential.id },
    data: { clientSecret: await hashClientSecret(rotatedPlain) },
  });
  const rotateResponse = {
    clientSecret: oneTimeClientSecret(rotated.clientType, rotatedPlain),
  };
  assert(rotateResponse.clientSecret === rotatedPlain, "轮换必须返回新明文");
  assert(rotateResponse.clientSecret !== confidentialPlain, "新密钥不能等于旧密钥");
  assert(
    !(await verifyPassword(confidentialPlain, rotated.clientSecret)),
    "轮换后旧密钥立刻失效",
  );
  assert(
    await verifyPassword(rotatedPlain, rotated.clientSecret),
    "新密钥应能通过新哈希",
  );

  const listedAgain = JSON.stringify(
    (await prisma.oAuthClient.findMany()).map(serializeApp),
  );
  assert(!listedAgain.includes(rotatedPlain), "轮换后 GET 仍不得泄露新明文");

  console.log("studio-apps-api: create / GET / rotate secret boundaries ok");
} finally {
  await prisma.$disconnect();
  rmSync(workdir, { recursive: true, force: true });
}

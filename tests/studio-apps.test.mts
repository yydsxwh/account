/**
 * 软件产品管理：更新字段、拒绝改 client_id、启停用对 authorize 的影响。
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

async function expectZodFailure(
  run: () => void,
  match: string,
  message: string,
) {
  try {
    run();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const text = error.issues.map((i) => i.message).join("; ");
      assert(text.includes(match), `${message}（实际：${text}）`);
      return;
    }
    throw error;
  }
  throw new Error(`${message}：本该失败却成功了`);
}

const workdir = mkdtempSync(path.join(tmpdir(), "account-studio-apps-"));
const dbPath = path.join(workdir, "test.db");
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.OIDC_ISSUER = "https://account.test";

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
const { hashPassword } = await import("@andyyyds/shared/password");
const { createPkcePair } = await import("@andyyyds/shared/oidc/pkce");
const {
  isAllowedRedirectUri,
  serializeUriList,
  parseUriList,
} = await import("@andyyyds/shared/oidc/redirect-uri");
const { validateAuthorizationRequest } = await import(
  "@andyyyds/shared/oidc/server"
);
const {
  assertNoIdentityMutation,
  buildStudioAppPrismaData,
  checkRedirectUris,
  publicStudioAppFields,
  studioAppPatchFieldsSchema,
  validateHomepageUrl,
} = await import("../src/helpers/studio-app-update");

const REDIRECT_A = "https://www.yydsxwh.com/api/auth/callback/days";
const REDIRECT_B = "http://localhost:3100/api/auth/callback/days";
const REDIRECT_C = "https://www.yydsxwh.com/products/days/auth/callback";

try {
  // ---- 纯校验：client_id / secret 不可改 ----
  expectZodFailure(
    () => assertNoIdentityMutation({ id: "x", clientId: "hacked" }),
    "client_id 不可修改",
    "拒绝 clientId",
  );
  expectZodFailure(
    () => assertNoIdentityMutation({ id: "x", client_id: "hacked" }),
    "client_id 不可修改",
    "拒绝 client_id",
  );
  expectZodFailure(
    () => assertNoIdentityMutation({ id: "x", clientSecret: "leak" }),
    "不能通过此接口修改 client_secret",
    "拒绝 clientSecret",
  );
  assertNoIdentityMutation({ id: "x", name: "日事" });

  // ---- homepage / redirect 校验 ----
  assert(validateHomepageUrl("").ok, "空首页合法");
  assert(
    validateHomepageUrl("https://www.yydsxwh.com/products/days/日事").ok,
    "合法首页",
  );
  assert(!validateHomepageUrl("not-a-url").ok, "非法首页");
  assert(!validateHomepageUrl("https://x.com/*").ok, "首页不能带 *");
  assert(!validateHomepageUrl("ftp://x.com").ok, "首页协议");

  expectZodFailure(
    () => checkRedirectUris(["https://evil.com/callback.evil*"]),
    "通配符",
    "拒绝通配 redirect",
  );
  expectZodFailure(
    () => checkRedirectUris(["http://example.com/callback"]),
    "https",
    "线上 http 回调拒绝",
  );
  const cleaned = checkRedirectUris([REDIRECT_A, REDIRECT_B]);
  assert(cleaned.includes(REDIRECT_A) && cleaned.includes(REDIRECT_B), "合法回调通过");

  // ---- 字段整理：未传字段不写入 ----
  const onlyName = buildStudioAppPrismaData(
    studioAppPatchFieldsSchema.parse({ id: "1", name: "日事改名" }),
  );
  assert(onlyName.name === "日事改名", "可改名称");
  assert(onlyName.homepageUrl === undefined, "未改首页不写入");
  assert(onlyName.redirectUris === undefined, "未改回调不写入");
  assert(onlyName.enabled === undefined, "未改启用不写入");

  const withHome = buildStudioAppPrismaData(
    studioAppPatchFieldsSchema.parse({
      id: "1",
      homepageUrl: "https://www.yydsxwh.com/products/days",
    }),
  );
  assert(
    withHome.homepageUrl === "https://www.yydsxwh.com/products/days",
    "可改首页",
  );

  expectZodFailure(
    () =>
      buildStudioAppPrismaData(
        studioAppPatchFieldsSchema.parse({ id: "1", homepageUrl: "bad" }),
      ),
    "产品首页",
    "非法首页写入拒绝",
  );

  const withUris = buildStudioAppPrismaData(
    studioAppPatchFieldsSchema.parse({
      id: "1",
      redirectUris: [REDIRECT_A, REDIRECT_C],
    }),
  );
  assert(typeof withUris.redirectUris === "string", "回调序列化");
  const parsed = parseUriList(withUris.redirectUris!);
  assert(parsed.includes(REDIRECT_A) && parsed.includes(REDIRECT_C), "可增回调");
  assert(!parsed.includes(REDIRECT_B), "可删旧回调（不在新列表里）");

  // ---- 管理响应不含 secret ----
  const leaked = publicStudioAppFields({
    id: "1",
    clientId: "rishi",
    clientSecret: "should-not-appear",
    client_secret: "also-hidden",
    name: "日事",
  });
  assert(!("clientSecret" in leaked), "无 clientSecret");
  assert(!("client_secret" in leaked), "无 client_secret");
  assert(leaked.clientId === "rishi", "仍有 clientId 展示");

  // ---- 数据库：更新持久化 + authorize 启停 ----
  await prisma.oAuthClient.create({
    data: {
      clientId: "rishi",
      clientSecret: await hashPassword("secret-value"),
      clientType: "confidential",
      name: "日事",
      homepageUrl: "https://www.yydsxwh.com/products/days",
      redirectUris: serializeUriList([REDIRECT_A, REDIRECT_B]),
      allowedScopes: "openid profile email",
      grantTypes: "authorization_code refresh_token",
      requirePkce: true,
      enabled: true,
    },
  });

  const row = await prisma.oAuthClient.findUniqueOrThrow({
    where: { clientId: "rishi" },
  });
  const originalClientId = row.clientId;
  const originalSecret = row.clientSecret;

  const patch = buildStudioAppPrismaData(
    studioAppPatchFieldsSchema.parse({
      id: row.id,
      name: "日事（正式）",
      homepageUrl: "https://www.yydsxwh.com/products/days/日事",
      redirectUris: [REDIRECT_A, REDIRECT_C],
    }),
  );
  const updated = await prisma.oAuthClient.update({
    where: { id: row.id },
    data: patch,
  });
  assert(updated.name === "日事（正式）", "名称已持久化");
  assert(
    updated.homepageUrl === "https://www.yydsxwh.com/products/days/日事",
    "首页已持久化",
  );
  assert(updated.clientId === originalClientId, "client_id 未变");
  assert(updated.clientSecret === originalSecret, "client_secret 未变");
  const uris = parseUriList(updated.redirectUris);
  assert(uris.includes(REDIRECT_A), "保留未删回调");
  assert(uris.includes(REDIRECT_C), "新增回调");
  assert(!uris.includes(REDIRECT_B), "已删回调不在库中");
  assert(isAllowedRedirectUri(updated, REDIRECT_A), "新列表 A 可匹配");
  assert(isAllowedRedirectUri(updated, REDIRECT_C), "新列表 C 可匹配");
  assert(!isAllowedRedirectUri(updated, REDIRECT_B), "已删 B 不可匹配");
  assert(
    !isAllowedRedirectUri(updated, "https://example.com/callback.evil"),
    "未登记拒绝",
  );

  // 只改 enabled 时其它字段保持
  const beforeToggle = await prisma.oAuthClient.findUniqueOrThrow({
    where: { id: row.id },
  });
  await prisma.oAuthClient.update({
    where: { id: row.id },
    data: buildStudioAppPrismaData(
      studioAppPatchFieldsSchema.parse({ id: row.id, enabled: false }),
    ),
  });
  const disabled = await prisma.oAuthClient.findUniqueOrThrow({
    where: { id: row.id },
  });
  assert(disabled.enabled === false, "停用已持久化");
  assert(disabled.name === beforeToggle.name, "停用不清空名称");
  assert(disabled.homepageUrl === beforeToggle.homepageUrl, "停用不清空首页");
  assert(disabled.redirectUris === beforeToggle.redirectUris, "停用不清空回调");
  assert(disabled.clientId === "rishi", "停用不改 client_id");

  const pkce = createPkcePair();
  const authQuery = {
    clientId: "rishi",
    redirectUri: REDIRECT_A,
    responseType: "code",
    scope: "openid profile email",
    state: "st",
    nonce: "n1",
    codeChallenge: pkce.challenge,
    codeChallengeMethod: "S256",
    accountOrigin: "https://account.test",
  };

  try {
    await validateAuthorizationRequest(authQuery);
    throw new Error("停用后 authorize 本该失败");
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    assert(
      text.includes("未登记") ||
        text.includes("停用") ||
        (error as { code?: string }).code === "invalid_client",
      `停用后 authorize 拒绝（实际：${text}）`,
    );
  }

  await prisma.oAuthClient.update({
    where: { id: row.id },
    data: buildStudioAppPrismaData(
      studioAppPatchFieldsSchema.parse({ id: row.id, enabled: true }),
    ),
  });
  const reenabled = await validateAuthorizationRequest(authQuery);
  assert(reenabled.client.clientId === "rishi", "重新启用后可 authorize");

  // Zod 会剥掉未知 clientId；必须靠 assertNoIdentityMutation 拦截
  const parsedBody = studioAppPatchFieldsSchema.safeParse({
    id: row.id,
    clientId: "other",
    name: "x",
  });
  assert(parsedBody.success, "zod 会剥掉未知 clientId，需前置检查");
  expectZodFailure(
    () =>
      assertNoIdentityMutation({
        id: row.id,
        clientId: "other",
        name: "x",
      }),
    "client_id 不可修改",
    "即使混在合法字段里也不能改 client_id",
  );

  // 非管理员门禁：与 route 使用同一 studioErrorResponse 映射
  const { studioErrorResponse } = await import("@andyyyds/shared/studio");
  const denied = studioErrorResponse(new Error("ADMIN_ONLY"));
  assert(denied.status === 403, "非管理员 403");
  assert(denied.error.includes("站长"), "非管理员错误文案");
  const unauth = studioErrorResponse(new Error("UNAUTHORIZED"));
  assert(unauth.status === 401, "未登录 401");

  console.log("studio-apps tests passed");
} finally {
  await prisma.$disconnect().catch(() => undefined);
  rmSync(workdir, { recursive: true, force: true });
}

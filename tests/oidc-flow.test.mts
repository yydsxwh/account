/**
 * OIDC 端到端：授权码 + PKCE + refresh 轮换 + 令牌校验。
 *
 * 用一个临时 SQLite 库跑真实的 Prisma 查询，不 mock。
 * 重点覆盖失败路径：授权码重复使用、过期、redirect_uri 不符、
 * code_verifier 不对、refresh 重放、错误 aud / iss。
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

async function expectFailure(
  run: () => Promise<unknown>,
  match: string,
  message: string,
) {
  try {
    await run();
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    assert(
      text.includes(match) || (error as { code?: string })?.code === match,
      `${message}（实际报错：${text}）`,
    );
    return;
  }
  throw new Error(`${message}：本该失败却成功了`);
}

const workdir = mkdtempSync(path.join(tmpdir(), "account-oidc-"));
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
const { serializeUriList } = await import("@andyyyds/shared/oidc/redirect-uri");
const { hashToken, signIdToken, verifyIdToken } = await import(
  "@andyyyds/shared/oidc/tokens"
);
const { buildUserClaims } = await import("@andyyyds/shared/oidc/claims");
const { ensureUserPublicId, getClaimsUserById } = await import(
  "@andyyyds/shared/identity/users"
);
const {
  exchangeAuthorizationCode,
  issueAuthorizationCode,
  refreshTokens,
  resolveAccessToken,
  revokeToken,
  validateAuthorizationRequest,
} = await import("@andyyyds/shared/oidc/server");

const ISSUER = "https://account.test";
const REDIRECT = "https://rishi.test/api/auth/callback";
const CONFIDENTIAL_SECRET = "ys_confidential_secret_value";

try {
  const user = await prisma.user.create({
    data: {
      email: "oidc-tester@example.com",
      name: "测试用户",
      passwordHash: await hashPassword("password123"),
      phone: "13800138000",
      referralCode: "YYTEST1",
      role: "STUDENT",
      roles: "STUDENT",
    },
  });
  const sub = await ensureUserPublicId(user.id);
  assert(sub.startsWith("usr_"), "publicId 是 usr_ 前缀");
  assert(
    (await ensureUserPublicId(user.id)) === sub,
    "publicId 一旦分配就不再变",
  );

  await prisma.oAuthClient.create({
    data: {
      clientId: "rishi",
      clientSecret: await hashPassword(CONFIDENTIAL_SECRET),
      clientType: "confidential",
      name: "日事",
      redirectUris: serializeUriList([REDIRECT]),
      allowedScopes: "openid profile email offline_access",
      grantTypes: "authorization_code refresh_token",
      requirePkce: true,
    },
  });
  await prisma.oAuthClient.create({
    data: {
      clientId: "rishi-web",
      clientSecret: await hashPassword("unused"),
      clientType: "public",
      name: "日事网页版",
      redirectUris: serializeUriList([REDIRECT]),
      allowedScopes: "openid profile",
      grantTypes: "authorization_code",
    },
  });

  // ---- 授权请求校验 ----
  const pkce = createPkcePair();
  const baseQuery = {
    clientId: "rishi",
    redirectUri: REDIRECT,
    responseType: "code",
    scope: "openid profile email offline_access",
    state: "st-1",
    nonce: "nonce-1",
    codeChallenge: pkce.challenge,
    codeChallengeMethod: "S256",
  };

  await expectFailure(
    () =>
      validateAuthorizationRequest({ ...baseQuery, clientId: "nope" }),
    "产品未登记",
    "未知 client_id 被拒",
  );
  await expectFailure(
    () =>
      validateAuthorizationRequest({
        ...baseQuery,
        redirectUri: "https://evil.test/cb",
      }),
    "回调地址未登记",
    "未登记的 redirect_uri 被拒",
  );
  await expectFailure(
    () =>
      validateAuthorizationRequest({ ...baseQuery, responseType: "token" }),
    "response_type",
    "隐式模式被拒",
  );
  await expectFailure(
    () =>
      validateAuthorizationRequest({
        ...baseQuery,
        codeChallenge: "",
        codeChallengeMethod: "",
      }),
    "PKCE",
    "缺少 PKCE 被拒",
  );
  await expectFailure(
    () =>
      validateAuthorizationRequest({
        ...baseQuery,
        codeChallengeMethod: "plain",
      }),
    "S256",
    "plain 方法被拒",
  );
  await expectFailure(
    () => validateAuthorizationRequest({ ...baseQuery, scope: "calendar.write" }),
    "scope",
    "越权 scope 被拒",
  );

  const request = await validateAuthorizationRequest(baseQuery);
  assert(
    request.scopes.join(" ") === "openid profile email offline_access",
    "scope 按登记范围授予",
  );

  // ---- 授权码换令牌 ----
  const code = await issueAuthorizationCode({ request, userId: user.id });

  await expectFailure(
    () =>
      exchangeAuthorizationCode({
        clientId: "rishi",
        clientSecret: "wrong-secret",
        code,
        redirectUri: REDIRECT,
        codeVerifier: pkce.verifier,
      }),
    "client_secret",
    "错误的 client_secret 被拒",
  );
  await expectFailure(
    () =>
      exchangeAuthorizationCode({
        clientId: "rishi",
        clientSecret: CONFIDENTIAL_SECRET,
        code,
        redirectUri: "https://evil.test/cb",
        codeVerifier: pkce.verifier,
      }),
    "redirect_uri",
    "换票时 redirect_uri 不符被拒",
  );
  await expectFailure(
    () =>
      exchangeAuthorizationCode({
        clientId: "rishi",
        clientSecret: CONFIDENTIAL_SECRET,
        code,
        redirectUri: REDIRECT,
        codeVerifier: createPkcePair().verifier,
      }),
    "code_verifier",
    "错误的 code_verifier 被拒",
  );

  const tokens = await exchangeAuthorizationCode({
    clientId: "rishi",
    clientSecret: CONFIDENTIAL_SECRET,
    code,
    redirectUri: REDIRECT,
    codeVerifier: pkce.verifier,
  });
  assert(tokens.accessToken.length > 20, "拿到 access token");
  assert(tokens.refreshToken, "申请了 offline_access 才给 refresh token");
  assert(tokens.openId, "带 openid 的请求要发 id_token");

  // 明文不入库
  const storedCode = await prisma.oAuthCode.findFirst();
  assert(storedCode && storedCode.codeHash !== code, "授权码不明文存库");
  assert(
    storedCode!.codeHash === hashToken(code),
    "授权码按 sha256 摘要存储",
  );
  const storedAccess = await prisma.oAuthAccessToken.findFirst();
  assert(
    storedAccess && storedAccess.tokenHash === hashToken(tokens.accessToken),
    "access token 摘要存储",
  );

  // ---- 授权码重放 ----
  await expectFailure(
    () =>
      exchangeAuthorizationCode({
        clientId: "rishi",
        clientSecret: CONFIDENTIAL_SECRET,
        code,
        redirectUri: REDIRECT,
        codeVerifier: pkce.verifier,
      }),
    "已被使用",
    "授权码只能用一次",
  );
  assert(
    (await resolveAccessToken(tokens.accessToken)) === null,
    "重放授权码后，原先换出的 access token 一并作废",
  );

  // ---- 过期的授权码 ----
  const stalePkce = createPkcePair();
  const staleRequest = await validateAuthorizationRequest({
    ...baseQuery,
    codeChallenge: stalePkce.challenge,
  });
  const staleCode = await issueAuthorizationCode({
    request: staleRequest,
    userId: user.id,
  });
  await prisma.oAuthCode.updateMany({
    where: { codeHash: hashToken(staleCode) },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  await expectFailure(
    () =>
      exchangeAuthorizationCode({
        clientId: "rishi",
        clientSecret: CONFIDENTIAL_SECRET,
        code: staleCode,
        redirectUri: REDIRECT,
        codeVerifier: stalePkce.verifier,
      }),
    "过期",
    "过期授权码被拒",
  );

  // ---- 公开客户端：不给密钥也能换，但必须有 PKCE ----
  const publicPkce = createPkcePair();
  const publicRequest = await validateAuthorizationRequest({
    clientId: "rishi-web",
    redirectUri: REDIRECT,
    responseType: "code",
    scope: "openid profile",
    state: "st-2",
    nonce: "nonce-2",
    codeChallenge: publicPkce.challenge,
    codeChallengeMethod: "S256",
  });
  const publicCode = await issueAuthorizationCode({
    request: publicRequest,
    userId: user.id,
  });
  const publicTokens = await exchangeAuthorizationCode({
    clientId: "rishi-web",
    code: publicCode,
    redirectUri: REDIRECT,
    codeVerifier: publicPkce.verifier,
  });
  assert(publicTokens.accessToken.length > 20, "public 客户端换票成功");
  assert(
    publicTokens.refreshToken === null,
    "没申请 offline_access 就不发 refresh token",
  );

  // ---- refresh 轮换与重放 ----
  const freshPkce = createPkcePair();
  const freshRequest = await validateAuthorizationRequest({
    ...baseQuery,
    codeChallenge: freshPkce.challenge,
  });
  const freshCode = await issueAuthorizationCode({
    request: freshRequest,
    userId: user.id,
  });
  const first = await exchangeAuthorizationCode({
    clientId: "rishi",
    clientSecret: CONFIDENTIAL_SECRET,
    code: freshCode,
    redirectUri: REDIRECT,
    codeVerifier: freshPkce.verifier,
  });
  const rotated = await refreshTokens({
    clientId: "rishi",
    clientSecret: CONFIDENTIAL_SECRET,
    refreshToken: first.refreshToken!,
  });
  assert(
    rotated.refreshToken && rotated.refreshToken !== first.refreshToken,
    "refresh 后换发新的 refresh token",
  );
  await expectFailure(
    () =>
      refreshTokens({
        clientId: "rishi",
        clientSecret: CONFIDENTIAL_SECRET,
        refreshToken: first.refreshToken!,
      }),
    "已作废",
    "旧 refresh token 不能重复使用",
  );
  await expectFailure(
    () =>
      refreshTokens({
        clientId: "rishi",
        clientSecret: CONFIDENTIAL_SECRET,
        refreshToken: rotated.refreshToken!,
      }),
    "已作废",
    "重放旧令牌后整条链作废",
  );

  // ---- scope 不能靠 refresh 扩权 ----
  const widenPkce = createPkcePair();
  const widenRequest = await validateAuthorizationRequest({
    ...baseQuery,
    scope: "openid offline_access",
    codeChallenge: widenPkce.challenge,
  });
  const widenCode = await issueAuthorizationCode({
    request: widenRequest,
    userId: user.id,
  });
  const narrow = await exchangeAuthorizationCode({
    clientId: "rishi",
    clientSecret: CONFIDENTIAL_SECRET,
    code: widenCode,
    redirectUri: REDIRECT,
    codeVerifier: widenPkce.verifier,
  });
  await expectFailure(
    () =>
      refreshTokens({
        clientId: "rishi",
        clientSecret: CONFIDENTIAL_SECRET,
        refreshToken: narrow.refreshToken!,
        scope: "openid email offline_access",
      }),
    "扩大 scope",
    "refresh 不能扩大 scope",
  );

  // ---- access token 解析、撤销 ----
  const live = await resolveAccessToken(rotated.accessToken);
  assert(live && live.userId === user.id, "access token 能解析出用户");
  assert(
    (await resolveAccessToken("not-a-real-token")) === null,
    "伪造的 access token 解析失败",
  );
  await revokeToken({
    clientId: "rishi",
    clientSecret: CONFIDENTIAL_SECRET,
    token: rotated.accessToken,
  });
  assert(
    (await resolveAccessToken(rotated.accessToken)) === null,
    "撤销后 access token 立刻失效",
  );

  // ---- claim 按 scope 裁剪 ----
  const claimsUser = await getClaimsUserById(user.id);
  assert(claimsUser, "读到 claims 用户");
  const minimal = buildUserClaims({ user: claimsUser!, scope: "openid" });
  assert(minimal.sub === sub, "sub 用 publicId");
  assert(!("email" in minimal), "没有 email scope 就不返回邮箱");
  assert(!("phone_number" in minimal), "没有 phone scope 就不返回手机号");
  assert(!("name" in minimal), "没有 profile scope 就不返回昵称");

  const full = buildUserClaims({
    user: claimsUser!,
    scope: "openid profile email phone",
  });
  assert(full.name === "测试用户", "profile scope 返回昵称");
  assert("kk_number" in full, "profile scope 返回 kk_number");
  assert(full.email === "oidc-tester@example.com", "email scope 返回邮箱");
  assert(full.email_verified === false, "未验证邮箱标记为 false");
  assert(full.phone_number === "13800138000", "phone scope 返回手机号");
  assert(
    !Object.keys(full).some((key) => /password|hash|idNumber|token/i.test(key)),
    "claim 里不含密码哈希、证件号、令牌",
  );

  // ---- ID Token 的 iss / aud / nonce ----
  const idToken = await signIdToken({
    issuer: ISSUER,
    audience: "rishi",
    claims: full,
    nonce: "nonce-1",
  });
  const verified = await verifyIdToken({
    token: idToken,
    issuer: ISSUER,
    audience: "rishi",
    nonce: "nonce-1",
  });
  assert(verified.sub === sub, "ID Token 的 sub 正确");

  await expectFailure(
    () =>
      verifyIdToken({ token: idToken, issuer: ISSUER, audience: "course" }),
    "aud",
    "错误 audience 被拒",
  );
  await expectFailure(
    () =>
      verifyIdToken({
        token: idToken,
        issuer: "https://evil.test",
        audience: "rishi",
      }),
    "iss",
    "错误 issuer 被拒",
  );
  await expectFailure(
    () =>
      verifyIdToken({
        token: idToken,
        issuer: ISSUER,
        audience: "rishi",
        nonce: "other",
      }),
    "nonce",
    "nonce 不符被拒",
  );

  // alg 混淆：把头改成 none 之后必须验不过
  const [, payloadPart, signature] = idToken.split(".");
  const forgedHeader = Buffer.from(
    JSON.stringify({ alg: "none", typ: "JWT" }),
  ).toString("base64url");
  await expectFailure(
    () =>
      verifyIdToken({
        token: `${forgedHeader}.${payloadPart}.${signature}`,
        issuer: ISSUER,
        audience: "rishi",
      }),
    "alg",
    "alg=none 被拒",
  );

  await prisma.$disconnect();
  console.log("oidc-flow ok");
} finally {
  rmSync(workdir, { recursive: true, force: true });
}

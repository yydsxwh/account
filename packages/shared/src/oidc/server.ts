/**
 * Authorization Server：Authorization Code + PKCE，以及 refresh token 轮换。
 *
 * 安全约定（改这个文件前先读一遍）：
 * - 授权码一次性。第二次使用视为泄露，连带作废同一枚码换出去的所有令牌
 * - 授权码、access token、refresh token 一律只存 SHA-256 摘要
 * - redirect_uri 在授权和换票两步都要比对，且必须与登记值完全一致
 * - public 客户端强制 PKCE
 */

import { prisma } from "../db";
import {
  authenticateClient,
  isPublicClient,
  requiresPkce,
  supportsGrant,
  type OAuthClientRow,
} from "./clients";
import { OAuthError } from "./errors";
import { isAllowedRedirectUri, normalizeRedirectUri } from "./redirect-uri";
import {
  formatScope,
  isOpenIdRequest,
  parseScope,
  resolveGrantedScopes,
} from "./scopes";
import {
  ACCESS_TOKEN_TTL_SEC,
  AUTHORIZATION_CODE_TTL_SEC,
  REFRESH_TOKEN_TTL_SEC,
  generateOpaqueToken,
  hashToken,
} from "./tokens";
import {
  isSupportedPkceMethod,
  isValidCodeChallenge,
  verifyCodeChallenge,
} from "./pkce";

export type AuthorizationRequest = {
  client: OAuthClientRow;
  redirectUri: string;
  scopes: string[];
  state: string;
  nonce: string;
  codeChallenge: string;
  codeChallengeMethod: string;
};

export type RawAuthorizationQuery = {
  clientId: string;
  redirectUri: string;
  responseType: string;
  scope: string;
  state: string;
  nonce: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  accountOrigin?: string;
};

/**
 * 校验授权请求。
 * 抛出的 OAuthError 若 fatal=true，说明 redirect_uri 不可信，必须就地显示错误，
 * 不能把错误跳回去 —— 那等于给了攻击者一个开放重定向。
 */
export async function validateAuthorizationRequest(
  query: RawAuthorizationQuery,
): Promise<AuthorizationRequest> {
  const client = await prisma.oAuthClient.findFirst({
    where: { clientId: (query.clientId || "").trim(), enabled: true },
  });
  if (!client) {
    throw new OAuthError("invalid_client", "产品未登记或已停用", { fatal: true });
  }
  if (!isAllowedRedirectUri(client, query.redirectUri, query.accountOrigin)) {
    throw new OAuthError("invalid_request", "回调地址未登记", { fatal: true });
  }
  const redirectUri = query.redirectUri.trim();

  if (!supportsGrant(client, "authorization_code")) {
    throw new OAuthError("unauthorized_client", "该产品未开通授权码模式");
  }

  const responseType = (query.responseType || "code").trim();
  if (responseType !== "code") {
    throw new OAuthError(
      "unsupported_response_type",
      "只支持 response_type=code",
    );
  }

  const { granted, rejected } = resolveGrantedScopes({
    requested: query.scope,
    allowed: client.allowedScopes,
  });
  if (granted.length === 0) {
    throw new OAuthError(
      "invalid_scope",
      rejected.length
        ? `产品未被授权这些 scope：${rejected.join(" ")}`
        : "缺少可用的 scope",
    );
  }

  const codeChallenge = (query.codeChallenge || "").trim();
  const codeChallengeMethod = (query.codeChallengeMethod || "").trim();
  if (codeChallenge) {
    if (!isSupportedPkceMethod(codeChallengeMethod || "S256")) {
      throw new OAuthError(
        "invalid_request",
        "code_challenge_method 只支持 S256",
      );
    }
    if (!isValidCodeChallenge(codeChallenge)) {
      throw new OAuthError("invalid_request", "code_challenge 格式不对");
    }
  } else if (requiresPkce(client)) {
    throw new OAuthError(
      "invalid_request",
      isPublicClient(client)
        ? "公开客户端必须使用 PKCE，请带上 code_challenge"
        : "该产品已要求 PKCE，请带上 code_challenge",
    );
  }

  return {
    client,
    redirectUri,
    scopes: granted,
    state: (query.state || "").trim(),
    nonce: (query.nonce || "").trim(),
    codeChallenge,
    codeChallengeMethod: codeChallenge ? codeChallengeMethod || "S256" : "",
  };
}

export async function issueAuthorizationCode(input: {
  request: AuthorizationRequest;
  userId: string;
  sessionId?: string | null;
}): Promise<string> {
  const code = generateOpaqueToken();
  await prisma.oAuthCode.create({
    data: {
      codeHash: hashToken(code),
      clientId: input.request.client.clientId,
      userId: input.userId,
      redirectUri: normalizeRedirectUri(input.request.redirectUri),
      scope: formatScope(input.request.scopes),
      nonce: input.request.nonce,
      codeChallenge: input.request.codeChallenge,
      codeChallengeMethod: input.request.codeChallengeMethod,
      sessionId: input.sessionId ?? null,
      expiresAt: new Date(Date.now() + AUTHORIZATION_CODE_TTL_SEC * 1000),
    },
  });
  return code;
}

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string | null;
  scope: string;
  userId: string;
  clientId: string;
  sessionId: string | null;
  nonce: string;
  expiresIn: number;
  openId: boolean;
};

async function mintTokens(input: {
  clientId: string;
  userId: string;
  scope: string;
  sessionId: string | null;
  nonce: string;
  withRefresh: boolean;
}): Promise<IssuedTokens> {
  const accessToken = generateOpaqueToken();
  await prisma.oAuthAccessToken.create({
    data: {
      tokenHash: hashToken(accessToken),
      clientId: input.clientId,
      userId: input.userId,
      scope: input.scope,
      sessionId: input.sessionId,
      expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_SEC * 1000),
    },
  });

  let refreshToken: string | null = null;
  if (input.withRefresh) {
    refreshToken = generateOpaqueToken();
    await prisma.oAuthRefreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        clientId: input.clientId,
        userId: input.userId,
        scope: input.scope,
        sessionId: input.sessionId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SEC * 1000),
      },
    });
  }

  return {
    accessToken,
    refreshToken,
    scope: input.scope,
    userId: input.userId,
    clientId: input.clientId,
    sessionId: input.sessionId,
    nonce: input.nonce,
    expiresIn: ACCESS_TOKEN_TTL_SEC,
    openId: isOpenIdRequest(parseScope(input.scope)),
  };
}

/** 授权码被重复使用 = 可能泄露，把这枚码换出去的令牌全部作废 */
async function revokeTokensIssuedBySession(input: {
  clientId: string;
  userId: string;
  issuedAfter: Date;
}) {
  const now = new Date();
  await prisma.oAuthAccessToken.updateMany({
    where: {
      clientId: input.clientId,
      userId: input.userId,
      createdAt: { gte: input.issuedAfter },
      revokedAt: null,
    },
    data: { revokedAt: now },
  });
  await prisma.oAuthRefreshToken.updateMany({
    where: {
      clientId: input.clientId,
      userId: input.userId,
      createdAt: { gte: input.issuedAfter },
      revokedAt: null,
    },
    data: { revokedAt: now },
  });
}

/**
 * 换票时不再重新比对登记列表：授权那一步已经比过，
 * 这里只要求 redirect_uri 与当时用的那一个逐字相同（RFC 6749 §4.1.3）。
 */
export async function exchangeAuthorizationCode(input: {
  clientId: string;
  clientSecret?: string;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}): Promise<IssuedTokens> {
  const client = await authenticateClient({
    clientId: input.clientId,
    clientSecret: input.clientSecret,
  });
  if (!supportsGrant(client, "authorization_code")) {
    throw new OAuthError("unauthorized_client", "该产品未开通授权码模式");
  }

  const row = await prisma.oAuthCode.findUnique({
    where: { codeHash: hashToken((input.code || "").trim()) },
  });
  if (!row || row.clientId !== client.clientId) {
    throw new OAuthError("invalid_grant", "授权码无效");
  }
  if (row.usedAt) {
    await revokeTokensIssuedBySession({
      clientId: row.clientId,
      userId: row.userId,
      issuedAfter: row.usedAt,
    });
    throw new OAuthError("invalid_grant", "授权码已被使用，相关令牌已作废");
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    throw new OAuthError("invalid_grant", "授权码已过期");
  }
  if (row.redirectUri !== normalizeRedirectUri(input.redirectUri)) {
    throw new OAuthError("invalid_grant", "redirect_uri 与申请授权时不一致");
  }

  if (row.codeChallenge) {
    if (
      !verifyCodeChallenge({
        verifier: (input.codeVerifier || "").trim(),
        challenge: row.codeChallenge,
        method: row.codeChallengeMethod || "S256",
      })
    ) {
      throw new OAuthError("invalid_grant", "code_verifier 校验不通过");
    }
  } else if (requiresPkce(client)) {
    throw new OAuthError("invalid_grant", "该产品必须使用 PKCE");
  }

  // 先标记已用，再发令牌：并发重复提交时只有一边能成功
  const claimed = await prisma.oAuthCode.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) {
    throw new OAuthError("invalid_grant", "授权码已被使用");
  }

  return mintTokens({
    clientId: client.clientId,
    userId: row.userId,
    scope: row.scope,
    sessionId: row.sessionId,
    nonce: row.nonce,
    withRefresh:
      supportsGrant(client, "refresh_token") &&
      parseScope(row.scope).includes("offline_access"),
  });
}

export async function refreshTokens(input: {
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
  scope?: string;
}): Promise<IssuedTokens> {
  const client = await authenticateClient({
    clientId: input.clientId,
    clientSecret: input.clientSecret,
  });
  if (!supportsGrant(client, "refresh_token")) {
    throw new OAuthError("unauthorized_client", "该产品未开通 refresh_token");
  }

  const row = await prisma.oAuthRefreshToken.findUnique({
    where: { tokenHash: hashToken((input.refreshToken || "").trim()) },
  });
  if (!row || row.clientId !== client.clientId) {
    throw new OAuthError("invalid_grant", "refresh_token 无效");
  }
  if (row.revokedAt) {
    // 已轮换掉的旧令牌又被拿来用：按泄露处理，整条链作废
    await prisma.oAuthRefreshToken.updateMany({
      where: { userId: row.userId, clientId: row.clientId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new OAuthError("invalid_grant", "refresh_token 已作废，请重新登录");
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    throw new OAuthError("invalid_grant", "refresh_token 已过期");
  }

  // 缩小 scope 可以，扩大不行
  let scope = row.scope;
  if (input.scope) {
    const requested = parseScope(input.scope);
    const current = parseScope(row.scope);
    const widened = requested.filter((item) => !current.includes(item));
    if (widened.length > 0) {
      throw new OAuthError("invalid_scope", "refresh 时不能扩大 scope");
    }
    scope = formatScope(requested);
  }

  const issued = await mintTokens({
    clientId: client.clientId,
    userId: row.userId,
    scope,
    sessionId: row.sessionId,
    nonce: "",
    withRefresh: true,
  });

  await prisma.oAuthRefreshToken.update({
    where: { id: row.id },
    data: {
      revokedAt: new Date(),
      replacedById: issued.refreshToken ? hashToken(issued.refreshToken) : null,
    },
  });

  return issued;
}

export type ResolvedAccessToken = {
  clientId: string;
  userId: string;
  scope: string;
  sessionId: string | null;
};

export async function resolveAccessToken(
  token: string,
): Promise<ResolvedAccessToken | null> {
  const value = (token || "").trim();
  if (!value) return null;
  const row = await prisma.oAuthAccessToken.findUnique({
    where: { tokenHash: hashToken(value) },
  });
  if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  return {
    clientId: row.clientId,
    userId: row.userId,
    scope: row.scope,
    sessionId: row.sessionId,
  };
}

/**
 * RFC 7009。规范要求：无论令牌存不存在都返回 200，
 * 不然这个端点就成了"帮攻击者确认令牌有效性"的探测接口。
 */
export async function revokeToken(input: {
  clientId: string;
  clientSecret?: string;
  token: string;
  tokenTypeHint?: string;
}): Promise<void> {
  const client = await authenticateClient({
    clientId: input.clientId,
    clientSecret: input.clientSecret,
  });
  const tokenHash = hashToken((input.token || "").trim());
  const now = new Date();

  if (input.tokenTypeHint !== "refresh_token") {
    await prisma.oAuthAccessToken.updateMany({
      where: { tokenHash, clientId: client.clientId, revokedAt: null },
      data: { revokedAt: now },
    });
  }
  if (input.tokenTypeHint !== "access_token") {
    await prisma.oAuthRefreshToken.updateMany({
      where: { tokenHash, clientId: client.clientId, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}

/** 账号中心会话被撤销时，联动作废由它签出去的产品令牌 */
export async function revokeTokensForSession(sessionId: string) {
  const now = new Date();
  await prisma.oAuthAccessToken.updateMany({
    where: { sessionId, revokedAt: null },
    data: { revokedAt: now },
  });
  await prisma.oAuthRefreshToken.updateMany({
    where: { sessionId, revokedAt: null },
    data: { revokedAt: now },
  });
}

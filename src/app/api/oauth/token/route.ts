/**
 * POST /api/oauth/token
 *
 * 标准用法（RFC 6749 §4.1.3 / §6）：Content-Type: application/x-www-form-urlencoded
 *   grant_type=authorization_code&code=&redirect_uri=&code_verifier=&client_id=
 *   grant_type=refresh_token&refresh_token=&client_id=
 *
 * 客户端认证：Authorization: Basic base64(client_id:client_secret) 或表单里带 client_secret。
 * public 客户端不带密钥，只带 client_id + code_verifier。
 *
 * 兼容：老产品发的 JSON、且不带 grant_type 的请求仍然照旧受理，
 * 响应里除了标准字段还会多一个 user 字段。新产品请用 id_token / userinfo。
 */

import { NextResponse } from "next/server";
import { toOAuthErrorBody } from "@andyyyds/shared/oidc/errors";
import { parseBasicClientAuth } from "@andyyyds/shared/oidc/clients";
import {
  exchangeAuthorizationCode,
  refreshTokens,
  type IssuedTokens,
} from "@andyyyds/shared/oidc/server";
import { getIssuer } from "@andyyyds/shared/oidc/issuer";
import { signIdToken } from "@andyyyds/shared/oidc/tokens";
import { buildUserClaims } from "@andyyyds/shared/oidc/claims";
import { getClaimsUserById } from "@andyyyds/shared/identity/users";
import { resolveStoredAccessUrl } from "@andyyyds/shared/storage";
import { toPublicUser } from "@andyyyds/shared/oauth";
import {
  clientIpFromRequest,
  consumeRateLimit,
} from "@andyyyds/shared/identity/rate-limit";

export const dynamic = "force-dynamic";

type TokenParams = Record<string, string>;

async function readParams(req: Request): Promise<TokenParams> {
  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    const body = (await req.json()) as Record<string, unknown>;
    const out: TokenParams = {};
    for (const [key, value] of Object.entries(body || {})) {
      if (typeof value === "string") out[key] = value;
    }
    return out;
  }
  const form = await req.formData();
  const out: TokenParams = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
  });
}

export async function POST(req: Request) {
  try {
    const ip = clientIpFromRequest(req);
    const limited = consumeRateLimit({
      key: `oauth:token:${ip}`,
      limit: 60,
      windowSec: 60,
    });
    if (!limited.ok) {
      return NextResponse.json(
        { error: "temporarily_unavailable", error_description: "请求过于频繁" },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        },
      );
    }

    const params = await readParams(req);
    const basic = parseBasicClientAuth(req.headers.get("authorization"));
    const clientId = (basic?.clientId || params.client_id || "").trim();
    const clientSecret = basic?.clientSecret || params.client_secret || "";
    // 老产品不发 grant_type，按授权码处理
    const grantType = (params.grant_type || "authorization_code").trim();

    let issued: IssuedTokens;
    if (grantType === "authorization_code") {
      issued = await exchangeAuthorizationCode({
        clientId,
        clientSecret,
        code: params.code || "",
        redirectUri: params.redirect_uri || "",
        codeVerifier: params.code_verifier || "",
      });
    } else if (grantType === "refresh_token") {
      issued = await refreshTokens({
        clientId,
        clientSecret,
        refreshToken: params.refresh_token || "",
        scope: params.scope || undefined,
      });
    } else {
      return noStore(
        {
          error: "unsupported_grant_type",
          error_description: "只支持 authorization_code 和 refresh_token",
        },
        400,
      );
    }

    const user = await getClaimsUserById(issued.userId);
    if (!user) {
      return noStore(
        { error: "invalid_grant", error_description: "用户不存在" },
        400,
      );
    }
    const avatarUrl = user.avatarUrl
      ? await resolveStoredAccessUrl(user.avatarUrl)
      : "";

    const body: Record<string, unknown> = {
      access_token: issued.accessToken,
      token_type: "Bearer",
      expires_in: issued.expiresIn,
      scope: issued.scope,
    };
    if (issued.refreshToken) body.refresh_token = issued.refreshToken;

    if (issued.openId) {
      body.id_token = await signIdToken({
        issuer: getIssuer(req),
        audience: issued.clientId,
        claims: buildUserClaims({
          user,
          scope: issued.scope,
          avatarUrl,
        }),
        nonce: issued.nonce || undefined,
        sessionId: issued.sessionId,
      });
    }

    // 兼容既有产品：它们只读 user 字段
    body.user = { ...toPublicUser(user), avatarUrl, sub: user.publicId };

    return noStore(body);
  } catch (error) {
    const mapped = toOAuthErrorBody(error);
    return noStore(mapped.body, mapped.status);
  }
}

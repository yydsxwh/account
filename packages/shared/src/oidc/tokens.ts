/**
 * 令牌。
 *
 * - ID Token：RS256 JWT，产品用 JWKS 自行离线校验
 * - Access Token / Refresh Token：不透明随机串，库里只存 SHA-256 摘要
 *
 * 为什么 access token 不做成 JWT：不透明串可以即时吊销，
 * 泄库也拿不到能用的令牌。产品需要离线校验身份时用 ID Token。
 */

import crypto from "crypto";
import { SignJWT, createLocalJWKSet, jwtVerify, type JWTPayload } from "jose";
import { getActiveSigningKey, listPublicJwks } from "./keys";
import type { StandardClaims } from "./claims";

export const AUTHORIZATION_CODE_TTL_SEC = 60;
export const ACCESS_TOKEN_TTL_SEC = 60 * 60;
export const REFRESH_TOKEN_TTL_SEC = 60 * 60 * 24 * 30;
export const ID_TOKEN_TTL_SEC = 60 * 10;

/** 库里一律存摘要。明文只在这一次响应里出现 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export async function signIdToken(input: {
  issuer: string;
  audience: string;
  claims: StandardClaims;
  nonce?: string;
  authTime?: Date;
  sessionId?: string | null;
  expiresInSec?: number;
}): Promise<string> {
  const key = await getActiveSigningKey();
  const now = Math.floor(Date.now() / 1000);
  const jwt = new SignJWT({
    ...input.claims,
    ...(input.nonce ? { nonce: input.nonce } : {}),
    ...(input.authTime
      ? { auth_time: Math.floor(input.authTime.getTime() / 1000) }
      : {}),
    ...(input.sessionId ? { sid: input.sessionId } : {}),
  })
    .setProtectedHeader({ alg: key.alg, kid: key.kid, typ: "JWT" })
    .setIssuer(input.issuer)
    .setAudience(input.audience)
    .setSubject(String(input.claims.sub))
    .setIssuedAt(now)
    .setExpirationTime(now + (input.expiresInSec ?? ID_TOKEN_TTL_SEC))
    .setJti(crypto.randomUUID());
  return jwt.sign(key.privateKey);
}

/**
 * 校验 ID Token。产品侧接入时也可以直接抄这段逻辑。
 * 必须同时校 iss 和 aud：只校签名的话，别的产品的 token 也能拿来冒充。
 */
export async function verifyIdToken(input: {
  token: string;
  issuer: string;
  audience: string;
  nonce?: string;
}): Promise<JWTPayload> {
  const jwks = createLocalJWKSet({ keys: await listPublicJwks() });
  const { payload } = await jwtVerify(input.token, jwks, {
    issuer: input.issuer,
    audience: input.audience,
    // 固定算法，挡掉 alg=none / HS256 混淆攻击
    algorithms: ["RS256"],
  });
  if (input.nonce && payload.nonce !== input.nonce) {
    throw new Error("nonce mismatch");
  }
  return payload;
}

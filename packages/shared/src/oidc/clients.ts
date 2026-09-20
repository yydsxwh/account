/**
 * OAuth Client（接入的产品）。
 *
 * confidential：有自己的后端，能安全保管 client_secret（日事后端、course 后端）
 * public：SPA、移动 App、桌面端。没有密钥，必须走 PKCE。
 *
 * 绝不要把 confidential 的 client_secret 放进浏览器或 App 包里。
 */

import crypto from "crypto";
import { prisma } from "../db";
import { hashPassword, verifyPassword } from "../password";
import { OAuthError } from "./errors";
import { DEFAULT_CLIENT_SCOPES } from "./scopes";

export const CLIENT_TYPES = ["confidential", "public"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const GRANT_TYPES = ["authorization_code", "refresh_token"] as const;
export type GrantType = (typeof GRANT_TYPES)[number];

export type OAuthClientRow = {
  id: string;
  clientId: string;
  clientSecret: string;
  clientType: string;
  name: string;
  homepageUrl: string;
  redirectUris: string;
  allowedScopes: string;
  grantTypes: string;
  requirePkce: boolean;
  enabled: boolean;
};

export function isPublicClient(client: Pick<OAuthClientRow, "clientType">) {
  return client.clientType === "public";
}

/** public 客户端无条件强制 PKCE，不看 requirePkce 开关 */
export function requiresPkce(
  client: Pick<OAuthClientRow, "clientType" | "requirePkce">,
) {
  return isPublicClient(client) || client.requirePkce !== false;
}

export function clientGrantTypes(client: Pick<OAuthClientRow, "grantTypes">) {
  return String(client.grantTypes || "")
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function supportsGrant(
  client: Pick<OAuthClientRow, "grantTypes">,
  grant: string,
) {
  const list = clientGrantTypes(client);
  if (list.length === 0) return grant === "authorization_code";
  return list.includes(grant);
}

export function generateClientId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  const suffix = crypto.randomBytes(3).toString("hex");
  return slug ? `${slug}-${suffix}` : `app-${suffix}`;
}

export function generateClientSecret() {
  return `ys_${crypto.randomBytes(24).toString("hex")}`;
}

export async function hashClientSecret(secret: string) {
  return hashPassword(secret);
}

export async function findEnabledClient(clientId: string) {
  const id = (clientId || "").trim();
  if (!id) return null;
  return prisma.oAuthClient.findFirst({ where: { clientId: id, enabled: true } });
}

export function defaultAllowedScopes() {
  return DEFAULT_CLIENT_SCOPES;
}

/**
 * 从 Authorization: Basic 头里取 client 凭证（RFC 6749 §2.3.1）。
 * 规范要求先做 form-urlencode 再 base64，这里按规范解回来。
 */
export function parseBasicClientAuth(
  header: string | null,
): { clientId: string; clientSecret: string } | null {
  if (!header || !header.toLowerCase().startsWith("basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    if (sep < 0) return null;
    return {
      clientId: decodeURIComponent(decoded.slice(0, sep)),
      clientSecret: decodeURIComponent(decoded.slice(sep + 1)),
    };
  } catch {
    return null;
  }
}

/**
 * token 端点的客户端认证。
 * confidential 必须给出正确密钥；public 只认 client_id，且不接受密钥。
 */
export async function authenticateClient(input: {
  clientId: string;
  clientSecret?: string;
}): Promise<OAuthClientRow> {
  const client = await findEnabledClient(input.clientId);
  if (!client) {
    throw new OAuthError("invalid_client", "产品未登记或已停用");
  }
  if (isPublicClient(client)) {
    return client;
  }
  const secret = (input.clientSecret || "").trim();
  if (!secret) {
    throw new OAuthError("invalid_client", "缺少 client_secret");
  }
  if (!(await verifyPassword(secret, client.clientSecret))) {
    throw new OAuthError("invalid_client", "client_secret 不正确");
  }
  return client;
}

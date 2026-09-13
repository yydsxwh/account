/**
 * 第一方软件产品单点登录（类似 Google 账号）。
 * 产品把用户送到账号中心登录，回来时用一次性 code 换用户信息。
 */

import crypto from "crypto";
import { prisma } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { isPlaceholderEmail } from "./auth-email";
import { normalizeRoles, primaryRole, type Role } from "./roles";

export const OAUTH_CODE_TTL_SEC = 120;
export const OAUTH_TOKEN_TTL_SEC = 60 * 60 * 24 * 30;

export type PublicAccountUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  kkNumber: number | null;
  avatarUrl: string;
  role: Role;
  roles: Role[];
};

export type OAuthClientRow = {
  id: string;
  clientId: string;
  clientSecret: string;
  name: string;
  homepageUrl: string;
  redirectUris: string;
  enabled: boolean;
};

export function parseUriList(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    return (raw || "")
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

export function serializeUriList(items: string[]): string {
  return JSON.stringify(
    items.map((item) => item.trim()).filter(Boolean),
  );
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

export function generateOpaqueToken() {
  return crypto.randomBytes(32).toString("hex");
}

function normalizeUri(raw: string) {
  try {
    const url = new URL(raw.trim());
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function isAllowedRedirectUri(
  client: OAuthClientRow,
  redirectUri: string,
  accountOrigin?: string,
) {
  const wanted = normalizeUri(redirectUri);
  if (!wanted) return false;
  let wantedUrl: URL;
  try {
    wantedUrl = new URL(wanted);
  } catch {
    return false;
  }

  return parseUriList(client.redirectUris).some((allowed) => {
    const trimmed = allowed.trim();
    // 同域相对回调：/demo/docs/callback 只允许账号中心自己的主机
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
      if (!accountOrigin) return false;
      try {
        const account = new URL(accountOrigin);
        if (wantedUrl.origin !== account.origin) return false;
        return wantedUrl.pathname === new URL(trimmed, account.origin).pathname;
      } catch {
        return false;
      }
    }
    return normalizeUri(trimmed) === wanted;
  });
}

export async function findEnabledClient(clientId: string) {
  const id = (clientId || "").trim();
  if (!id) return null;
  return prisma.oAuthClient.findFirst({
    where: { clientId: id, enabled: true },
  });
}

export async function hashClientSecret(secret: string) {
  return hashPassword(secret);
}

export async function verifyClientSecret(client: OAuthClientRow, secret: string) {
  return verifyPassword(secret, client.clientSecret);
}

export async function listPublicProducts() {
  const rows = await prisma.oAuthClient.findMany({
    where: { enabled: true },
    orderBy: { createdAt: "asc" },
    select: {
      clientId: true,
      name: true,
      homepageUrl: true,
    },
  });
  return rows;
}

export function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  username: string | null;
  kkNumber?: number | null;
  avatarUrl: string;
  role: string;
  roles: string;
}): PublicAccountUser {
  const roles = normalizeRoles({ role: user.role, roles: user.roles });
  return {
    id: user.id,
    name: user.name,
    email: isPlaceholderEmail(user.email) ? "" : user.email,
    username: user.username || "",
    kkNumber: user.kkNumber ?? null,
    avatarUrl: user.avatarUrl || "",
    role: primaryRole(roles),
    roles,
  };
}

export async function createAuthorizationCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
}) {
  const code = generateOpaqueToken();
  await prisma.oAuthCode.create({
    data: {
      code,
      clientId: input.clientId,
      userId: input.userId,
      redirectUri: normalizeUri(input.redirectUri),
      expiresAt: new Date(Date.now() + OAUTH_CODE_TTL_SEC * 1000),
    },
  });
  return code;
}

export async function exchangeAuthorizationCode(input: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  accountOrigin?: string;
}) {
  const client = await findEnabledClient(input.clientId);
  if (!client || !(await verifyClientSecret(client, input.clientSecret))) {
    throw new Error("产品凭证无效");
  }
  if (!isAllowedRedirectUri(client, input.redirectUri, input.accountOrigin)) {
    throw new Error("回调地址未登记");
  }

  const row = await prisma.oAuthCode.findUnique({
    where: { code: input.code.trim() },
  });
  if (
    !row ||
    row.usedAt ||
    row.clientId !== client.clientId ||
    row.redirectUri !== normalizeUri(input.redirectUri) ||
    row.expiresAt.getTime() <= Date.now()
  ) {
    throw new Error("授权码无效或已过期");
  }

  await prisma.oAuthCode.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });

  const user = await prisma.user.findUnique({
    where: { id: row.userId },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      kkNumber: true,
      avatarUrl: true,
      role: true,
      roles: true,
    },
  });
  if (!user) throw new Error("用户不存在");

  const accessToken = generateOpaqueToken();
  await prisma.oAuthAccessToken.create({
    data: {
      token: accessToken,
      clientId: client.clientId,
      userId: user.id,
      expiresAt: new Date(Date.now() + OAUTH_TOKEN_TTL_SEC * 1000),
    },
  });

  return {
    access_token: accessToken,
    token_type: "Bearer" as const,
    expires_in: OAUTH_TOKEN_TTL_SEC,
    user: toPublicUser(user),
  };
}

export async function getUserByAccessToken(token: string) {
  const row = await prisma.oAuthAccessToken.findUnique({
    where: { token: token.trim() },
  });
  if (!row || row.expiresAt.getTime() <= Date.now()) return null;
  const user = await prisma.user.findUnique({
    where: { id: row.userId },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      kkNumber: true,
      avatarUrl: true,
      role: true,
      roles: true,
    },
  });
  if (!user) return null;
  return { clientId: row.clientId, user: toPublicUser(user) };
}

export function buildAuthorizePath(input: {
  clientId: string;
  redirectUri: string;
  state?: string;
}) {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
  });
  if (input.state) params.set("state", input.state);
  return `/api/oauth/authorize?${params.toString()}`;
}

export function buildLoginWithProductPath(input: {
  clientId: string;
  redirectUri: string;
  state?: string;
  mode?: "login" | "register";
}) {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
  });
  if (input.state) params.set("state", input.state);
  return input.mode === "register"
    ? `/register?${params.toString()}`
    : `/login?${params.toString()}`;
}

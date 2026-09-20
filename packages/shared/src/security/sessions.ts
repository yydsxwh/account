/**
 * 账号中心自己的登录会话。
 *
 * Cookie 里仍然是签名 JWT（主站 www 依赖同一个 Cookie，不能换掉），
 * 但现在额外落一条 UserSession：
 * - 能列出登录设备
 * - 能撤销单个设备或全部设备
 * - 撤销时联动作废该会话签出去的产品令牌
 *
 * 没有 sid 的旧 Cookie 仍然放行（主站签发的就是这种），只是管不了。
 */

import crypto from "crypto";
import { prisma } from "../db";
import { hashToken } from "../oidc/tokens";
import { revokeTokensForSession } from "../oidc/server";

export const SESSION_TTL_SEC = 60 * 60 * 24 * 30;

export type SessionContext = {
  ip?: string;
  userAgent?: string;
  method?: string;
};

export type CreatedSession = {
  id: string;
  secret: string;
  expiresAt: Date;
};

export async function createUserSession(input: {
  userId: string;
  context?: SessionContext;
}): Promise<CreatedSession> {
  const secret = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SEC * 1000);
  const row = await prisma.userSession.create({
    data: {
      userId: input.userId,
      tokenHash: hashToken(secret),
      ip: (input.context?.ip || "").slice(0, 64),
      userAgent: (input.context?.userAgent || "").slice(0, 300),
      method: input.context?.method || "password",
      expiresAt,
    },
    select: { id: true },
  });
  return { id: row.id, secret, expiresAt };
}

function secretMatches(secret: string, tokenHash: string) {
  const a = Buffer.from(hashToken(secret));
  const b = Buffer.from(tokenHash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** @returns true 表示会话仍然有效 */
export async function touchUserSession(input: {
  sessionId: string;
  secret: string;
  userId: string;
}): Promise<boolean> {
  const row = await prisma.userSession.findUnique({
    where: { id: input.sessionId },
    select: {
      id: true,
      userId: true,
      tokenHash: true,
      revokedAt: true,
      expiresAt: true,
      lastSeenAt: true,
    },
  });
  if (!row) return false;
  if (row.userId !== input.userId) return false;
  if (row.revokedAt) return false;
  if (row.expiresAt.getTime() <= Date.now()) return false;
  if (!secretMatches(input.secret, row.tokenHash)) return false;

  // 每分钟最多写一次，别让每个请求都打一次库
  if (Date.now() - row.lastSeenAt.getTime() > 60_000) {
    await prisma.userSession.update({
      where: { id: row.id },
      data: { lastSeenAt: new Date() },
    });
  }
  return true;
}

export async function listUserSessions(userId: string) {
  return prisma.userSession.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    take: 50,
    select: {
      id: true,
      ip: true,
      userAgent: true,
      method: true,
      createdAt: true,
      lastSeenAt: true,
      expiresAt: true,
    },
  });
}

export async function revokeUserSession(input: {
  userId: string;
  sessionId: string;
}): Promise<boolean> {
  const result = await prisma.userSession.updateMany({
    where: { id: input.sessionId, userId: input.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) return false;
  await revokeTokensForSession(input.sessionId);
  return true;
}

export async function revokeOtherUserSessions(input: {
  userId: string;
  keepSessionId?: string | null;
}): Promise<number> {
  const targets = await prisma.userSession.findMany({
    where: {
      userId: input.userId,
      revokedAt: null,
      ...(input.keepSessionId ? { NOT: { id: input.keepSessionId } } : {}),
    },
    select: { id: true },
  });
  if (targets.length === 0) return 0;
  await prisma.userSession.updateMany({
    where: { id: { in: targets.map((row) => row.id) } },
    data: { revokedAt: new Date() },
  });
  for (const row of targets) {
    await revokeTokensForSession(row.id);
  }
  return targets.length;
}

/** UA 太长了，列表里显示个大概就行 */
export function describeUserAgent(userAgent: string): string {
  const ua = String(userAgent || "");
  if (!ua) return "未知设备";
  const os = /Windows/i.test(ua)
    ? "Windows"
    : /iPhone|iPad|iOS/i.test(ua)
      ? "iOS"
      : /Android/i.test(ua)
        ? "Android"
        : /Mac OS X|Macintosh/i.test(ua)
          ? "Mac"
          : /Linux/i.test(ua)
            ? "Linux"
            : "";
  const app = /MicroMessenger/i.test(ua)
    ? "微信"
    : /Edg\//i.test(ua)
      ? "Edge"
      : /Chrome\//i.test(ua)
        ? "Chrome"
        : /Safari\//i.test(ua)
          ? "Safari"
          : /Firefox\//i.test(ua)
            ? "Firefox"
            : "";
  const parts = [os, app].filter(Boolean);
  return parts.length ? parts.join(" · ") : "未知设备";
}

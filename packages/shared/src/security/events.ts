/**
 * 登录记录与安全事件。
 *
 * 只记「谁、什么时候、用什么方式、成没成功」。
 * 绝不记密码、验证码、access token、refresh token、client_secret、Cookie。
 */

import { prisma } from "../db";

export type LoginMethod = "password" | "sms" | "wechat" | "oauth" | "sso";

export type SecurityEventType =
  | "password_changed"
  | "session_revoked"
  | "sessions_revoked_all"
  | "email_changed"
  | "phone_bound"
  | "username_changed"
  | "client_authorized"
  | "client_secret_rotated";

function short(value: string | null | undefined, max = 300) {
  return String(value || "").slice(0, max);
}

/** 记日志失败不能影响主流程：登录该成功还是成功 */
export async function recordLoginEvent(input: {
  userId?: string | null;
  method: LoginMethod;
  success: boolean;
  reason?: string;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await prisma.loginEvent.create({
      data: {
        userId: input.userId || null,
        method: input.method,
        success: input.success,
        reason: short(input.reason, 64),
        ip: short(input.ip, 64),
        userAgent: short(input.userAgent),
      },
    });
  } catch (error) {
    console.error("[security] login event not recorded", error);
  }
}

export async function recordSecurityEvent(input: {
  userId?: string | null;
  type: SecurityEventType;
  detail?: string;
  ip?: string;
}): Promise<void> {
  try {
    await prisma.securityEvent.create({
      data: {
        userId: input.userId || null,
        type: input.type,
        detail: short(input.detail),
        ip: short(input.ip, 64),
      },
    });
  } catch (error) {
    console.error("[security] security event not recorded", error);
  }
}

export async function listLoginEvents(userId: string, take = 20) {
  return prisma.loginEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      method: true,
      success: true,
      reason: true,
      ip: true,
      userAgent: true,
      createdAt: true,
    },
  });
}

export async function listSecurityEvents(userId: string, take = 20) {
  return prisma.securityEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, type: true, detail: true, ip: true, createdAt: true },
  });
}

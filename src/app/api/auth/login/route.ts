/**
 * POST /api/auth/login
 * 邮箱 + 密码。待审账号可登录，但响应带 pendingReview，前端引导提示。
 *
 * 同一 IP、同一邮箱各自限流，挡暴力破解和撞库。
 * 失败原因对外统一说「邮箱或密码错误」，不透露邮箱是否存在。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, verifyPassword } from "@andyyyds/shared/auth";
import { isPlaceholderEmail } from "@andyyyds/shared/auth-email";
import { prisma } from "@andyyyds/shared/db";
import {
  clientIpFromRequest,
  consumeRateLimit,
  resetRateLimit,
  userAgentFromRequest,
} from "@andyyyds/shared/identity/rate-limit";
import { recordLoginEvent } from "@andyyyds/shared/security/events";
import { PENDING_REVIEW_MESSAGE } from "@andyyyds/shared/role-applications";
import { isRoleApplicationPending, type Role } from "@andyyyds/shared/roles";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const BAD_CREDENTIALS = "邮箱或密码错误";

export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const userAgent = userAgentFromRequest(req);
  try {
    const body = schema.parse(await req.json());
    const email = body.email.trim().toLowerCase();

    const byIp = consumeRateLimit({
      key: `login:ip:${ip}`,
      limit: 30,
      windowSec: 300,
    });
    const byAccount = consumeRateLimit({
      key: `login:email:${email}`,
      limit: 10,
      windowSec: 300,
    });
    if (!byIp.ok || !byAccount.ok) {
      await recordLoginEvent({
        method: "password",
        success: false,
        reason: "rate_limited",
        ip,
        userAgent,
      });
      return NextResponse.json(
        { error: "尝试过于频繁，请稍后再试" },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.max(byIp.retryAfterSec, byAccount.retryAfterSec),
            ),
          },
        },
      );
    }

    if (isPlaceholderEmail(email)) {
      return NextResponse.json(
        { error: "请使用已绑定的真实邮箱登录，或改用手机号 / 微信登录" },
        { status: 400 },
      );
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (
      !user ||
      !user.passwordSet ||
      isPlaceholderEmail(user.email) ||
      !(await verifyPassword(body.password, user.passwordHash))
    ) {
      await recordLoginEvent({
        userId: user?.id ?? null,
        method: "password",
        success: false,
        reason: user ? "bad_password" : "no_such_user",
        ip,
        userAgent,
      });
      return NextResponse.json({ error: BAD_CREDENTIALS }, { status: 400 });
    }

    await createSession(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as Role,
      },
      { context: { ip, userAgent, method: "password" } },
    );
    resetRateLimit(`login:email:${email}`);
    await recordLoginEvent({
      userId: user.id,
      method: "password",
      success: true,
      ip,
      userAgent,
    });

    if (isRoleApplicationPending(user.roleApplicationStatus || "")) {
      return NextResponse.json({
        ok: true,
        pendingReview: true,
        message: PENDING_REVIEW_MESSAGE,
        requestedRole: user.requestedRole || "",
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "登录失败" }, { status: 400 });
  }
}

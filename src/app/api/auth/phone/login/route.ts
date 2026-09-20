/**
 * POST /api/auth/phone/login
 * body: { phone, via?, code?, password?, mode?, name?, referralCode?, requestedRole? }
 *
 * via=code（默认）：验证码登录 / 注册。
 * via=password：已绑定手机号且设置过密码，用手机号 + 密码登录（不发短信）。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  findOrCreateUserByPhone,
  loginUserByPhonePassword,
} from "@andyyyds/shared/auth-providers";
import {
  clientIpFromRequest,
  consumeRateLimit,
  resetRateLimit,
  userAgentFromRequest,
} from "@andyyyds/shared/identity/rate-limit";
import { isValidCnMobile, normalizePhone } from "@andyyyds/shared/phone";
import { APPLYABLE_ROLES } from "@andyyyds/shared/roles";
import { recordLoginEvent } from "@andyyyds/shared/security/events";
import { verifySmsCode } from "@andyyyds/shared/sms";

const schema = z.object({
  phone: z.string().min(6).max(20),
  via: z.enum(["code", "password"]).optional(),
  code: z.string().max(8).optional().default(""),
  mode: z.enum(["login", "register"]).optional().default("login"),
  name: z.string().max(40).optional(),
  password: z.string().min(6).max(100).optional().or(z.literal("")),
  referralCode: z.string().max(32).optional(),
  requestedRole: z.enum(APPLYABLE_ROLES).optional().default("STUDENT"),
});

export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const userAgent = userAgentFromRequest(req);
  const context = { ip, userAgent };
  try {
    const body = schema.parse(await req.json());
    const phone = normalizePhone(body.phone);
    if (!isValidCnMobile(phone)) {
      return NextResponse.json({ error: "请输入正确的手机号" }, { status: 400 });
    }

    const via =
      body.via ||
      (body.password && !body.code?.trim() ? "password" : "code");

    if (via === "password") {
      if (body.mode === "register") {
        return NextResponse.json(
          { error: "注册请用短信验证码确认手机号，登录才可用密码" },
          { status: 400 },
        );
      }
      const byIp = consumeRateLimit({
        key: `login:ip:${ip}`,
        limit: 30,
        windowSec: 300,
      });
      const byPhone = consumeRateLimit({
        key: `login:phone:${phone}`,
        limit: 10,
        windowSec: 300,
      });
      if (!byIp.ok || !byPhone.ok) {
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
                Math.max(byIp.retryAfterSec, byPhone.retryAfterSec),
              ),
            },
          },
        );
      }
      const { userId, result } = await loginUserByPhonePassword({
        phone,
        password: body.password || "",
        context: { ...context, method: "password" },
      });
      resetRateLimit(`login:phone:${phone}`);
      await recordLoginEvent({
        userId,
        method: "password",
        success: true,
        ip,
        userAgent,
      });
      return NextResponse.json(result);
    }

    const code = String(body.code || "").trim();
    if (!/^\d{4,8}$/.test(code)) {
      return NextResponse.json({ error: "请填写短信验证码" }, { status: 400 });
    }

    const purpose = body.mode === "register" ? "register" : "login";
    const ok =
      (await verifySmsCode({ phone, code, purpose })) ||
      (purpose === "register" &&
        (await verifySmsCode({ phone, code, purpose: "login" })));
    if (!ok) {
      await recordLoginEvent({
        method: "sms",
        success: false,
        reason: "bad_code",
        ip,
        userAgent,
      });
      return NextResponse.json(
        { error: "验证码错误或已过期" },
        { status: 400 },
      );
    }

    if (body.mode === "register" && !(body.name || "").trim()) {
      return NextResponse.json({ error: "请填写昵称" }, { status: 400 });
    }

    const { userId, result } = await findOrCreateUserByPhone({
      phone,
      name: body.name,
      password: body.password || undefined,
      referralCode: body.referralCode,
      requestedRole: body.requestedRole,
      mode: body.mode,
      context: { ...context, method: "sms" },
    });
    await recordLoginEvent({
      userId,
      method: "sms",
      success: true,
      ip,
      userAgent,
    });
    return NextResponse.json(result);
  } catch (error) {
    await recordLoginEvent({
      method: "sms",
      success: false,
      reason: "error",
      ip,
      userAgent,
    });
    const message =
      error instanceof Error ? error.message : "登录失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

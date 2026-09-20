/**
 * POST /api/studio/settings/sms-test
 * 站长试发一条验证码到自己的手机，确认能收到短信。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { sendSmsCode } from "@andyyyds/shared/sms";
import { requireAdmin, studioErrorResponse } from "@andyyyds/shared/studio";

const schema = z.object({
  phone: z.string().min(6).max(20),
  purpose: z.enum(["login", "register", "bind"]).optional().default("login"),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = schema.parse(await req.json());
    const result = await sendSmsCode({
      phone: body.phone,
      purpose: body.purpose,
    });
    return NextResponse.json({
      ok: true,
      cooldownSec: result.cooldownSec,
      testMode: result.testMode,
      message: result.testMode
        ? "当前仍是测试模式：验证码已写服务器日志，不会发到手机。关闭测试模式并配好阿里云后才会真发短信。"
        : "验证码已发送到该手机，请查收短信。",
    });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    if (mapped.status === 500 && error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

/**
 * POST /api/auth/account
 * body: { username, password, mode?, name?, referralCode?, requestedRole? }
 *
 * 账号或 kk 号 + 密码注册/登录（与邮箱通道分开，不接受邮箱当地址）。
 * kind=kk 只认数字 kk 号；kind=username 只认自设账号。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  loginUserByUsername,
  registerUserByUsername,
} from "@andyyyds/shared/auth-providers";
import { APPLYABLE_ROLES } from "@andyyyds/shared/roles";

const schema = z.object({
  username: z.string().max(40).optional().default(""),
  password: z.string().min(6).max(100),
  kind: z.enum(["kk", "username", "any"]).optional().default("any"),
  mode: z.enum(["login", "register"]).optional().default("login"),
  name: z.string().max(40).optional(),
  referralCode: z.string().max(32).optional(),
  requestedRole: z.enum(APPLYABLE_ROLES).optional().default("STUDENT"),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const mode = body.mode || "login";

    if (mode === "login" && !String(body.username || "").trim()) {
      return NextResponse.json(
        {
          error:
            body.kind === "kk"
              ? "请填写 kk 号"
              : body.kind === "username"
                ? "请填写自设账号"
                : "请填写 kk 号或自设账号",
        },
        { status: 400 },
      );
    }

    if (mode === "register") {
      const { result } = await registerUserByUsername({
        username: body.username || undefined,
        password: body.password,
        name: body.name || "",
        referralCode: body.referralCode,
        requestedRole: body.requestedRole,
      });
      return NextResponse.json(result);
    }

    const { result } = await loginUserByUsername({
      username: body.username,
      password: body.password,
      kind: body.kind,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "操作失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

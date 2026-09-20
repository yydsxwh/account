import { NextResponse } from "next/server";
import { destroySession } from "@andyyyds/shared/auth";
import { resolveLogoutNext } from "@andyyyds/shared/first-party-url";
import { getPublicSiteUrl } from "@andyyyds/shared/payments";
import { getRequestPublicOrigin } from "@andyyyds/shared/request-origin";

export const dynamic = "force-dynamic";

async function readLogoutNext(req: Request): Promise<string | null> {
  const url = new URL(req.url);
  let next = url.searchParams.get("next");
  const contentType = req.headers.get("content-type") || "";
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    try {
      const form = await req.formData();
      const fromForm = String(form.get("next") || "").trim();
      if (fromForm) next = fromForm;
    } catch {
      // 表单读失败仍用 query；不能因此卡死退出
    }
  }
  return next;
}

async function finishLogout(req: Request, next: string | null) {
  await destroySession();
  const origin =
    getRequestPublicOrigin(req) || (await getPublicSiteUrl());
  const dest = resolveLogoutNext(next, origin);
  return NextResponse.redirect(dest, { status: 303 });
}

/**
 * 退出账号中心会话（会连带吊销该会话发出的 OAuth 令牌）。
 * 可选 next：只接受第一方 / localhost，主站统一退出后可跳回原站。
 *
 * GET 给主站等第一方做顶层跳转：SameSite=Lax Cookie 只在顶层 GET 跨站时带上，
 * 跨站 POST 带不上，所以 RP 退出必须走 GET，而不是跨域表单 POST。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  return finishLogout(req, url.searchParams.get("next"));
}

export async function POST(req: Request) {
  return finishLogout(req, await readLogoutNext(req));
}

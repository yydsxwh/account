/**
 * GET /api/auth/continue?to=https://www.yydsxwh.com/...
 * 登录后跳回主站。只允许第一方域名。
 */

import { NextResponse } from "next/server";
import { safeNextTarget } from "@andyyyds/shared/first-party-url";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dest = safeNextTarget(url.searchParams.get("to"));
  if (!dest || dest.startsWith("/")) {
    return NextResponse.redirect(new URL("/account", url.origin));
  }
  return NextResponse.redirect(dest);
}

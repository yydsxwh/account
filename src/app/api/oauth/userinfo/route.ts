/**
 * GET /api/oauth/userinfo
 * Authorization: Bearer <access_token>
 */

import { NextResponse } from "next/server";
import { getUserByAccessToken } from "@andyyyds/shared/oauth";
import { resolveStoredAccessUrl } from "@andyyyds/shared/storage";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const header = req.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  if (!token) {
    return NextResponse.json({ error: "缺少访问令牌" }, { status: 401 });
  }
  const found = await getUserByAccessToken(token);
  if (!found) {
    return NextResponse.json({ error: "令牌无效或已过期" }, { status: 401 });
  }
  const avatarUrl = found.user.avatarUrl
    ? await resolveStoredAccessUrl(found.user.avatarUrl)
    : "";
  return NextResponse.json({
    clientId: found.clientId,
    user: { ...found.user, avatarUrl },
  });
}

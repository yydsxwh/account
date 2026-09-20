/**
 * GET|POST /api/oauth/userinfo
 * Authorization: Bearer <access_token>
 *
 * 返回 OIDC 标准 claim（sub、name、email…），按 access token 的 scope 裁剪。
 * 为兼容已上线的产品，额外保留 user / clientId 两个旧字段。
 */

import { NextResponse } from "next/server";
import { buildUserClaims } from "@andyyyds/shared/oidc/claims";
import { resolveAccessToken } from "@andyyyds/shared/oidc/server";
import { getClaimsUserById } from "@andyyyds/shared/identity/users";
import { resolveStoredAccessUrl } from "@andyyyds/shared/storage";
import { toPublicUser } from "@andyyyds/shared/oauth";

export const dynamic = "force-dynamic";

function unauthorized(description: string) {
  return NextResponse.json(
    { error: "invalid_token", error_description: description },
    {
      status: 401,
      headers: {
        // HTTP 头只能放 latin-1，中文说明留在 body 里
        "WWW-Authenticate": 'Bearer error="invalid_token"',
        "Cache-Control": "no-store",
      },
    },
  );
}

async function handle(req: Request) {
  const header = req.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  if (!token) return unauthorized("缺少访问令牌");

  const grant = await resolveAccessToken(token);
  if (!grant) return unauthorized("令牌无效或已过期");

  const user = await getClaimsUserById(grant.userId);
  if (!user) return unauthorized("用户不存在");

  const avatarUrl = user.avatarUrl
    ? await resolveStoredAccessUrl(user.avatarUrl)
    : "";
  const claims = buildUserClaims({ user, scope: grant.scope, avatarUrl });

  return NextResponse.json(
    {
      ...claims,
      // 旧字段，勿在新产品里使用
      clientId: grant.clientId,
      user: { ...toPublicUser(user), avatarUrl },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

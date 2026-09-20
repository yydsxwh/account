/**
 * POST /api/oauth/revoke（RFC 7009）
 * token=&token_type_hint=access_token|refresh_token
 *
 * 按规范：令牌不存在也返回 200，否则这个接口就变成了令牌有效性探测器。
 */

import { NextResponse } from "next/server";
import { parseBasicClientAuth } from "@andyyyds/shared/oidc/clients";
import { toOAuthErrorBody } from "@andyyyds/shared/oidc/errors";
import { revokeToken } from "@andyyyds/shared/oidc/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    const params: Record<string, string> = {};
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as Record<string, unknown>;
      for (const [key, value] of Object.entries(body || {})) {
        if (typeof value === "string") params[key] = value;
      }
    } else {
      const form = await req.formData();
      for (const [key, value] of form.entries()) {
        if (typeof value === "string") params[key] = value;
      }
    }

    const basic = parseBasicClientAuth(req.headers.get("authorization"));
    await revokeToken({
      clientId: basic?.clientId || params.client_id || "",
      clientSecret: basic?.clientSecret || params.client_secret || "",
      token: params.token || "",
      tokenTypeHint: params.token_type_hint || undefined,
    });

    return new NextResponse(null, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const mapped = toOAuthErrorBody(error);
    return NextResponse.json(mapped.body, {
      status: mapped.status,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

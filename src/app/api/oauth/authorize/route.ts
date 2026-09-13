/**
 * GET /api/oauth/authorize?client_id=&redirect_uri=&state=
 * 已登录：签发一次性 code 并跳回产品。
 * 未登录：带到账号中心登录页，登完再回到这里。
 */

import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import {
  buildLoginWithProductPath,
  createAuthorizationCode,
  findEnabledClient,
  isAllowedRedirectUri,
} from "@andyyyds/shared/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = (url.searchParams.get("client_id") || "").trim();
  const redirectUri = (url.searchParams.get("redirect_uri") || "").trim();
  const state = (url.searchParams.get("state") || "").trim();

  const client = await findEnabledClient(clientId);
  if (!client || !isAllowedRedirectUri(client, redirectUri, url.origin)) {
    return NextResponse.json(
      { error: "未知产品或回调地址未登记。请站长在「软件产品」里配置。" },
      { status: 400 },
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(
      new URL(
        buildLoginWithProductPath({
          clientId,
          redirectUri,
          state: state || undefined,
        }),
        url.origin,
      ),
    );
  }

  const code = await createAuthorizationCode({
    clientId: client.clientId,
    userId: session.id,
    redirectUri,
  });
  const dest = new URL(redirectUri);
  dest.searchParams.set("code", code);
  if (state) dest.searchParams.set("state", state);
  return NextResponse.redirect(dest.toString());
}

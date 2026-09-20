/**
 * OIDC Discovery 文档。
 * 对外地址是 /.well-known/openid-configuration，由 next.config.ts 里的 rewrite 指过来
 * （App Router 不会把以点开头的目录当路由，所以真实路径放在 /api/oidc 下）。
 */

import { NextResponse } from "next/server";
import { getEndpoints, getIssuer } from "@andyyyds/shared/oidc/issuer";
import { KNOWN_SCOPES } from "@andyyyds/shared/oidc/scopes";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const issuer = getIssuer(req);
  const endpoints = getEndpoints(issuer);

  return NextResponse.json(
    {
      ...endpoints,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      scopes_supported: KNOWN_SCOPES,
      token_endpoint_auth_methods_supported: [
        "client_secret_basic",
        "client_secret_post",
        "none",
      ],
      code_challenge_methods_supported: ["S256"],
      claims_supported: [
        "sub",
        "iss",
        "aud",
        "exp",
        "iat",
        "auth_time",
        "nonce",
        "sid",
        "name",
        "nickname",
        "preferred_username",
        "picture",
        "locale",
        "zoneinfo",
        "updated_at",
        "email",
        "email_verified",
        "phone_number",
        "phone_number_verified",
        "kk_number",
        "username",
        "role",
        "roles",
      ],
      // 第一方产品，不出同意页
      require_request_uri_registration: false,
      service_documentation: `${issuer}/integrate`,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "Content-Type": "application/json",
      },
    },
  );
}

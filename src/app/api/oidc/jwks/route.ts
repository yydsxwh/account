/**
 * JWKS：ID Token 的验签公钥。
 * 对外地址是 /.well-known/jwks.json（next.config.ts 的 rewrite）。
 * 只吐公钥，私钥永远不出这台机器。
 */

import { NextResponse } from "next/server";
import { listPublicJwks } from "@andyyyds/shared/oidc/keys";

export const dynamic = "force-dynamic";

export async function GET() {
  const keys = await listPublicJwks();
  return NextResponse.json(
    { keys },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "Content-Type": "application/jwk-set+json",
      },
    },
  );
}

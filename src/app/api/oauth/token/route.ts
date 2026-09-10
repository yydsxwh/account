/**
 * POST /api/oauth/token
 * 产品服务端：用 client_id + client_secret + code 换用户。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { exchangeAuthorizationCode } from "@andyyyds/shared/oauth";

export const dynamic = "force-dynamic";

const schema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  code: z.string().min(1),
  redirect_uri: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const result = await exchangeAuthorizationCode({
      clientId: body.client_id,
      clientSecret: body.client_secret,
      code: body.code,
      redirectUri: body.redirect_uri,
      accountOrigin: new URL(req.url).origin,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "换取用户失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DEMO_PRODUCTS, demoClientSecret } from "@/helpers/demo-product";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const siteUrl = new URL(req.url).origin;
  const spec = DEMO_PRODUCTS.shop;
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const redirectUri = `${siteUrl}${spec.callback}`;
  if (!code) {
    return NextResponse.redirect(`${siteUrl}${spec.path}`);
  }

  const tokenRes = await fetch(`${siteUrl}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: spec.clientId,
      client_secret: demoClientSecret("shop"),
      code,
      redirect_uri: redirectUri,
    }),
  });
  const data = (await tokenRes.json()) as {
    error?: string;
    user?: { id: string; name: string; email: string; role: string };
  };
  if (!tokenRes.ok || !data.user) {
    return NextResponse.redirect(
      `${siteUrl}${spec.path}?error=${encodeURIComponent(data.error || "登录失败")}`,
    );
  }

  const jar = await cookies();
  jar.set(spec.cookie, JSON.stringify(data.user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return NextResponse.redirect(`${siteUrl}${spec.path}`);
}

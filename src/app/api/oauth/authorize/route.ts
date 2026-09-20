/**
 * GET /api/oauth/authorize
 *
 * OAuth 2.0 Authorization Code + PKCE（RFC 6749 / RFC 7636 / OIDC Core）。
 * 参数：response_type=code、client_id、redirect_uri、scope、state、nonce、
 *      code_challenge、code_challenge_method=S256
 *
 * 未登录：带着完整的原始查询串跳到 /login，登完原样跳回来，
 *        这样 scope / nonce / PKCE 一个都不会丢。
 *
 * 全部是第一方产品，不出授权同意页，直接放行并记一条安全事件。
 */

import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import { OAuthError } from "@andyyyds/shared/oidc/errors";
import { getIssuer } from "@andyyyds/shared/oidc/issuer";
import {
  issueAuthorizationCode,
  validateAuthorizationRequest,
} from "@andyyyds/shared/oidc/server";
import { formatScope } from "@andyyyds/shared/oidc/scopes";
import { recordSecurityEvent } from "@andyyyds/shared/security/events";
import { clientIpFromRequest } from "@andyyyds/shared/identity/rate-limit";

export const dynamic = "force-dynamic";

function errorPage(message: string, status: number) {
  return new NextResponse(
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8">` +
      `<title>授权失败 · 账号中心</title>` +
      `<body style="font-family:system-ui;padding:40px;max-width:640px;margin:0 auto">` +
      `<h1 style="font-size:20px">授权失败</h1>` +
      `<p style="color:#555">${escapeHtml(message)}</p>` +
      `<p style="color:#888;font-size:13px">请让产品开发者在账号中心「软件产品」里核对 client_id 与回调地址。</p>` +
      `</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 参数没问题但授权不成立时，按规范把错误带回 redirect_uri */
function redirectWithError(
  redirectUri: string,
  error: string,
  description: string,
  state: string,
) {
  const dest = new URL(redirectUri);
  dest.searchParams.set("error", error);
  dest.searchParams.set("error_description", description);
  if (state) dest.searchParams.set("state", state);
  return NextResponse.redirect(dest.toString());
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = url.searchParams;
  // 反代后 req.url 是内网监听地址，拼跳转和比对同域回调都得用对外地址
  const accountOrigin = getIssuer(req);

  let request;
  try {
    request = await validateAuthorizationRequest({
      clientId: params.get("client_id") || "",
      redirectUri: params.get("redirect_uri") || "",
      responseType: params.get("response_type") || "code",
      scope: params.get("scope") || "",
      state: params.get("state") || "",
      nonce: params.get("nonce") || "",
      codeChallenge: params.get("code_challenge") || "",
      codeChallengeMethod: params.get("code_challenge_method") || "",
      accountOrigin,
    });
  } catch (error) {
    if (error instanceof OAuthError) {
      // redirect_uri 本身不可信时绝不跳转，否则就是开放重定向。
      // 这里是给人看的网页，固定 400：401 会让浏览器弹出 Basic 认证框
      if (error.fatal) return errorPage(error.message, 400);
      return redirectWithError(
        params.get("redirect_uri") || "",
        error.code,
        error.message,
        params.get("state") || "",
      );
    }
    console.error("[oauth/authorize]", error);
    return errorPage("服务暂时不可用", 500);
  }

  const session = await getSession();
  if (!session) {
    const login = new URL("/login", accountOrigin);
    // 原样带回本请求，登录后无损续跑
    login.searchParams.set("next", `${url.pathname}${url.search}`);
    login.searchParams.set("client_id", request.client.clientId);
    return NextResponse.redirect(login.toString());
  }

  const code = await issueAuthorizationCode({
    request,
    userId: session.id,
    sessionId: session.sessionId,
  });

  await recordSecurityEvent({
    userId: session.id,
    type: "client_authorized",
    detail: `${request.client.clientId} · ${formatScope(request.scopes)}`,
    ip: clientIpFromRequest(req),
  });

  const dest = new URL(request.redirectUri);
  dest.searchParams.set("code", code);
  if (request.state) dest.searchParams.set("state", request.state);
  return NextResponse.redirect(dest.toString());
}

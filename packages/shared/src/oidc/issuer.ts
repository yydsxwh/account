/**
 * issuer 必须是一个固定不变的字符串，产品会拿它比对 ID Token 的 iss。
 * 优先级：OIDC_ISSUER > NEXT_PUBLIC_SITE_URL > 请求 origin（仅本地开发兜底）。
 */

import { getRequestPublicOrigin } from "../request-origin";

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getIssuer(req?: Request): string {
  const configured =
    process.env.OIDC_ISSUER?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return trimSlash(configured);
  const fromRequest = req ? getRequestPublicOrigin(req) : null;
  if (fromRequest) return trimSlash(fromRequest);
  return "http://localhost:3000";
}

export type OidcEndpoints = ReturnType<typeof getEndpoints>;

export function getEndpoints(issuer: string) {
  const base = trimSlash(issuer);
  return {
    issuer: base,
    authorization_endpoint: `${base}/api/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    userinfo_endpoint: `${base}/api/oauth/userinfo`,
    revocation_endpoint: `${base}/api/oauth/revoke`,
    jwks_uri: `${base}/.well-known/jwks.json`,
    end_session_endpoint: `${base}/api/auth/logout`,
  };
}

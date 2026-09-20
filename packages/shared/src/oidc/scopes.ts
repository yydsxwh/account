/**
 * Scope 体系。
 *
 * 产品只能拿到自己被登记允许的 scope；请求里多写的会被丢掉，不会自动放行。
 * 现在真正生效的是 openid / profile / email / phone / account.basic。
 * entitlements.read 等先登记名字，等 Billing / Entitlements 落地再接权限判断。
 */

export const SCOPE_OPENID = "openid";

/** 已实现、会真正影响返回内容的 scope */
export const SUPPORTED_SCOPES = [
  SCOPE_OPENID,
  "profile",
  "email",
  "phone",
  "offline_access",
  "account.basic",
] as const;

/** 已登记但功能尚未实现，先占住名字避免以后语义冲突 */
export const RESERVED_SCOPES = [
  "entitlements.read",
  "billing.read",
] as const;

export const KNOWN_SCOPES: readonly string[] = [
  ...SUPPORTED_SCOPES,
  ...RESERVED_SCOPES,
];

export const DEFAULT_CLIENT_SCOPES = "openid profile email";

export function parseScope(raw: string | null | undefined): string[] {
  return String(raw || "")
    .split(/[\s+]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatScope(scopes: readonly string[]): string {
  return dedupe(scopes).join(" ");
}

function dedupe(scopes: readonly string[]): string[] {
  const out: string[] = [];
  for (const scope of scopes) {
    if (scope && !out.includes(scope)) out.push(scope);
  }
  return out;
}

/**
 * 求「请求的 scope」与「产品被允许的 scope」的交集。
 * 请求为空时退回产品允许集合，符合 OAuth 2.0 对缺省 scope 的处理。
 */
export function resolveGrantedScopes(input: {
  requested: string | null | undefined;
  allowed: string | null | undefined;
}): { granted: string[]; rejected: string[] } {
  const allowed = dedupe(parseScope(input.allowed));
  const requested = dedupe(parseScope(input.requested));
  if (requested.length === 0) {
    return { granted: allowed, rejected: [] };
  }
  const granted = requested.filter((scope) => allowed.includes(scope));
  const rejected = requested.filter((scope) => !allowed.includes(scope));
  return { granted, rejected };
}

export function hasScope(
  granted: string | readonly string[] | null | undefined,
  wanted: string,
): boolean {
  const list = Array.isArray(granted)
    ? (granted as readonly string[])
    : parseScope(granted as string);
  return list.includes(wanted);
}

/** OIDC 要求 openid 在场才算身份请求；没有它只是普通 OAuth 授权 */
export function isOpenIdRequest(scopes: readonly string[]): boolean {
  return scopes.includes(SCOPE_OPENID);
}

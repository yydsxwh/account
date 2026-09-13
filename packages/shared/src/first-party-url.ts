/** 账号中心与主站、apex 之间允许互相跳回，避免开放重定向。 */

export const WWW_HOME_URL = "https://www.yydsxwh.com";

const FIRST_PARTY_HOSTS = new Set([
  "account.yydsxwh.com",
  "www.yydsxwh.com",
  "yydsxwh.com",
]);

export function isFirstPartyHost(host: string): boolean {
  return FIRST_PARTY_HOSTS.has(host.toLowerCase());
}

function isAbsoluteHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

/** 站内相对路径，或 https://www|account|apex.yydsxwh.com/... */
export function safeNextTarget(raw: string | null | undefined): string | null {
  const value = (raw || "").trim();
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) {
    const pathOnly = value.split("?")[0] || "";
    if (pathOnly.includes("://")) return null;
    return value.slice(0, 1500);
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!isFirstPartyHost(url.hostname)) return null;
    if (url.username || url.password) return null;
    return url.toString().slice(0, 1500);
  } catch {
    return null;
  }
}

/** 微信 OAuth 的 returnUrl 只能是站内路径；绝对地址包一层 continue。 */
export function wechatReturnPath(raw: string | null | undefined, fallback = "/"): string {
  const safe = safeNextTarget(raw);
  if (!safe) return fallback;
  if (isAbsoluteHttpUrl(safe)) {
    return `/api/auth/continue?to=${encodeURIComponent(safe)}`;
  }
  return safe;
}

export function keepNextHref(path: "/login" | "/register", next?: string | null): string {
  const safe = safeNextTarget(next);
  if (!safe) return path;
  return `${path}?next=${encodeURIComponent(safe)}`;
}

export function toAbsoluteSiteUrl(pathOrUrl: string, siteOrigin: string): string {
  const safe = safeNextTarget(pathOrUrl);
  if (!safe) return siteOrigin;
  if (isAbsoluteHttpUrl(safe)) return safe;
  return `${siteOrigin.replace(/\/$/, "")}${safe}`;
}

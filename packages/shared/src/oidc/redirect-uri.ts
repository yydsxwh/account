/**
 * redirect_uri 校验。
 *
 * 只做精确匹配。不支持通配符、不支持前缀匹配、不支持"同域就放行"，
 * 因为这几种写法都能被改造成开放重定向，把授权码送到攻击者手上。
 *
 * 明文 http 只允许 localhost / 127.0.0.1（本地开发）。线上一律 https。
 */

export function parseUriList(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    return (raw || "")
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

export function serializeUriList(items: string[]): string {
  return JSON.stringify(items.map((item) => item.trim()).filter(Boolean));
}

function isLoopback(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/**
 * 归一化成可比较的字符串。不合法直接返回空串。
 * 去掉 fragment（RFC 6749 §3.1.2 明确禁止），其余原样保留。
 */
export function normalizeRedirectUri(raw: string): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (value.includes("*")) return "";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "";
  if (url.protocol === "http:" && !isLoopback(url.hostname)) return "";
  if (url.username || url.password) return "";
  if (url.hash) return "";
  url.hash = "";
  return url.toString();
}

/** 登记时用：把站长填的地址检一遍，不合法就告诉他为什么 */
export function validateRegisteredRedirectUri(
  raw: string,
): { ok: true; uri: string } | { ok: false; error: string } {
  const value = String(raw || "").trim();
  if (!value) return { ok: false, error: "回调地址不能为空" };
  // 账号中心自身的相对回调（内置 demo 产品用）
  if (value.startsWith("/") && !value.startsWith("//")) {
    if (value.includes("*")) return { ok: false, error: "回调地址不能带通配符" };
    return { ok: true, uri: value };
  }
  if (value.includes("*")) {
    return { ok: false, error: "回调地址不能带通配符，请写完整地址" };
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "回调地址必须是完整的 https 地址" };
  }
  if (url.protocol === "http:" && !isLoopback(url.hostname)) {
    return { ok: false, error: "线上回调地址必须用 https" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "回调地址只支持 http(s)" };
  }
  if (url.hash) {
    return { ok: false, error: "回调地址不能带 # 片段" };
  }
  return { ok: true, uri: normalizeRedirectUri(value) || value };
}

export type RedirectUriOwner = {
  redirectUris: string;
};

/**
 * @param accountOrigin 账号中心自己的 origin，只用于解析内置 demo 产品的相对回调
 */
export function isAllowedRedirectUri(
  client: RedirectUriOwner,
  redirectUri: string,
  accountOrigin?: string,
): boolean {
  const wanted = normalizeRedirectUri(redirectUri);
  if (!wanted) return false;
  let wantedUrl: URL;
  try {
    wantedUrl = new URL(wanted);
  } catch {
    return false;
  }

  return parseUriList(client.redirectUris).some((allowed) => {
    const trimmed = allowed.trim();
    if (!trimmed || trimmed.includes("*")) return false;
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
      if (!accountOrigin) return false;
      try {
        const account = new URL(accountOrigin);
        if (wantedUrl.origin !== account.origin) return false;
        const expected = new URL(trimmed, account.origin);
        return (
          wantedUrl.pathname === expected.pathname &&
          wantedUrl.search === expected.search
        );
      } catch {
        return false;
      }
    }
    return normalizeRedirectUri(trimmed) === wanted;
  });
}

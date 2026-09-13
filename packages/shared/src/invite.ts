/**
 * 邀请链接拼装：注册页与首页均可带 ?ref=邀请码
 */

export function siteBaseUrl(fallback = "http://localhost:3000") {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    fallback
  ).replace(/\/$/, "");
}

export function inviteRegisterUrl(code: string, base?: string) {
  const root = (base || siteBaseUrl()).replace(/\/$/, "");
  return `${root}/register?ref=${encodeURIComponent(code)}`;
}

export function inviteHomeUrl(code: string, base?: string) {
  const root = (base || siteBaseUrl()).replace(/\/$/, "");
  return `${root}/?ref=${encodeURIComponent(code)}`;
}

export const REFERRAL_STORAGE_KEY = "yyds_ref";

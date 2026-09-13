/**
 * 微信 OAuth（登录用）：公众号网页授权 / 网站扫码 / 移动应用 SDK。
 * 从 Andyyyds wechat-pay.ts 抽出授权相关函数，不含支付下单。
 */

import { getSiteSettings } from "./site-settings";

export async function getWechatOAuthConfig(): Promise<{
  appId: string;
  appSecret: string;
} | null> {
  const settings = await getSiteSettings();
  const appId = settings.wechatAppId || process.env.WECHAT_APP_ID || "";
  const appSecret =
    settings.wechatAppSecret || process.env.WECHAT_APP_SECRET || "";
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

export async function isWechatOAuthConfigured() {
  return Boolean(await getWechatOAuthConfig());
}

export async function getWechatWebOAuthConfig(): Promise<{
  appId: string;
  appSecret: string;
} | null> {
  const settings = await getSiteSettings();
  const appId = settings.wechatWebAppId || process.env.WECHAT_WEB_APP_ID || "";
  const appSecret =
    settings.wechatWebAppSecret || process.env.WECHAT_WEB_APP_SECRET || "";
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

export async function isWechatWebOAuthConfigured() {
  return Boolean(await getWechatWebOAuthConfig());
}

export async function getWechatMobileOAuthConfig() {
  const settings = await getSiteSettings();
  const appId = (
    settings.wechatMobileAppId ||
    process.env.WECHAT_MOBILE_APP_ID ||
    ""
  ).trim();
  const appSecret = (
    settings.wechatMobileAppSecret ||
    process.env.WECHAT_MOBILE_APP_SECRET ||
    ""
  ).trim();
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

export async function isWechatMobileOAuthConfigured() {
  return Boolean(await getWechatMobileOAuthConfig());
}

export async function exchangeWechatOAuthCode(
  code: string,
  channel: "oa" | "web" | "mobile" = "oa",
) {
  const oauth =
    channel === "web"
      ? await getWechatWebOAuthConfig()
      : channel === "mobile"
        ? await getWechatMobileOAuthConfig()
        : await getWechatOAuthConfig();
  if (!oauth) {
    throw new Error(
      channel === "web"
        ? "未配置开放平台网站应用 AppSecret，无法完成扫码登录"
        : channel === "mobile"
          ? "未配置开放平台移动应用 AppSecret，无法完成 App 微信登录"
          : "未配置微信 AppSecret，无法完成网页授权",
    );
  }
  const url = new URL("https://api.weixin.qq.com/sns/oauth2/access_token");
  url.searchParams.set("appid", oauth.appId);
  url.searchParams.set("secret", oauth.appSecret);
  url.searchParams.set("code", code);
  url.searchParams.set("grant_type", "authorization_code");
  const res = await fetch(url.toString(), { cache: "no-store" });
  const data = (await res.json()) as {
    access_token?: string;
    openid?: string;
    unionid?: string;
    scope?: string;
    errcode?: number;
    errmsg?: string;
  };
  if (!data.openid) {
    throw new Error(
      data.errmsg || `微信授权失败${data.errcode ? ` (${data.errcode})` : ""}`,
    );
  }
  return {
    accessToken: data.access_token || "",
    openid: data.openid,
    unionid: data.unionid || "",
    scope: data.scope || "",
  };
}

export async function fetchWechatUserInfo(input: {
  accessToken: string;
  openid: string;
}): Promise<{ nickname: string; headimgurl: string }> {
  const token = input.accessToken.trim();
  const openid = input.openid.trim();
  if (!token || !openid) {
    return { nickname: "", headimgurl: "" };
  }
  const url = new URL("https://api.weixin.qq.com/sns/userinfo");
  url.searchParams.set("access_token", token);
  url.searchParams.set("openid", openid);
  url.searchParams.set("lang", "zh_CN");
  const res = await fetch(url.toString(), { cache: "no-store" });
  const data = (await res.json()) as {
    nickname?: string;
    headimgurl?: string;
    errcode?: number;
    errmsg?: string;
  };
  if (data.errcode) {
    throw new Error(data.errmsg || `获取微信资料失败 (${data.errcode})`);
  }
  return {
    nickname: (data.nickname || "").trim().slice(0, 40),
    headimgurl: (data.headimgurl || "")
      .trim()
      .replace(/^http:\/\//i, "https://"),
  };
}

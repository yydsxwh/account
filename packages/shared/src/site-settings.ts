/**
 * 站点级配置读写（短信 / 微信授权）
 */

import { prisma } from "./db";
import { isSmsLoginReady, resolveSmsRuntime } from "./sms-config";

export type SiteSettingsRow = {
  id: string;
  siteUrl: string;
  wechatAppId: string;
  wechatAppSecret: string;
  wechatWebAppId: string;
  wechatWebAppSecret: string;
  wechatMobileAppId: string;
  wechatMobileAppSecret: string;
  smsEnabled: boolean;
  smsProvider: string;
  smsAccessKeyId: string;
  smsAccessKeySecret: string;
  smsSignName: string;
  smsTemplateCode: string;
  smsTemplateCodeLogin: string;
  smsTemplateCodeRegister: string;
  smsTemplateCodeBind: string;
  smsTestMode: boolean;
  smsTestFixedCode: string;
  updatedAt: Date;
};

let cache: { at: number; row: SiteSettingsRow } | null = null;
const CACHE_MS = 5000;

export function invalidateSiteSettingsCache() {
  cache = null;
}

export async function getSiteSettings(): Promise<SiteSettingsRow> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return cache.row;
  }
  const row = await prisma.siteSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      smsEnabled: true,
      smsProvider: "test",
      smsTestMode: true,
      smsTestFixedCode: "123456",
    },
    update: {},
  });
  cache = { at: Date.now(), row };
  return row;
}

export function maskSecret(value: string, keep = 4) {
  if (!value) return "";
  if (value.length <= keep) return "*".repeat(value.length);
  return `${"*".repeat(Math.min(12, value.length - keep))}${value.slice(-keep)}`;
}

export function isMaskedPlaceholder(value: string | undefined) {
  if (!value) return true;
  return /^\*+[^*]{0,8}$/.test(value) || value === "(unchanged)";
}

export function publicSiteSettings(row: SiteSettingsRow) {
  const sms = resolveSmsRuntime(row);
  return {
    siteUrl: row.siteUrl,
    wechatAppId: row.wechatAppId,
    wechatAppSecret: row.wechatAppSecret ? maskSecret(row.wechatAppSecret) : "",
    wechatWebAppId: row.wechatWebAppId,
    wechatWebAppSecret: row.wechatWebAppSecret
      ? maskSecret(row.wechatWebAppSecret)
      : "",
    wechatMobileAppId: row.wechatMobileAppId || "",
    wechatMobileAppSecret: row.wechatMobileAppSecret
      ? maskSecret(row.wechatMobileAppSecret)
      : "",
    wechatOauthConfigured: Boolean(
      row.wechatAppId && (row.wechatAppSecret || process.env.WECHAT_APP_SECRET),
    ),
    wechatWebOauthConfigured: Boolean(
      (row.wechatWebAppId || process.env.WECHAT_WEB_APP_ID) &&
        (row.wechatWebAppSecret || process.env.WECHAT_WEB_APP_SECRET),
    ),
    wechatMobileOauthConfigured: Boolean(
      (row.wechatMobileAppId || process.env.WECHAT_MOBILE_APP_ID) &&
        (row.wechatMobileAppSecret || process.env.WECHAT_MOBILE_APP_SECRET),
    ),
    smsEnabled: Boolean(row.smsEnabled),
    smsProvider: row.smsProvider || "test",
    smsAccessKeyId: row.smsAccessKeyId || "",
    smsAccessKeySecret: row.smsAccessKeySecret
      ? maskSecret(row.smsAccessKeySecret)
      : "",
    smsSignName: row.smsSignName || sms.signName || "",
    smsTemplateCode: row.smsTemplateCode || sms.templateCode || "",
    smsTemplateCodeLogin:
      row.smsTemplateCodeLogin || sms.templateCodeLogin || "",
    smsTemplateCodeRegister:
      row.smsTemplateCodeRegister || sms.templateCodeRegister || "",
    smsTemplateCodeBind:
      row.smsTemplateCodeBind || sms.templateCodeBind || "",
    smsTestMode: sms.testMode,
    smsTestFixedCode: row.smsTestFixedCode || "",
    smsAliyunReady: sms.aliyunReady,
    smsEnvConfigured: sms.usingEnvKeys,
    smsLoginReady: isSmsLoginReady(row),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function pickSecretUpdate(
  incoming: string | undefined,
  current: string,
): string | undefined {
  if (incoming === undefined) return undefined;
  const trimmed = incoming.trim();
  if (!trimmed || isMaskedPlaceholder(trimmed)) return undefined;
  return trimmed.replace(/\\n/g, "\n");
}

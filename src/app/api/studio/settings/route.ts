import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@andyyyds/shared/db";
import {
  getSiteSettings,
  invalidateSiteSettingsCache,
  pickSecretUpdate,
  publicSiteSettings,
} from "@andyyyds/shared/site-settings";
import { requireAdmin, studioErrorResponse } from "@andyyyds/shared/studio";

export async function GET() {
  try {
    await requireAdmin();
    const row = await getSiteSettings();
    return NextResponse.json({ settings: publicSiteSettings(row) });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

const schema = z.object({
  siteUrl: z.string().max(200).optional(),
  wechatAppId: z.string().max(80).optional(),
  wechatAppSecret: z.string().max(200).optional(),
  wechatWebAppId: z.string().max(80).optional(),
  wechatWebAppSecret: z.string().max(200).optional(),
  wechatMobileAppId: z.string().max(80).optional(),
  wechatMobileAppSecret: z.string().max(200).optional(),
  smsEnabled: z.boolean().optional(),
  smsProvider: z.enum(["test", "aliyun"]).optional(),
  smsAccessKeyId: z.string().max(80).optional(),
  smsAccessKeySecret: z.string().max(200).optional(),
  smsSignName: z.string().max(40).optional(),
  smsTemplateCode: z.string().max(40).optional(),
  smsTestMode: z.boolean().optional(),
  smsTestFixedCode: z.string().max(8).optional(),
});

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const body = schema.parse(await req.json());
    const current = await getSiteSettings();
    const updated = await prisma.siteSettings.update({
      where: { id: "default" },
      data: {
        siteUrl: body.siteUrl?.trim() ?? current.siteUrl,
        wechatAppId: body.wechatAppId?.trim() ?? current.wechatAppId,
        wechatAppSecret:
          pickSecretUpdate(body.wechatAppSecret, current.wechatAppSecret) ??
          current.wechatAppSecret,
        wechatWebAppId: body.wechatWebAppId?.trim() ?? current.wechatWebAppId,
        wechatWebAppSecret:
          pickSecretUpdate(body.wechatWebAppSecret, current.wechatWebAppSecret) ??
          current.wechatWebAppSecret,
        wechatMobileAppId:
          body.wechatMobileAppId?.trim() ?? current.wechatMobileAppId,
        wechatMobileAppSecret:
          pickSecretUpdate(
            body.wechatMobileAppSecret,
            current.wechatMobileAppSecret,
          ) ?? current.wechatMobileAppSecret,
        smsEnabled: body.smsEnabled ?? current.smsEnabled,
        smsProvider: body.smsProvider ?? current.smsProvider,
        smsAccessKeyId: body.smsAccessKeyId?.trim() ?? current.smsAccessKeyId,
        smsAccessKeySecret:
          pickSecretUpdate(body.smsAccessKeySecret, current.smsAccessKeySecret) ??
          current.smsAccessKeySecret,
        smsSignName: body.smsSignName?.trim() ?? current.smsSignName,
        smsTemplateCode: body.smsTemplateCode?.trim() ?? current.smsTemplateCode,
        smsTestMode: body.smsTestMode ?? current.smsTestMode,
        smsTestFixedCode:
          body.smsTestFixedCode?.trim() ?? current.smsTestFixedCode,
      },
    });
    invalidateSiteSettingsCache();
    return NextResponse.json({
      ok: true,
      settings: publicSiteSettings(updated),
    });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

/**
 * 软件产品（OAuth Client）更新的校验与字段整理。
 * 放在 account 应用内，避免改 shared / OIDC 核心。
 */

import { z } from "zod";
import {
  serializeUriList,
  validateRegisteredRedirectUri,
} from "@andyyyds/shared/oauth";

export const STUDIO_APP_NAME_MAX = 40;
export const STUDIO_APP_HOMEPAGE_MAX = 300;

/** PATCH 允许写入的字段；故意不含 clientId / clientSecret */
export const studioAppPatchFieldsSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(STUDIO_APP_NAME_MAX).optional(),
  homepageUrl: z.string().trim().max(STUDIO_APP_HOMEPAGE_MAX).optional(),
  redirectUris: z.array(z.string().trim().min(1)).min(1).max(20).optional(),
  enabled: z.boolean().optional(),
  description: z.string().trim().max(200).optional(),
  clientType: z.enum(["confidential", "public"]).optional(),
  allowedScopes: z.array(z.string().trim().min(1)).max(20).optional(),
  grantTypes: z
    .array(z.enum(["authorization_code", "refresh_token"]))
    .min(1)
    .max(4)
    .optional(),
  requirePkce: z.boolean().optional(),
  rotateSecret: z.literal(true).optional(),
});

export type StudioAppPatchFields = z.infer<typeof studioAppPatchFieldsSchema>;

const FORBIDDEN_KEYS = [
  "clientId",
  "client_id",
  "clientSecret",
  "client_secret",
] as const;

/**
 * 拒绝通过表单偷偷改 client_id / client_secret。
 * 在 Zod 解析前检查原始 JSON。
 */
export function assertNoIdentityMutation(raw: unknown): void {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
  const obj = raw as Record<string, unknown>;
  for (const key of FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      throw new z.ZodError([
        {
          code: "custom",
          path: [key],
          message:
            key === "clientId" || key === "client_id"
              ? "client_id 不可修改"
              : "不能通过此接口修改 client_secret",
        },
      ]);
    }
  }
}

/** 产品首页：可空；非空时须为 http(s) URL，且不能带 * */
export function validateHomepageUrl(
  raw: string,
): { ok: true; url: string } | { ok: false; error: string } {
  const value = String(raw || "").trim();
  if (!value) return { ok: true, url: "" };
  if (value.includes("*")) {
    return { ok: false, error: "产品首页不能带通配符" };
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "产品首页必须是完整的 http(s) 地址" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "产品首页只支持 http(s)" };
  }
  if (url.hash) {
    return { ok: false, error: "产品首页不能带 # 片段" };
  }
  return { ok: true, url: value };
}

export function checkRedirectUris(uris: string[]): string[] {
  const cleaned: string[] = [];
  for (const raw of uris) {
    const checked = validateRegisteredRedirectUri(raw);
    if (!checked.ok) {
      throw new z.ZodError([
        {
          code: "custom",
          path: ["redirectUris"],
          message: `${raw}：${checked.error}`,
        },
      ]);
    }
    cleaned.push(checked.uri);
  }
  return cleaned;
}

/**
 * 把已通过 Zod 的 PATCH 体整理成 Prisma update data。
 * 未出现的字段不写入，避免意外清空。
 */
export function buildStudioAppPrismaData(body: StudioAppPatchFields): {
  name?: string;
  description?: string;
  homepageUrl?: string;
  redirectUris?: string;
  clientType?: string;
  requirePkce?: boolean;
  enabled?: boolean;
} {
  const data: {
    name?: string;
    description?: string;
    homepageUrl?: string;
    redirectUris?: string;
    clientType?: string;
    requirePkce?: boolean;
    enabled?: boolean;
  } = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.homepageUrl !== undefined) {
    const checked = validateHomepageUrl(body.homepageUrl);
    if (!checked.ok) {
      throw new z.ZodError([
        {
          code: "custom",
          path: ["homepageUrl"],
          message: checked.error,
        },
      ]);
    }
    data.homepageUrl = checked.url;
  }
  if (body.redirectUris !== undefined) {
    data.redirectUris = serializeUriList(checkRedirectUris(body.redirectUris));
  }
  if (body.clientType !== undefined) data.clientType = body.clientType;
  if (body.requirePkce !== undefined) data.requirePkce = body.requirePkce;
  if (body.enabled !== undefined) data.enabled = body.enabled;
  return data;
}

/** 管理 API 响应里绝不带密钥哈希或明文 */
export function publicStudioAppFields<T extends Record<string, unknown>>(
  app: T,
): Omit<T, "clientSecret" | "client_secret"> {
  const copy = { ...app };
  delete (copy as { clientSecret?: unknown }).clientSecret;
  delete (copy as { client_secret?: unknown }).client_secret;
  return copy;
}

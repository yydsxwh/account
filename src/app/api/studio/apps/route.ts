import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@andyyyds/shared/db";
import {
  generateClientId,
  generateClientSecret,
  hashClientSecret,
  parseUriList,
  serializeUriList,
  validateRegisteredRedirectUri,
} from "@andyyyds/shared/oauth";
import { CLIENT_TYPES, GRANT_TYPES } from "@andyyyds/shared/oidc/clients";
import { KNOWN_SCOPES, formatScope, parseScope } from "@andyyyds/shared/oidc/scopes";
import { recordSecurityEvent } from "@andyyyds/shared/security/events";
import { requireAdmin, studioErrorResponse } from "@andyyyds/shared/studio";
import { oneTimeClientSecret } from "@/lib/one-time-client-secret";

function serializeApp(row: {
  id: string;
  clientId: string;
  clientType: string;
  name: string;
  description: string;
  homepageUrl: string;
  redirectUris: string;
  allowedScopes: string;
  grantTypes: string;
  requirePkce: boolean;
  enabled: boolean;
  createdAt: Date;
}) {
  return {
    id: row.id,
    clientId: row.clientId,
    clientType: row.clientType,
    name: row.name,
    description: row.description,
    homepageUrl: row.homepageUrl,
    redirectUris: parseUriList(row.redirectUris),
    allowedScopes: parseScope(row.allowedScopes),
    grantTypes: parseScope(row.grantTypes),
    requirePkce: row.requirePkce,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
  };
}

/** 站长填错回调地址是最常见的接入事故，登记时就挡掉 */
function checkRedirectUris(uris: string[]) {
  const cleaned: string[] = [];
  for (const raw of uris) {
    const checked = validateRegisteredRedirectUri(raw);
    if (!checked.ok) {
      throw new z.ZodError([
        { code: "custom", path: ["redirectUris"], message: `${raw}：${checked.error}` },
      ]);
    }
    cleaned.push(checked.uri);
  }
  return cleaned;
}

function checkScopes(scopes: string[] | undefined) {
  if (!scopes || scopes.length === 0) return undefined;
  const unknown = scopes.filter((scope) => !KNOWN_SCOPES.includes(scope));
  if (unknown.length > 0) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["allowedScopes"],
        message: `未知 scope：${unknown.join(" ")}`,
      },
    ]);
  }
  return formatScope(scopes);
}

export async function GET() {
  try {
    await requireAdmin();
    const rows = await prisma.oAuthClient.findMany({
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ apps: rows.map(serializeApp) });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().max(200).optional().default(""),
  homepageUrl: z.string().trim().max(300).optional().default(""),
  redirectUris: z.array(z.string().trim().min(1)).min(1).max(20),
  clientId: z.string().trim().max(40).optional(),
  clientType: z.enum(CLIENT_TYPES).optional().default("confidential"),
  allowedScopes: z.array(z.string().trim().min(1)).max(20).optional(),
  grantTypes: z.array(z.enum(GRANT_TYPES)).min(1).max(4).optional(),
  requirePkce: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = createSchema.parse(await req.json());
    const clientId = (body.clientId || generateClientId(body.name)).trim();
    const taken = await prisma.oAuthClient.findUnique({ where: { clientId } });
    if (taken) {
      return NextResponse.json({ error: "产品 ID 已被占用" }, { status: 400 });
    }
    const redirectUris = checkRedirectUris(body.redirectUris);
    const allowedScopes = checkScopes(body.allowedScopes);

    // public 客户端不该有可用密钥；仍然写一串随机值占位，避免空字段被误当成"任意密钥都通过"
    const plaintextSecret = generateClientSecret();
    const row = await prisma.oAuthClient.create({
      data: {
        name: body.name,
        description: body.description,
        homepageUrl: body.homepageUrl,
        redirectUris: serializeUriList(redirectUris),
        clientId,
        clientType: body.clientType,
        clientSecret: await hashClientSecret(plaintextSecret),
        ...(allowedScopes ? { allowedScopes } : {}),
        ...(body.grantTypes ? { grantTypes: body.grantTypes.join(" ") } : {}),
        // 新产品一律强制 PKCE；库里的默认值 false 只为兼容早就接好的老产品
        requirePkce: body.requirePkce ?? true,
      },
    });
    return NextResponse.json({
      app: serializeApp(row),
      clientSecret: oneTimeClientSecret(body.clientType, plaintextSecret),
      message:
        body.clientType === "public"
          ? "公开客户端不使用密钥，请在产品里配置 PKCE"
          : "请立刻保存密钥，之后无法再查看明文",
    });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(40).optional(),
  description: z.string().trim().max(200).optional(),
  homepageUrl: z.string().trim().max(300).optional(),
  redirectUris: z.array(z.string().trim().min(1)).min(1).max(20).optional(),
  clientType: z.enum(CLIENT_TYPES).optional(),
  allowedScopes: z.array(z.string().trim().min(1)).max(20).optional(),
  grantTypes: z.array(z.enum(GRANT_TYPES)).min(1).max(4).optional(),
  requirePkce: z.boolean().optional(),
  enabled: z.boolean().optional(),
  rotateSecret: z.literal(true).optional(),
});

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = patchSchema.parse(await req.json());
    const current = await prisma.oAuthClient.findUnique({
      where: { id: body.id },
    });
    if (!current) {
      return NextResponse.json({ error: "产品不存在" }, { status: 404 });
    }
    let plaintextSecret: string | undefined;
    const data: {
      name?: string;
      description?: string;
      homepageUrl?: string;
      redirectUris?: string;
      clientType?: string;
      allowedScopes?: string;
      grantTypes?: string;
      requirePkce?: boolean;
      enabled?: boolean;
      clientSecret?: string;
    } = {};
    if (body.name) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.homepageUrl !== undefined) data.homepageUrl = body.homepageUrl;
    if (body.redirectUris) {
      data.redirectUris = serializeUriList(checkRedirectUris(body.redirectUris));
    }
    if (body.clientType) data.clientType = body.clientType;
    const allowedScopes = checkScopes(body.allowedScopes);
    if (allowedScopes) data.allowedScopes = allowedScopes;
    if (body.grantTypes) data.grantTypes = body.grantTypes.join(" ");
    if (body.requirePkce !== undefined) data.requirePkce = body.requirePkce;
    if (body.enabled !== undefined) data.enabled = body.enabled;
    if (body.rotateSecret) {
      plaintextSecret = generateClientSecret();
      data.clientSecret = await hashClientSecret(plaintextSecret);
    }
    const row = await prisma.oAuthClient.update({
      where: { id: body.id },
      data,
    });
    if (plaintextSecret) {
      await recordSecurityEvent({
        userId: admin.id,
        type: "client_secret_rotated",
        detail: row.clientId,
      });
    }
    return NextResponse.json({
      app: serializeApp(row),
      clientSecret: oneTimeClientSecret(row.clientType, plaintextSecret),
      message: plaintextSecret
        ? "新密钥已生成，请立刻保存"
        : "已保存",
    });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

const deleteSchema = z.object({ id: z.string().min(1) });

export async function DELETE(req: Request) {
  try {
    await requireAdmin();
    const body = deleteSchema.parse(await req.json());
    await prisma.oAuthClient.delete({ where: { id: body.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@andyyyds/shared/db";
import {
  generateClientId,
  generateClientSecret,
  hashClientSecret,
  parseUriList,
  serializeUriList,
} from "@andyyyds/shared/oauth";
import { requireAdmin, studioErrorResponse } from "@andyyyds/shared/studio";

function serializeApp(row: {
  id: string;
  clientId: string;
  name: string;
  homepageUrl: string;
  redirectUris: string;
  enabled: boolean;
  createdAt: Date;
}) {
  return {
    id: row.id,
    clientId: row.clientId,
    name: row.name,
    homepageUrl: row.homepageUrl,
    redirectUris: parseUriList(row.redirectUris),
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
  };
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
  homepageUrl: z.string().trim().max(300).optional().default(""),
  redirectUris: z.array(z.string().trim().min(1)).min(1).max(20),
  clientId: z.string().trim().max(40).optional(),
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
    const plaintextSecret = generateClientSecret();
    const row = await prisma.oAuthClient.create({
      data: {
        name: body.name,
        homepageUrl: body.homepageUrl,
        redirectUris: serializeUriList(body.redirectUris),
        clientId,
        clientSecret: await hashClientSecret(plaintextSecret),
      },
    });
    return NextResponse.json({
      app: serializeApp(row),
      clientSecret: plaintextSecret,
      message: "请立刻保存密钥，之后无法再查看明文",
    });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(40).optional(),
  homepageUrl: z.string().trim().max(300).optional(),
  redirectUris: z.array(z.string().trim().min(1)).min(1).max(20).optional(),
  enabled: z.boolean().optional(),
  rotateSecret: z.literal(true).optional(),
});

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
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
      homepageUrl?: string;
      redirectUris?: string;
      enabled?: boolean;
      clientSecret?: string;
    } = {};
    if (body.name) data.name = body.name;
    if (body.homepageUrl !== undefined) data.homepageUrl = body.homepageUrl;
    if (body.redirectUris) data.redirectUris = serializeUriList(body.redirectUris);
    if (body.enabled !== undefined) data.enabled = body.enabled;
    if (body.rotateSecret) {
      plaintextSecret = generateClientSecret();
      data.clientSecret = await hashClientSecret(plaintextSecret);
    }
    const row = await prisma.oAuthClient.update({
      where: { id: body.id },
      data,
    });
    return NextResponse.json({
      app: serializeApp(row),
      clientSecret: plaintextSecret,
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

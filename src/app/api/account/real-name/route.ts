/**
 * PATCH /api/account/real-name
 * 登录用户补充或更新实名信息。站长在用户管理里看全文。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { ID_TYPES, validateRealNameInput } from "@andyyyds/shared/real-name";

const schema = z.object({
  realName: z.string().max(40),
  idType: z.enum(ID_TYPES).optional().default("id_card"),
  idNumber: z.string().max(40),
});

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    const body = schema.parse(await req.json());
    const checked = validateRealNameInput(body);
    if (!checked.ok) {
      return NextResponse.json({ error: checked.error }, { status: 400 });
    }

    const occupied = await prisma.user.findFirst({
      where: {
        idNumber: checked.idNumber,
        NOT: { id: session.id },
      },
      select: { id: true },
    });
    if (occupied && checked.idNumber) {
      return NextResponse.json(
        { error: "该证件号已登记在其他账号，请核对或联系站长" },
        { status: 400 },
      );
    }

    const updated = await prisma.user.update({
      where: { id: session.id },
      data: {
        realName: checked.realName,
        idType: checked.idType,
        idNumber: checked.idNumber,
        realNameUpdatedAt: new Date(),
      },
      select: {
        realName: true,
        idType: true,
        idNumber: true,
        realNameUpdatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      realName: updated.realName,
      idType: updated.idType,
      idNumber: updated.idNumber,
      realNameUpdatedAt: updated.realNameUpdatedAt?.toISOString() ?? null,
      message: "实名信息已保存，站长可在后台查看",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "参数无效" },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : "保存失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * DELETE /api/account/sessions/:id —— 退出指定设备
 * 撤销会话时，由它签发给各产品的令牌一并作废。
 */

import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import { revokeUserSession } from "@andyyyds/shared/security/sessions";
import { recordSecurityEvent } from "@andyyyds/shared/security/events";
import { clientIpFromRequest } from "@andyyyds/shared/identity/rate-limit";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const { id } = await params;
  const ok = await revokeUserSession({ userId: session.id, sessionId: id });
  if (!ok) {
    return NextResponse.json({ error: "该设备不存在或已退出" }, { status: 404 });
  }
  await recordSecurityEvent({
    userId: session.id,
    type: "session_revoked",
    detail: id === session.sessionId ? "退出当前设备" : "退出其他设备",
    ip: clientIpFromRequest(req),
  });
  return NextResponse.json({ ok: true, current: id === session.sessionId });
}

/**
 * GET    /api/account/sessions —— 当前账号的登录设备
 * DELETE /api/account/sessions —— 退出其他所有设备（保留当前这台）
 *
 * 只返回粗粒度信息（设备描述、IP、时间），不返回会话令牌。
 */

import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import {
  describeUserAgent,
  listUserSessions,
  revokeOtherUserSessions,
} from "@andyyyds/shared/security/sessions";
import {
  listLoginEvents,
  listSecurityEvents,
  recordSecurityEvent,
} from "@andyyyds/shared/security/events";
import { clientIpFromRequest } from "@andyyyds/shared/identity/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const [sessions, logins, events] = await Promise.all([
    listUserSessions(session.id),
    listLoginEvents(session.id, 20),
    listSecurityEvents(session.id, 20),
  ]);

  return NextResponse.json(
    {
      currentSessionId: session.sessionId,
      sessions: sessions.map((row) => ({
        id: row.id,
        device: describeUserAgent(row.userAgent),
        ip: row.ip,
        method: row.method,
        current: row.id === session.sessionId,
        createdAt: row.createdAt.toISOString(),
        lastSeenAt: row.lastSeenAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
      })),
      logins: logins.map((row) => ({
        id: row.id,
        method: row.method,
        success: row.success,
        reason: row.reason,
        ip: row.ip,
        device: describeUserAgent(row.userAgent),
        createdAt: row.createdAt.toISOString(),
      })),
      events: events.map((row) => ({
        id: row.id,
        type: row.type,
        detail: row.detail,
        ip: row.ip,
        createdAt: row.createdAt.toISOString(),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const count = await revokeOtherUserSessions({
    userId: session.id,
    keepSessionId: session.sessionId,
  });
  await recordSecurityEvent({
    userId: session.id,
    type: "sessions_revoked_all",
    detail: `退出其他设备 ${count} 个`,
    ip: clientIpFromRequest(req),
  });
  return NextResponse.json({ ok: true, revoked: count });
}

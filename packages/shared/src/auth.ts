/**
 * 登录会话（JWT Cookie + 服务端会话记录）
 *
 * Cookie 名：yyds_session。角色在 role（主角色）+ roles（多角色列表）。
 * 校验 JWT 后会回查用户表，保证站长改角色后无需重新登录即可生效。
 * 需要登录的 API / 页面先 getSession()，没有则 401 或跳转 /login。
 *
 * JWT 里带 sid/sst 指向一条 UserSession：这样会话才能被撤销、能列设备。
 * 主站 www 用同一个 AUTH_SECRET 签的旧 Cookie 没有 sid，仍然放行（遗留 SSO），
 * 但管不了它的设备列表。新产品请走 OIDC，不要读这个 Cookie。
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { hashPassword, makeReferralCode, verifyPassword } from "./password";
import { allocateKkNumber } from "./kk-allocate";
import {
  canManageCourses,
  isRoleApplicationPending,
  normalizeRoles,
  primaryRole,
  type Role,
} from "./roles";
import {
  createUserSession,
  touchUserSession,
  type SessionContext,
} from "./security/sessions";

export { hashPassword, makeReferralCode, verifyPassword };

const COOKIE_NAME = "yyds_session";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  roles: Role[];
  avatarUrl: string;
  requestedRole: string;
  roleApplicationStatus: string;
  rolePending: boolean;
  kkNumber: number | null;
  /** 服务端会话 id；主站签发的遗留 Cookie 为 null */
  sessionId: string | null;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is missing");
  return new TextEncoder().encode(secret);
}

export type CreateSessionOptions = {
  /** 记录到 UserSession，用于「登录设备」列表 */
  context?: SessionContext;
  /**
   * 只是刷新 Cookie 内容（例如改了昵称），沿用当前会话，
   * 不要在设备列表里多出一条。
   */
  reuseCurrent?: boolean;
};

async function readCurrentSessionBinding(): Promise<{
  sid: string;
  sst: string;
} | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const sid = String(payload.sid || "");
    const sst = String(payload.sst || "");
    return sid && sst ? { sid, sst } : null;
  } catch {
    return null;
  }
}

export async function createSession(
  user: Pick<SessionUser, "id" | "email" | "name" | "role">,
  options: CreateSessionOptions = {},
) {
  let binding = options.reuseCurrent ? await readCurrentSessionBinding() : null;
  if (binding) {
    const stillValid = await touchUserSession({
      sessionId: binding.sid,
      secret: binding.sst,
      userId: user.id,
    });
    if (!stillValid) binding = null;
  }
  if (!binding) {
    const created = await createUserSession({
      userId: user.id,
      context: options.context,
    });
    binding = { sid: created.id, sst: created.secret };
  }

  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    sid: binding.sid,
    sst: binding.sst,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());

  const jar = await cookies();
  const domain = process.env.COOKIE_DOMAIN?.trim() || undefined;
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    // 同父域名多产品：设成 .yydsxwh.com，各子站共享登录态
    ...(domain ? { domain } : {}),
  });
  return binding.sid;
}

export async function destroySession() {
  const binding = await readCurrentSessionBinding();
  if (binding) {
    try {
      const { revokeUserSession } = await import("./security/sessions");
      const owner = await prisma.userSession.findUnique({
        where: { id: binding.sid },
        select: { userId: true },
      });
      if (owner) {
        await revokeUserSession({ userId: owner.userId, sessionId: binding.sid });
      }
    } catch (error) {
      // 会话行删不掉也要把 Cookie 清掉，不能把人卡在已登录状态
      console.error("[auth] revoke on logout failed", error);
    }
  }
  const jar = await cookies();
  const domain = process.env.COOKIE_DOMAIN?.trim() || undefined;
  jar.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    ...(domain ? { domain } : {}),
  });
}

const sessionSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  roles: true,
  avatarUrl: true,
  requestedRole: true,
  roleApplicationStatus: true,
  kkNumber: true,
} as const;

/**
 * 主站先登录、账号中心库还没同步到时：用 JWT 先落一条本地用户，
 * 避免共享 Cookie 校验通过却查不到人。密码哈希由双向同步补上。
 */
async function provisionUserFromJwt(payload: JWTPayload) {
  const id = String(payload.id || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const name = String(payload.name || "").trim() || "用户";
  const role = String(payload.role || "STUDENT").trim() || "STUDENT";
  if (!id || !email) return null;

  const emailOwner = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (emailOwner && emailOwner.id !== id) return null;
  if (emailOwner?.id === id) {
    return prisma.user.findUnique({ where: { id }, select: sessionSelect });
  }

  let referralCode = makeReferralCode();
  for (let i = 0; i < 8; i += 1) {
    const taken = await prisma.user.findUnique({
      where: { referralCode },
      select: { id: true },
    });
    if (!taken) break;
    referralCode = makeReferralCode();
  }

  try {
    await prisma.user.create({
      data: {
        id,
        email,
        name,
        role,
        roles: role,
        passwordHash: await hashPassword(`!sso-pending!${id}`),
        passwordSet: false,
        kkNumber: await allocateKkNumber(),
        referralCode,
      },
    });
  } catch {
    return prisma.user.findUnique({ where: { id }, select: sessionSelect });
  }
  return prisma.user.findUnique({ where: { id }, select: sessionSelect });
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const id = String(payload.id);
    let user = await prisma.user.findUnique({
      where: { id },
      select: sessionSelect,
    });
    if (!user) {
      user = await provisionUserFromJwt(payload);
    }
    if (!user) return null;

    // 带 sid 的是账号中心签发的：撤销后立刻失效
    const sid = String(payload.sid || "");
    const sst = String(payload.sst || "");
    if (sid && sst) {
      const alive = await touchUserSession({
        sessionId: sid,
        secret: sst,
        userId: user.id,
      });
      if (!alive) return null;
    }

    const roles = normalizeRoles({
      role: user.role,
      roles: user.roles || "",
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: primaryRole(roles),
      roles,
      avatarUrl: user.avatarUrl || "",
      requestedRole: user.requestedRole || "",
      roleApplicationStatus: user.roleApplicationStatus || "NONE",
      rolePending: isRoleApplicationPending(user.roleApplicationStatus || ""),
      kkNumber: user.kkNumber ?? null,
      sessionId: sid || null,
    };
  } catch {
    return null;
  }
}

export async function requireUser() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function requireTeacher() {
  const session = await requireUser();
  if (!canManageCourses(session)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.id } });
}

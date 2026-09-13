/**
 * 登录会话（JWT Cookie）
 *
 * Cookie 名：yyds_session。角色在 role（主角色）+ roles（多角色列表）。
 * 校验 JWT 后会回查用户表，保证站长改角色后无需重新登录即可生效。
 * 需要登录的 API / 页面先 getSession()，没有则 401 或跳转 /login。
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { hashPassword, makeReferralCode, verifyPassword } from "./password";
import {
  canManageCourses,
  isRoleApplicationPending,
  normalizeRoles,
  primaryRole,
  type Role,
} from "./roles";

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
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is missing");
  return new TextEncoder().encode(secret);
}

export async function createSession(
  user: Pick<SessionUser, "id" | "email" | "name" | "role">,
) {
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
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
}

export async function destroySession() {
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

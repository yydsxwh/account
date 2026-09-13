#!/usr/bin/env python3
"""Patch live www auth.ts for shared-cookie SSO. Idempotent."""
from pathlib import Path

PATH = Path("/var/www/yyds-course-platform/packages/shared/src/auth.ts")
text = PATH.read_text()

if "COOKIE_DOMAIN" not in text:
    old_create = """  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
"""
    new_create = """  const jar = await cookies();
  const domain = process.env.COOKIE_DOMAIN?.trim() || undefined;
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    ...(domain ? { domain } : {}),
  });
"""
    if old_create not in text:
        raise SystemExit("createSession cookie block not found")
    text = text.replace(old_create, new_create, 1)

    old_destroy = """export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
"""
    new_destroy = """export async function destroySession() {
  const jar = await cookies();
  const domain = process.env.COOKIE_DOMAIN?.trim() || undefined;
  jar.delete(COOKIE_NAME);
  jar.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    ...(domain ? { domain } : {}),
  });
}
"""
    if old_destroy not in text:
        raise SystemExit("destroySession block not found")
    text = text.replace(old_destroy, new_destroy, 1)

if "provisionMissingUserFromJwt" not in text:
    old_lookup = """    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        roles: true,
        avatarUrl: true,
        requestedRole: true,
        roleApplicationStatus: true,
        forumUniversityId: true,
        forumSchoolVerifications: {
          select: {
            universityId: true,
            degreeLevel: true,
            status: true,
          },
        },
      },
    });
    if (!user) return null;
"""
    new_lookup = """    let user = await prisma.user.findUnique({
      where: { id },
      select: sessionUserSelect,
    });
    if (!user) {
      user = await provisionMissingUserFromJwt(payload);
    }
    if (!user) return null;
"""
    if old_lookup not in text:
        raise SystemExit("getSession user lookup not found")
    text = text.replace(old_lookup, new_lookup, 1)

    helper = '''
const sessionUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  roles: true,
  avatarUrl: true,
  requestedRole: true,
  roleApplicationStatus: true,
  forumUniversityId: true,
  forumSchoolVerifications: {
    select: {
      universityId: true,
      degreeLevel: true,
      status: true,
    },
  },
} as const;

async function provisionMissingUserFromJwt(payload: { id?: unknown; email?: unknown; name?: unknown; role?: unknown }) {
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
    return prisma.user.findUnique({ where: { id }, select: sessionUserSelect });
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
        forumUniversityId: "",
      },
    });
  } catch {
    return prisma.user.findUnique({ where: { id }, select: sessionUserSelect });
  }
  return prisma.user.findUnique({ where: { id }, select: sessionUserSelect });
}

'''
    needle = "export async function getSession(): Promise<SessionUser | null> {"
    if needle not in text:
        raise SystemExit("getSession signature not found")
    text = text.replace(needle, helper + needle, 1)

PATH.write_text(text)
print("patched", PATH)

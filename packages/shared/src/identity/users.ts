/**
 * 用户身份读取。
 *
 * publicId 是懒补齐的：老库 db push 之后字段为空，第一次用到时写上，
 * 这样不需要停机做数据迁移，也不会因为回填脚本没跑就报错。
 */

import { prisma } from "../db";
import { generateUserPublicId, isUserPublicId } from "./public-id";

export const claimsUserSelect = {
  id: true,
  publicId: true,
  name: true,
  email: true,
  emailVerifiedAt: true,
  username: true,
  kkNumber: true,
  avatarUrl: true,
  phone: true,
  locale: true,
  timezone: true,
  role: true,
  roles: true,
  updatedAt: true,
} as const;

export type ClaimsUser = {
  id: string;
  publicId: string;
  name: string;
  email: string;
  emailVerifiedAt: Date | null;
  username: string | null;
  kkNumber: number | null;
  avatarUrl: string;
  phone: string;
  locale: string;
  timezone: string;
  role: string;
  roles: string;
  updatedAt: Date;
};

/** 保证该用户有 publicId，并返回它 */
export async function ensureUserPublicId(userId: string): Promise<string> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { publicId: true },
  });
  if (!row) throw new Error("USER_NOT_FOUND");
  if (isUserPublicId(row.publicId)) return row.publicId as string;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateUserPublicId();
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { publicId: candidate },
        select: { publicId: true },
      });
      return updated.publicId as string;
    } catch {
      // 唯一索引撞了就换一个；并发时也可能是别的请求先写好了
      const again = await prisma.user.findUnique({
        where: { id: userId },
        select: { publicId: true },
      });
      if (isUserPublicId(again?.publicId)) return again!.publicId as string;
    }
  }
  throw new Error("PUBLIC_ID_ALLOCATION_FAILED");
}

export async function getClaimsUserById(
  userId: string,
): Promise<ClaimsUser | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: claimsUserSelect,
  });
  if (!row) return null;
  const publicId = isUserPublicId(row.publicId)
    ? (row.publicId as string)
    : await ensureUserPublicId(row.id);
  return { ...row, publicId } as ClaimsUser;
}

/** 其他产品拿着 sub 回查用户时用 */
export async function getClaimsUserByPublicId(
  publicId: string,
): Promise<ClaimsUser | null> {
  if (!isUserPublicId(publicId)) return null;
  const row = await prisma.user.findUnique({
    where: { publicId },
    select: claimsUserSelect,
  });
  return row ? ({ ...row, publicId } as ClaimsUser) : null;
}

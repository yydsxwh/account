import Link from "next/link";
import { redirect } from "next/navigation";
import { UserAdminPanel } from "@/components/user-admin-panel";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { isAdmin, normalizeRoles, roleLabels } from "@andyyyds/shared/roles";

export const dynamic = "force-dynamic";

function mapUser(u: {
  id: string;
  name: string;
  email: string;
  username: string | null;
  kkNumber: number | null;
  role: string;
  roles: string;
  requestedRole: string;
  roleApplicationStatus: string;
  roleApplicationNote: string;
  roleReviewedAt: Date | null;
  referralCode: string;
  adminNote: string;
  wechatOpenId: string;
  wechatWebOpenId: string;
  createdAt: Date;
  referredBy: { id: string; name: string; referralCode: string } | null;
  referrals: Array<{
    id: string;
    name: string;
    email: string;
    referralCode: string;
    role: string;
    roles: string;
    createdAt: Date;
  }>;
  _count: { referrals: number };
}) {
  const roles = normalizeRoles({ role: u.role, roles: u.roles });
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username || "",
    kkNumber: u.kkNumber,
    role: u.role,
    roles,
    rolesLabel: roleLabels(roles),
    requestedRole: u.requestedRole,
    roleApplicationStatus: u.roleApplicationStatus,
    roleApplicationNote: u.roleApplicationNote,
    roleReviewedAt: u.roleReviewedAt?.toISOString() ?? null,
    referralCode: u.referralCode,
    adminNote: u.adminNote || "",
    referredById: u.referredBy?.id || "",
    referredByName: u.referredBy?.name || "",
    referredByCode: u.referredBy?.referralCode || "",
    hasWechat: Boolean(u.wechatOpenId?.trim() || u.wechatWebOpenId?.trim()),
    createdAt: u.createdAt.toISOString(),
    orderCount: 0,
    enrollmentCount: 0,
    courseCount: 0,
    referralCount: u._count.referrals,
    invitees: u.referrals.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      referralCode: r.referralCode,
      role: r.role,
      roles: normalizeRoles({ role: r.role, roles: r.roles }),
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export default async function StudioUsersPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/studio/users");
  if (!isAdmin(session)) redirect("/account");

  const select = {
    id: true,
    name: true,
    email: true,
    username: true,
    kkNumber: true,
    role: true,
    roles: true,
    requestedRole: true,
    roleApplicationStatus: true,
    roleApplicationNote: true,
    roleReviewedAt: true,
    referralCode: true,
    adminNote: true,
    wechatOpenId: true,
    wechatWebOpenId: true,
    createdAt: true,
    referredBy: { select: { id: true, name: true, referralCode: true } },
    referrals: {
      select: {
        id: true,
        name: true,
        email: true,
        referralCode: true,
        role: true,
        roles: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" as const },
      take: 100,
    },
    _count: { select: { referrals: true } },
  };

  const [users, pending] = await Promise.all([
    prisma.user.findMany({
      select,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.user.findMany({
      where: { roleApplicationStatus: "PENDING" },
      select,
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
  ]);

  return (
    <div className="container space-y-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">用户管理</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            查看注册用户、邀请关系、审核角色申请；可为同一用户勾选多种身份。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/studio/apps" className="btn btn-secondary min-h-10 px-3">
            软件产品
          </Link>
          <Link href="/studio/settings" className="btn btn-secondary min-h-10 px-3">
            登录设置
          </Link>
        </div>
      </div>
      <UserAdminPanel
        initialUsers={users.map(mapUser)}
        initialPending={pending.map(mapUser)}
      />
    </div>
  );
}

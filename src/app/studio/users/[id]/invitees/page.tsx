import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { isAdmin, roleLabels } from "@andyyyds/shared/roles";

export const dynamic = "force-dynamic";

export default async function InviteesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/studio/users");
  if (!isAdmin(session)) redirect("/account");

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      referralCode: true,
      referrals: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          realName: true,
          idType: true,
          idNumber: true,
          referralCode: true,
          role: true,
          roles: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!user) redirect("/studio/users");

  return (
    <div className="container space-y-6 py-12">
      <Link href="/studio/users" className="text-sm text-[var(--brand)]">
        ← 返回用户管理
      </Link>
      <div>
        <h1 className="text-3xl font-semibold">{user.name} 的邀请用户</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          邀请码 {user.referralCode} · 共 {user.referrals.length} 人
        </p>
      </div>
      <ul className="surface divide-y divide-[var(--line)] rounded-[28px]">
        {user.referrals.length === 0 ? (
          <li className="p-5 text-sm text-[var(--muted)]">暂无下级用户</li>
        ) : (
          user.referrals.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 p-5">
              <div>
                <div className="font-medium">{row.name}</div>
                <div className="text-sm text-[var(--muted)]">{row.email}</div>
                <div className="text-sm text-[var(--ink)]">
                  手机 {row.phone?.trim() || "未绑定"}
                  {row.realName?.trim()
                    ? ` · 实名 ${row.realName}${row.idNumber?.trim() ? ` ${row.idNumber}` : ""}`
                    : " · 实名未补充"}
                </div>
              </div>
              <div className="text-sm text-[var(--muted)]">
                {roleLabels({ role: row.role, roles: row.roles })} · {row.referralCode}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

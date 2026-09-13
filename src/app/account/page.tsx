import { redirect } from "next/navigation";
import { AccountAuthPanel } from "@/components/account-auth-panel";
import { AccountProfilePanel } from "@/components/account-profile-panel";
import { RoleApplyPanel } from "@/components/role-apply-panel";
import { getSession } from "@andyyyds/shared/auth";
import { isPlaceholderEmail } from "@andyyyds/shared/auth-email";
import { prisma } from "@andyyyds/shared/db";
import { inviteRegisterUrl } from "@andyyyds/shared/invite";
import { availableAccountApplyRoles } from "@andyyyds/shared/role-applications";
import {
  isAdmin,
  ROLE_APPLICATION_STATUS_LABEL,
  ROLE_LABEL,
  roleLabels,
  type Role,
  type RoleApplicationStatus,
} from "@andyyyds/shared/roles";
import { resolveStoredAccessUrl } from "@andyyyds/shared/storage";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/account");

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      referralCode: true,
      roleApplicationNote: true,
      roleApplicationStatus: true,
      requestedRole: true,
      email: true,
      phone: true,
      username: true,
      wechatOpenId: true,
      wechatWebOpenId: true,
      wechatMobileOpenId: true,
      avatarUrl: true,
      passwordSet: true,
    },
  });

  const applyRoles = availableAccountApplyRoles(
    session,
    user?.roleApplicationStatus || session.roleApplicationStatus,
  );
  const status = user?.roleApplicationStatus || "NONE";
  const statusLabel =
    ROLE_APPLICATION_STATUS_LABEL[status as RoleApplicationStatus] || status;
  const requestedLabel = user?.requestedRole
    ? ROLE_LABEL[user.requestedRole as Role] || user.requestedRole
    : "";
  const avatarDisplayUrl = user?.avatarUrl
    ? await resolveStoredAccessUrl(user.avatarUrl)
    : "";
  const accountEmail = user?.email || session.email || "";
  const headerContact = !isPlaceholderEmail(accountEmail)
    ? accountEmail
    : user?.phone
      ? user.phone
      : user?.wechatOpenId || user?.wechatWebOpenId || user?.wechatMobileOpenId
        ? "微信登录"
        : "未绑定邮箱";
  const inviteCode = user?.referralCode || "";

  return (
    <div className="container space-y-6 py-10 sm:py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">个人中心</h1>
        <p className="text-[var(--muted)]">
          {session.name}
          <span className="mx-2 text-[var(--line)]">·</span>
          {roleLabels(session)}
          <span className="mx-2 text-[var(--line)]">·</span>
          <span className="break-all text-sm">{headerContact}</span>
        </p>
      </header>

      {session.rolePending ? (
        <div className="rounded-[28px] border border-amber-200 bg-amber-50/80 p-5">
          <h2 className="text-lg font-semibold text-amber-950">账号待站长审核</h2>
          <p className="mt-1 text-sm text-amber-900/80">
            你已申请成为{requestedLabel || "特殊角色"}，当前「{statusLabel}」。
            通过前可正常登录；对应后台权限暂不可用。
          </p>
        </div>
      ) : null}

      {status === "REJECTED" ? (
        <div className="surface rounded-[28px] border border-[var(--line)] p-5">
          <h2 className="text-lg font-semibold">角色申请未通过</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {user?.roleApplicationNote ||
              "站长未通过你的角色申请。可在下方重新提交申请。"}
          </p>
        </div>
      ) : null}

      <AccountProfilePanel
        initialName={session.name}
        initialAvatarDisplayUrl={avatarDisplayUrl}
      />

      <AccountAuthPanel
        username={user?.username || ""}
        email={accountEmail}
        phone={user?.phone || ""}
        hasWechatOa={Boolean(user?.wechatOpenId)}
        hasWechatWeb={Boolean(user?.wechatWebOpenId)}
        hasWechatMobile={Boolean(user?.wechatMobileOpenId)}
        passwordSet={user?.passwordSet !== false}
      />

      {inviteCode ? (
        <section className="surface rounded-[28px] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">邀请码</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            把链接发给好友，对方注册后会绑定为你的下级。
          </p>
          <p className="mt-3 font-mono text-lg">{inviteCode}</p>
          <p className="mt-2 break-all text-sm text-[var(--brand)]">
            {inviteRegisterUrl(inviteCode)}
          </p>
        </section>
      ) : null}

      {!isAdmin(session) ? (
        <RoleApplyPanel
          availableRoles={applyRoles}
          applicationStatus={status}
          requestedRole={user?.requestedRole || ""}
          applicationNote={user?.roleApplicationNote || ""}
        />
      ) : null}
    </div>
  );
}

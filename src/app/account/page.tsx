import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountAuthPanel } from "@/components/account-auth-panel";
import { AccountProfilePanel } from "@/components/account-profile-panel";
import { AccountRealNamePanel } from "@/components/account-real-name-panel";
import { RoleApplyPanel } from "@/components/role-apply-panel";
import { getSession } from "@andyyyds/shared/auth";
import { isPlaceholderEmail } from "@andyyyds/shared/auth-email";
import { prisma } from "@andyyyds/shared/db";
import { safeNextTarget } from "@andyyyds/shared/first-party-url";
import { inviteRegisterUrl } from "@andyyyds/shared/invite";
import { listPublicProducts } from "@andyyyds/shared/oauth";
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

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ kk?: string; pending?: string; next?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/account");
  const params = await searchParams;
  const justAssignedKk = params.kk?.trim() || "";
  const continueTo = justAssignedKk ? safeNextTarget(params.next) : null;

  const [user, products] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.id },
      select: {
        referralCode: true,
        roleApplicationNote: true,
        roleApplicationStatus: true,
        requestedRole: true,
        email: true,
        phone: true,
        realName: true,
        idType: true,
        idNumber: true,
        username: true,
        kkNumber: true,
        wechatOpenId: true,
        wechatWebOpenId: true,
        wechatMobileOpenId: true,
        avatarUrl: true,
        passwordSet: true,
      },
    }),
    listPublicProducts(),
  ]);

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
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">个人中心</h1>
          <Link
            href="/account/security"
            className="btn btn-primary min-h-10 px-4 text-sm"
          >
            安全中心
          </Link>
        </div>
        <p className="text-[var(--muted)]">
          {session.name}
          <span className="mx-2 text-[var(--line)]">·</span>
          {roleLabels(session)}
          <span className="mx-2 text-[var(--line)]">·</span>
          <span className="break-all text-sm">{headerContact}</span>
        </p>
      </header>

      {justAssignedKk ? (
        <div className="rounded-[28px] border border-[var(--brand)]/30 bg-[var(--brand)]/8 px-5 py-4 text-sm">
          <p>
            注册成功，你的 kk 号是{" "}
            <span className="font-mono font-semibold">{justAssignedKk}</span>
            。请记下来，以后可用它登录。
          </p>
          {continueTo ? (
            <a
              href={continueTo}
              className="btn btn-primary mt-3 inline-flex min-h-10 px-4"
            >
              继续
            </a>
          ) : null}
        </div>
      ) : null}

      <section className="surface rounded-[28px] p-5 sm:p-6">
        <p className="text-xs text-[var(--muted)]">kk号</p>
        <p className="mt-1 font-mono text-4xl font-semibold tracking-wide text-[var(--ink)]">
          {user?.kkNumber ?? session.kkNumber ?? "—"}
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          类似 QQ 号，注册时自动分配，越早越短。登录时请用「kk号」页签 + 密码。
        </p>
        <p className="mt-3 text-sm">
          自设账号：
          <span className="font-medium">
            {user?.username || "未设置（可在下方设英文+数字，类似微信号）"}
          </span>
        </p>
      </section>

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

      {products.length > 0 ? (
        <section className="surface rounded-[28px] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">我的软件</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            用当前账号打开已接入的产品，不必再注册。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {products.map((product) =>
              product.homepageUrl ? (
                <a
                  key={product.clientId}
                  href={product.homepageUrl}
                  className="btn btn-secondary min-h-11 px-4"
                >
                  {product.name}
                </a>
              ) : (
                <span key={product.clientId}>{product.name}</span>
              ),
            )}
          </div>
        </section>
      ) : null}

      <AccountProfilePanel
        initialName={session.name}
        initialAvatarDisplayUrl={avatarDisplayUrl}
      />

      <AccountRealNamePanel
        initialRealName={user?.realName || ""}
        initialIdType={user?.idType || "id_card"}
        initialIdNumber={user?.idNumber || ""}
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

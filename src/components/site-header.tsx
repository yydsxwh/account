import Link from "next/link";
import { getSession } from "@andyyyds/shared/auth";
import { isAdmin, roleLabels } from "@andyyyds/shared/roles";
import { resolveStoredAccessUrl } from "@andyyyds/shared/storage";
import { UserAvatar } from "@/components/user-avatar";

export async function SiteHeader() {
  const session = await getSession();
  const avatarUrl = session?.avatarUrl
    ? await resolveStoredAccessUrl(session.avatarUrl)
    : "";

  return (
    <header className="glass-bar sticky top-0 z-40 border-b">
      <div className="container flex min-h-14 items-center justify-between gap-3 py-2">
        <Link href="/" className="brand-mark text-[var(--brand)]">
          账号中心
        </Link>
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          {session ? (
            <>
              <Link
                href="/account"
                className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 hover:bg-[var(--brand)]/8"
              >
                <UserAvatar name={session.name} src={avatarUrl} size="xs" />
                <span>{session.name}</span>
                <span className="text-xs text-[var(--muted)]">
                  {roleLabels(session)}
                </span>
              </Link>
              {isAdmin(session) ? (
                <>
                  <Link href="/studio/apps" className="btn btn-secondary min-h-10 px-3">
                    软件产品
                  </Link>
                  <Link href="/studio/users" className="btn btn-secondary min-h-10 px-3">
                    用户管理
                  </Link>
                  <Link href="/studio/settings" className="btn btn-secondary min-h-10 px-3">
                    登录设置
                  </Link>
                </>
              ) : null}
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="btn btn-secondary min-h-10 px-3">
                  退出
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/integrate" className="hidden min-h-10 items-center sm:inline-flex">
                产品接入
              </Link>
              <Link href="/login" className="btn btn-secondary min-h-10 px-3">
                登录
              </Link>
              <Link href="/register" className="btn btn-primary min-h-10 px-3">
                注册
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

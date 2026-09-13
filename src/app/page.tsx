import Link from "next/link";
import { getSession } from "@andyyyds/shared/auth";
import { isAdmin } from "@andyyyds/shared/roles";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();

  return (
    <div className="container space-y-8 py-16">
      <header className="space-y-3">
        <h1 className="text-4xl font-semibold">账号中心</h1>
        <p className="max-w-2xl text-[var(--muted)]">
          从 Andyyyds 复制而来的登录注册能力：邮箱、登录账号、手机验证码、微信（公众号 / 扫码 / App），以及个人资料、密码绑定和站长用户审核。
        </p>
      </header>

      {session ? (
        <section className="surface rounded-[28px] p-6">
          <p className="text-sm text-[var(--muted)]">当前已登录</p>
          <p className="mt-1 text-2xl font-semibold">{session.name}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/account" className="btn btn-primary min-h-11 px-4">
              进入个人中心
            </Link>
            {isAdmin(session) ? (
              <Link href="/studio/users" className="btn btn-secondary min-h-11 px-4">
                用户管理
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="flex flex-wrap gap-3">
          <Link href="/login" className="btn btn-primary min-h-11 px-5">
            登录
          </Link>
          <Link href="/register" className="btn btn-secondary min-h-11 px-5">
            注册
          </Link>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="surface rounded-[24px] p-5">
          <h2 className="text-lg font-semibold">登录方式</h2>
          <ul className="mt-3 space-y-1 text-sm text-[var(--muted)]">
            <li>邮箱 + 密码</li>
            <li>登录账号 + 密码（4–20 位小写字母开头）</li>
            <li>手机号 + 短信验证码（默认测试码 123456）</li>
            <li>微信公众号 / 扫码 / Android SDK</li>
          </ul>
        </div>
        <div className="surface rounded-[24px] p-5">
          <h2 className="text-lg font-semibold">演示账号</h2>
          <p className="mt-3 text-sm text-[var(--muted)]">
            种子数据密码均为 <code>123456</code>
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            <li>站长 admin@yyds.local</li>
            <li>老师 teacher@yyds.local</li>
            <li>代理 agent@yyds.local</li>
            <li>学员 student@yyds.local</li>
            <li>待审商家 merchant@yyds.local</li>
            <li>账号登录 demo_user / 123456</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

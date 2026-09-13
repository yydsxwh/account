import Link from "next/link";
import { getSession } from "@andyyyds/shared/auth";
import { listPublicProducts } from "@andyyyds/shared/oauth";
import { isAdmin } from "@andyyyds/shared/roles";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [session, products] = await Promise.all([
    getSession(),
    listPublicProducts(),
  ]);

  return (
    <div className="container space-y-8 py-16">
      <header className="space-y-3">
        <h1 className="text-4xl font-semibold">账号中心</h1>
        <p className="max-w-2xl text-[var(--muted)]">
          独立账号中心，类似 Google 账号。用户只在这里注册一次；你做的其他软件跳过来登录，共用同一套用户。
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
            <Link href="/integrate" className="btn btn-secondary min-h-11 px-4">
              其他产品如何接入
            </Link>
            {isAdmin(session) ? (
              <>
                <Link href="/studio/users" className="btn btn-secondary min-h-11 px-4">
                  用户管理
                </Link>
                <Link href="/studio/apps" className="btn btn-secondary min-h-11 px-4">
                  软件产品
                </Link>
                <Link href="/studio/settings" className="btn btn-secondary min-h-11 px-4">
                  登录设置
                </Link>
              </>
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
          <Link href="/integrate" className="btn btn-secondary min-h-11 px-5">
            其他产品如何接入
          </Link>
        </section>
      )}

      {products.length > 0 ? (
        <section className="surface space-y-3 rounded-[28px] p-6">
          <h2 className="text-lg font-semibold">软件产品</h2>
          <p className="text-sm text-[var(--muted)]">
            用上面的同一套账号进入。先打开产品，再点「用账号中心登录」。
          </p>
          <div className="flex flex-wrap gap-2">
            {products.map((product) =>
              product.homepageUrl ? (
                <Link
                  key={product.clientId}
                  href={product.homepageUrl}
                  className="btn btn-secondary min-h-11 px-4"
                >
                  {product.name}
                </Link>
              ) : (
                <span key={product.clientId} className="text-sm">
                  {product.name}
                </span>
              ),
            )}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="surface rounded-[24px] p-5">
          <h2 className="text-lg font-semibold">登录方式</h2>
          <ul className="mt-3 space-y-1 text-sm text-[var(--muted)]">
            <li>邮箱 + 密码</li>
            <li>登录账号 + 密码（4–20 位小写字母开头）</li>
            <li>手机号收验证码登录 / 注册（测试码 123456；配阿里云后发到手机）</li>
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

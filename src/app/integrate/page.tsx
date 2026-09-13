import Link from "next/link";
import { getPublicSiteUrl } from "@andyyyds/shared/payments";

export const dynamic = "force-dynamic";

export default async function IntegratePage() {
  const origin =
    (await getPublicSiteUrl()).replace(/\/$/, "") ||
    "https://account.yydsxwh.com";

  return (
    <div className="container max-w-3xl space-y-8 py-12">
      <div>
        <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
          给其他软件产品
        </p>
        <h1 className="mt-2 text-3xl font-semibold">接入账号中心</h1>
        <p className="mt-3 text-[var(--muted)]">
          和 Google 账号一样：用户只在本站注册一次。你的产品不要自己做注册表，把人送到这里登录，回来只记住统一的
          user.id。
        </p>
      </div>

      <section className="surface space-y-3 rounded-[28px] p-6">
        <h2 className="text-lg font-semibold">1. 站长登记产品</h2>
        <p className="text-sm text-[var(--muted)]">
          登录账号中心 → 软件产品 → 填写名称、首页、回调地址，保存下发的
          client_id / client_secret。密钥只放产品服务器。
        </p>
        <Link href="/studio/apps" className="text-sm text-[var(--brand)]">
          打开软件产品后台
        </Link>
      </section>

      <section className="surface space-y-3 rounded-[28px] p-6">
        <h2 className="text-lg font-semibold">2. 未登录时跳到账号中心</h2>
        <pre className="overflow-x-auto rounded-2xl bg-[var(--bg-deep)] p-4 text-xs leading-6">
          {`${origin}/api/oauth/authorize?client_id=你的ID&redirect_uri=https://你的产品/auth/callback&state=随机串`}
        </pre>
        <p className="text-sm text-[var(--muted)]">
          没登录会出现登录/注册页；已经登录则直接带一次性 code 跳回产品。
        </p>
      </section>

      <section className="surface space-y-3 rounded-[28px] p-6">
        <h2 className="text-lg font-semibold">3. 产品服务端换用户</h2>
        <pre className="overflow-x-auto rounded-2xl bg-[var(--bg-deep)] p-4 text-xs leading-6">{`POST ${origin}/api/oauth/token
Content-Type: application/json

{
  "client_id": "你的ID",
  "client_secret": "只放服务器",
  "code": "回调里的 code",
  "redirect_uri": "必须和登记的完全一致"
}`}</pre>
        <p className="text-sm text-[var(--muted)]">
          返回的 user.id 是全站统一账号。产品库只存这个 id 和本站业务，不要再存密码。
        </p>
      </section>

      <section className="surface space-y-3 rounded-[28px] p-6">
        <h2 className="text-lg font-semibold">4. 可选：拉用户资料</h2>
        <pre className="overflow-x-auto rounded-2xl bg-[var(--bg-deep)] p-4 text-xs leading-6">{`GET ${origin}/api/oauth/userinfo
Authorization: Bearer <access_token>`}</pre>
      </section>

      <p className="text-sm">
        <Link href="/" className="text-[var(--brand)]">
          返回账号中心
        </Link>
      </p>
    </div>
  );
}

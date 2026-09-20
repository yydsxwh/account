import Link from "next/link";
import { getPublicSiteUrl } from "@andyyyds/shared/payments";

export const dynamic = "force-dynamic";

export const metadata = { title: "接入账号中心" };

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
          和 Google 账号一样：用户只在本站注册一次。你的产品不要自己做注册表、不要连本站数据库，
          走标准 OpenID Connect 拿身份，库里只存一个永久用户 ID。
        </p>
      </div>

      <section className="surface space-y-3 rounded-[28px] p-6">
        <h2 className="text-lg font-semibold">0. 一行配置</h2>
        <p className="text-sm text-[var(--muted)]">
          任何支持 OpenID Connect 的库，喂给它这个地址就能跑起来。
        </p>
        <pre className="overflow-x-auto rounded-2xl bg-[var(--bg-deep)] p-4 text-xs leading-6">
          {`${origin}/.well-known/openid-configuration`}
        </pre>
      </section>

      <section className="surface space-y-3 rounded-[28px] p-6">
        <h2 className="text-lg font-semibold">1. 站长登记产品</h2>
        <p className="text-sm text-[var(--muted)]">
          登录账号中心 → 软件产品 → 填名称、回调地址、客户端类型。
          有自己后端的选 confidential 并保管好 client_secret；
          纯前端或 App 选 public，不发密钥，改用 PKCE。
        </p>
        <Link href="/studio/apps" className="text-sm text-[var(--brand)]">
          打开软件产品后台
        </Link>
      </section>

      <section className="surface space-y-3 rounded-[28px] p-6">
        <h2 className="text-lg font-semibold">2. 把用户送过来</h2>
        <pre className="overflow-x-auto rounded-2xl bg-[var(--bg-deep)] p-4 text-xs leading-6">
          {`${origin}/api/oauth/authorize
  ?response_type=code
  &client_id=你的ID
  &redirect_uri=https://你的产品/api/auth/callback
  &scope=openid profile email
  &state=随机串
  &nonce=随机串
  &code_challenge=BASE64URL(SHA256(code_verifier))
  &code_challenge_method=S256`}
        </pre>
        <p className="text-sm text-[var(--muted)]">
          没登录会先出登录页，登完原样跳回来；已登录直接带一次性 code 跳回产品。
          回调地址必须和登记的完全一致，不支持通配符。
        </p>
      </section>

      <section className="surface space-y-3 rounded-[28px] p-6">
        <h2 className="text-lg font-semibold">3. 产品服务端换令牌</h2>
        <pre className="overflow-x-auto rounded-2xl bg-[var(--bg-deep)] p-4 text-xs leading-6">{`POST ${origin}/api/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=回调里的 code
&redirect_uri=必须和上一步完全一致
&code_verifier=第二步那个随机串
&client_id=你的ID
&client_secret=只放服务器（public 客户端不传）`}</pre>
        <p className="text-sm text-[var(--muted)]">
          返回 id_token、access_token，申请了 offline_access 还会带 refresh_token。
          授权码 60 秒过期且只能用一次。
        </p>
      </section>

      <section className="surface space-y-3 rounded-[28px] p-6">
        <h2 className="text-lg font-semibold">4. 校验 id_token，拿到用户 ID</h2>
        <pre className="overflow-x-auto rounded-2xl bg-[var(--bg-deep)] p-4 text-xs leading-6">{`// 公钥在 ${origin}/.well-known/jwks.json
const { payload } = await jwtVerify(id_token, jwks, {
  issuer: "${origin}",
  audience: "你的ID",
  algorithms: ["RS256"],
});
payload.sub  // usr_xxx —— 产品库里只存这个`}</pre>
        <p className="text-sm text-[var(--muted)]">
          issuer 和 audience 必须都校验。只验签名的话，别的产品的令牌也能拿来冒充。
        </p>
      </section>

      <section className="surface space-y-3 rounded-[28px] p-6">
        <h2 className="text-lg font-semibold">5. 需要最新资料时</h2>
        <pre className="overflow-x-auto rounded-2xl bg-[var(--bg-deep)] p-4 text-xs leading-6">{`GET ${origin}/api/oauth/userinfo
Authorization: Bearer <access_token>`}</pre>
        <p className="text-sm text-[var(--muted)]">
          返回内容按 scope 裁剪。完整接入说明见仓库 docs/integration.md。
        </p>
      </section>

      <p className="text-sm">
        <Link href="/" className="text-[var(--brand)]">
          返回账号中心
        </Link>
      </p>
    </div>
  );
}

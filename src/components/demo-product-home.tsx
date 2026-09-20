import Link from "next/link";
import { buildAuthorizePath } from "@andyyyds/shared/oauth";
import {
  DEMO_PRODUCTS,
  type DemoProductKey,
  type DemoSessionUser,
} from "@/helpers/demo-product";

export function DemoProductHome({
  productKey,
  user,
  redirectUri,
}: {
  productKey: DemoProductKey;
  user: DemoSessionUser | null;
  redirectUri: string;
}) {
  const spec = DEMO_PRODUCTS[productKey];
  const otherKey: DemoProductKey = productKey === "docs" ? "shop" : "docs";
  const other = DEMO_PRODUCTS[otherKey];

  return (
    <div className="container space-y-6 py-12">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
        演示软件产品 · 独立站点
      </p>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">{spec.name}</h1>
        <p className="text-[var(--muted)]">
          这是一个单独的软件。它没有自己的注册表，登录会跳到账号中心，用同一套账号密码。
        </p>
      </header>

      {user ? (
        <section className="surface space-y-3 rounded-[28px] p-6">
          <p className="text-sm text-[var(--muted)]">已用账号中心登录</p>
          <p className="text-2xl font-semibold">{user.name}</p>
          <p className="text-sm text-[var(--muted)]">
            {user.email || "未绑定邮箱"} · {user.role}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={other.path} className="btn btn-primary min-h-11 px-4">
              打开{other.name}
            </Link>
            <form action={`${spec.path}/logout`} method="post">
              <button type="submit" className="btn btn-secondary min-h-11 px-4">
                退出{spec.name}
              </button>
            </form>
          </div>
          <p className="text-sm text-[var(--muted)]">
            退出只清这个产品的登录态。账号中心若仍登录，再点「用账号中心登录」会直接进来，不用再输密码。
          </p>
        </section>
      ) : (
        <section className="surface space-y-4 rounded-[28px] p-6">
          <p className="text-sm text-[var(--muted)]">当前未登录本产品</p>
          <Link
            href={buildAuthorizePath({
              clientId: spec.clientId,
              redirectUri,
              state: productKey,
            })}
            className="btn btn-primary inline-flex min-h-11 px-5"
          >
            用账号中心登录
          </Link>
        </section>
      )}

      <p className="text-sm">
        <Link href="/" className="text-[var(--brand)]">
          返回账号中心
        </Link>
      </p>
    </div>
  );
}

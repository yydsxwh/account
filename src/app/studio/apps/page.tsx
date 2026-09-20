import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductAppsPanel } from "@/components/product-apps-panel";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { parseUriList } from "@andyyyds/shared/oauth";
import { isAdmin } from "@andyyyds/shared/roles";

export const dynamic = "force-dynamic";

export default async function StudioAppsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/studio/apps");
  if (!isAdmin(session)) redirect("/account");

  const rows = await prisma.oAuthClient.findMany({
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="container space-y-6 py-12">
      <Link href="/studio/users" className="text-sm text-[var(--brand)]">
        ← 返回用户管理
      </Link>
      <div>
        <h1 className="text-3xl font-semibold">软件产品</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          像 Google 账号那样：用户只在这里注册一次，你的文档、商城、论坛各自跳过来登录。
        </p>
      </div>
      <ProductAppsPanel
        initialApps={rows.map((row) => ({
          id: row.id,
          clientId: row.clientId,
          clientType: row.clientType,
          name: row.name,
          homepageUrl: row.homepageUrl,
          redirectUris: parseUriList(row.redirectUris),
          enabled: row.enabled,
        }))}
      />
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountSecurityPanel } from "@/components/account-security-panel";
import { getSession } from "@andyyyds/shared/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "安全中心" };

export default async function AccountSecurityPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/account/security");

  return (
    <div className="container space-y-6 py-10 sm:py-12">
      <Link href="/account" className="text-sm text-[var(--brand)]">
        ← 返回个人中心
      </Link>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">安全中心</h1>
        <p className="text-sm text-[var(--muted)]">
          这里能看到账号在哪些设备登录过、最近的登录记录和安全操作，并随时踢掉不认识的设备。
        </p>
      </header>
      <AccountSecurityPanel />
    </div>
  );
}

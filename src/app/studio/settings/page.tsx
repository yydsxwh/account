import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthSettingsForm } from "@/components/auth-settings-form";
import { getSession } from "@andyyyds/shared/auth";
import {
  getSiteSettings,
  publicSiteSettings,
} from "@andyyyds/shared/site-settings";
import { isAdmin } from "@andyyyds/shared/roles";

export const dynamic = "force-dynamic";

export default async function StudioSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/studio/settings");
  if (!isAdmin(session)) redirect("/account");

  const row = await getSiteSettings();

  return (
    <div className="container space-y-6 py-12">
      <Link href="/studio/users" className="text-sm text-[var(--brand)]">
        ← 返回用户管理
      </Link>
      <div>
        <h1 className="text-3xl font-semibold">登录设置</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          配置短信验证码与微信授权。密钥保存后只显示打码，留空或保持星号表示不改。
        </p>
      </div>
      <AuthSettingsForm initial={publicSiteSettings(row)} />
    </div>
  );
}

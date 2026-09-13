import { AuthForm } from "@/components/auth-form";
import { preferWechatFromAcceptLanguage } from "@andyyyds/shared/auth-channel-preference";
import { headers } from "next/headers";
import Link from "next/link";

const ACCOUNT_ORIGIN = "https://account.yydsxwh.com";
const WWW_ORIGIN = "https://www.yydsxwh.com";

function safePath(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function loginHref(next: string | undefined) {
  const path = safePath(next);
  return path === "/" ? "/login" : `/login?next=${encodeURIComponent(path)}`;
}

/** 账号中心注册会自动发 kk 号，本站同一套用户 */
function accountCenterHref(next: string | undefined, ref: string) {
  const back = `${WWW_ORIGIN}${safePath(next)}`;
  const params = new URLSearchParams({ next: back });
  if (ref) params.set("ref", ref);
  return `${ACCOUNT_ORIGIN}/register?${params.toString()}`;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; next?: string }>;
}) {
  const params = await searchParams;
  const ref = params.ref?.trim() || "";
  const headerList = await headers();
  const preferWechat = preferWechatFromAcceptLanguage(
    headerList.get("accept-language"),
  );

  return (
    <div className="container py-16">
      <AuthForm
        mode="register"
        defaultReferralCode={ref}
        preferWechatDefault={preferWechat}
      />
      <div className="mx-auto mt-4 w-full max-w-md space-y-3 text-center text-sm text-[var(--muted)]">
        <p>
          已有账号？{" "}
          <Link href={loginHref(params.next)} className="text-[var(--brand)]">
            去登录
          </Link>
        </p>
        <div className="rounded-2xl border border-[var(--line)] px-4 py-3 text-left leading-6">
          想要一个 kk 号（类似 QQ 号的数字账号）？
          <br />
          <a
            href={accountCenterHref(params.next, ref)}
            className="text-[var(--brand)]"
          >
            去账号中心注册
          </a>
          ，注册后自动发号，本站也能用同一个账号登录。
        </div>
      </div>
    </div>
  );
}

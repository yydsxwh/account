import { AuthForm } from "@/components/auth-form";
import { preferWechatFromAcceptLanguage } from "@andyyyds/shared/auth-channel-preference";
import { headers } from "next/headers";
import Link from "next/link";

const ACCOUNT_ORIGIN = "https://account.yydsxwh.com";
const WWW_ORIGIN = "https://www.yydsxwh.com";

function safePath(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function registerHref(next: string | undefined) {
  const path = safePath(next);
  return path === "/" ? "/register" : `/register?next=${encodeURIComponent(path)}`;
}

/** 账号中心：kk 号 / 自设账号 / 邮箱，同一套用户 */
function accountCenterHref(path: "/login" | "/register", next: string | undefined) {
  const back = `${WWW_ORIGIN}${safePath(next)}`;
  return `${ACCOUNT_ORIGIN}${path}?next=${encodeURIComponent(back)}`;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const headerList = await headers();
  const preferWechat = preferWechatFromAcceptLanguage(
    headerList.get("accept-language"),
  );

  return (
    <div className="container py-16">
      <AuthForm mode="login" preferWechatDefault={preferWechat} />
      <div className="mx-auto mt-4 w-full max-w-md space-y-3 text-center text-sm text-[var(--muted)]">
        <p>
          还没有账号？{" "}
          <Link href={registerHref(next)} className="text-[var(--brand)]">
            去注册
          </Link>
        </p>
        <div className="rounded-2xl border border-[var(--line)] px-4 py-3 text-left leading-6">
          有 kk 号（数字账号）或在账号中心注册过？
          <br />
          <a
            href={accountCenterHref("/login", next)}
            className="text-[var(--brand)]"
          >
            用账号中心登录
          </a>
          ，登录后本站自动是登录状态。
        </div>
      </div>
    </div>
  );
}

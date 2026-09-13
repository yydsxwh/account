import { AuthForm } from "@/components/auth-form";
import { preferWechatFromAcceptLanguage } from "@andyyyds/shared/auth-channel-preference";
import { headers } from "next/headers";
import Link from "next/link";
import {
  productLoginSearch,
  readProductLoginQuery,
} from "@/helpers/oauth-query";
import { keepNextHref } from "@andyyyds/shared/first-party-url";

function loginHref(input: {
  next?: string;
  client_id?: string;
  redirect_uri?: string;
  state?: string;
}) {
  const product = readProductLoginQuery(input);
  if (product) return `/login?${productLoginSearch(product)}`;
  return keepNextHref("/login", input.next);
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{
    ref?: string;
    next?: string;
    client_id?: string;
    redirect_uri?: string;
    state?: string;
  }>;
}) {
  const params = await searchParams;
  const ref = params.ref?.trim() || "";
  const headerList = await headers();
  const preferWechat = preferWechatFromAcceptLanguage(
    headerList.get("accept-language"),
  );
  const product = readProductLoginQuery(params);

  return (
    <div className="container py-16">
      {product ? (
        <p className="mb-4 text-center text-sm text-[var(--muted)]">
          注册后可直接进入该软件产品
        </p>
      ) : null}
      <AuthForm
        mode="register"
        defaultReferralCode={ref}
        preferWechatDefault={preferWechat}
      />
      <p className="mt-4 text-center text-sm text-[var(--muted)]">
        已有账号？{" "}
        <Link href={loginHref(params)} className="text-[var(--brand)]">
          去登录
        </Link>
      </p>
    </div>
  );
}

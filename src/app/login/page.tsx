import { AuthForm } from "@/components/auth-form";
import { preferWechatFromAcceptLanguage } from "@andyyyds/shared/auth-channel-preference";
import { headers } from "next/headers";
import Link from "next/link";
import {
  productLoginSearch,
  readProductLoginQuery,
} from "@/helpers/oauth-query";

function registerHref(input: {
  next?: string;
  client_id?: string;
  redirect_uri?: string;
  state?: string;
}) {
  const product = readProductLoginQuery(input);
  if (product) return `/register?${productLoginSearch(product)}`;
  const next = input.next;
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/register";
  }
  return `/register?next=${encodeURIComponent(next)}`;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    client_id?: string;
    redirect_uri?: string;
    state?: string;
  }>;
}) {
  const params = await searchParams;
  const headerList = await headers();
  const preferWechat = preferWechatFromAcceptLanguage(
    headerList.get("accept-language"),
  );
  const product = readProductLoginQuery(params);

  return (
    <div className="container py-16">
      {product ? (
        <p className="mb-4 text-center text-sm text-[var(--muted)]">
          登录后将进入已接入的软件产品
        </p>
      ) : null}
      <AuthForm mode="login" preferWechatDefault={preferWechat} />
      <p className="mt-4 text-center text-sm text-[var(--muted)]">
        还没有账号？{" "}
        <Link href={registerHref(params)} className="text-[var(--brand)]">
          去注册
        </Link>
      </p>
    </div>
  );
}

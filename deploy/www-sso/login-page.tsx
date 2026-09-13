import { getSession } from "@andyyyds/shared/auth";
import { redirect } from "next/navigation";

const ACCOUNT_ORIGIN = "https://account.yydsxwh.com";
const WWW_ORIGIN = "https://www.yydsxwh.com";

function nextTarget(next?: string) {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return `${WWW_ORIGIN}${next}`;
  }
  return `${WWW_ORIGIN}/`;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const session = await getSession();
  if (session) {
    redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
  }
  redirect(
    `${ACCOUNT_ORIGIN}/login?next=${encodeURIComponent(nextTarget(next))}`,
  );
}

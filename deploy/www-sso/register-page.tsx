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

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; next?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  if (session) {
    redirect(
      params.next && params.next.startsWith("/") && !params.next.startsWith("//")
        ? params.next
        : "/",
    );
  }
  const dest = new URL(`${ACCOUNT_ORIGIN}/register`);
  dest.searchParams.set("next", nextTarget(params.next));
  const ref = params.ref?.trim() || "";
  if (ref) dest.searchParams.set("ref", ref);
  redirect(dest.toString());
}

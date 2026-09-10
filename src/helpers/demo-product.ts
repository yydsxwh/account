import { cookies, headers } from "next/headers";
import { getPublicSiteUrl } from "@andyyyds/shared/payments";

export const DEMO_PRODUCTS = {
  docs: {
    clientId: "docs",
    name: "文档",
    cookie: "demo_docs_session",
    path: "/demo/docs",
    callback: "/demo/docs/callback",
    secretEnv: "DEMO_DOCS_CLIENT_SECRET",
    defaultSecret: "demo-docs-secret",
  },
  shop: {
    clientId: "shop",
    name: "商城",
    cookie: "demo_shop_session",
    path: "/demo/shop",
    callback: "/demo/shop/callback",
    secretEnv: "DEMO_SHOP_CLIENT_SECRET",
    defaultSecret: "demo-shop-secret",
  },
} as const;

export type DemoProductKey = keyof typeof DEMO_PRODUCTS;

export type DemoSessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export async function getDemoProductUser(key: DemoProductKey) {
  const jar = await cookies();
  const raw = jar.get(DEMO_PRODUCTS[key].cookie)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DemoSessionUser;
  } catch {
    return null;
  }
}

export function demoClientSecret(key: DemoProductKey) {
  const spec = DEMO_PRODUCTS[key];
  return process.env[spec.secretEnv] || spec.defaultSecret;
}

export async function getDemoSiteUrl() {
  const headerList = await headers();
  const host = (
    headerList.get("x-forwarded-host") ||
    headerList.get("host") ||
    ""
  )
    .split(",")[0]
    .trim();
  if (host) {
    const proto = (
      headerList.get("x-forwarded-proto") || "http"
    )
      .split(",")[0]
      .trim();
    return `${proto}://${host}`;
  }
  return getPublicSiteUrl();
}

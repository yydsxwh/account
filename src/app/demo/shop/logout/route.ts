import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DEMO_PRODUCTS } from "@/helpers/demo-product";

export async function POST(req: Request) {
  const jar = await cookies();
  jar.delete(DEMO_PRODUCTS.shop.cookie);
  return NextResponse.redirect(
    `${new URL(req.url).origin}${DEMO_PRODUCTS.shop.path}`,
    { status: 303 },
  );
}

import { NextResponse } from "next/server";
import { listPublicProducts } from "@andyyyds/shared/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  const products = await listPublicProducts();
  return NextResponse.json({ products });
}

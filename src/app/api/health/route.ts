import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();
  return NextResponse.json({
    ok: true,
    service: "account-center",
    status: "ok",
    version: "0.1.0",
    timestamp,
    time: timestamp,
  });
}

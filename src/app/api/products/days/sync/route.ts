import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";

const PRODUCT = "days";
const MAX_BYTES = 8 * 1024 * 1024;

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  const allowed = (process.env.DAYS_APP_ORIGINS || "https://www.yydsxwh.com")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const headers = new Headers({
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  });
  if (allowed.includes(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function response(request: Request, body: unknown, status = 200) {
  const headers = corsHeaders(request);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(body, { status, headers });
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return response(request, { error: "UNAUTHORIZED" }, 401);

  const state = await prisma.productSyncState.findUnique({
    where: { userId_product: { userId: session.id, product: PRODUCT } },
  });
  return response(request, {
    authenticated: true,
    user: { id: session.id, name: session.name, email: session.email, avatarUrl: session.avatarUrl },
    data: state?.data ?? null,
    version: state?.version ?? 0,
    updatedAt: state?.updatedAt?.toISOString() ?? null,
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return response(request, { error: "UNAUTHORIZED" }, 401);

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BYTES) return response(request, { error: "PAYLOAD_TOO_LARGE" }, 413);

  let body: { data?: unknown; baseVersion?: number };
  try {
    body = await request.json();
  } catch {
    return response(request, { error: "INVALID_JSON" }, 400);
  }
  if (!body || typeof body.data !== "object" || body.data === null || Array.isArray(body.data)) {
    return response(request, { error: "INVALID_DATA" }, 400);
  }

  const current = await prisma.productSyncState.findUnique({
    where: { userId_product: { userId: session.id, product: PRODUCT } },
    select: { version: true },
  });
  if (current && typeof body.baseVersion === "number" && body.baseVersion !== current.version) {
    return response(request, { error: "VERSION_CONFLICT", version: current.version }, 409);
  }

  const state = await prisma.productSyncState.upsert({
    where: { userId_product: { userId: session.id, product: PRODUCT } },
    create: { userId: session.id, product: PRODUCT, data: body.data, version: 1 },
    update: { data: body.data, version: { increment: 1 } },
  });

  return response(request, {
    ok: true,
    version: state.version,
    updatedAt: state.updatedAt.toISOString(),
  });
}

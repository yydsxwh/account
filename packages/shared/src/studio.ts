import { z } from "zod";
import { getSession, type SessionUser } from "./auth";
import { isAdmin } from "./roles";

export async function requireAdmin(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  if (!isAdmin(session)) {
    throw new Error("ADMIN_ONLY");
  }
  return session;
}

export function studioErrorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return { status: 400 as const, error: error.issues[0]?.message || "参数无效" };
  }

  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") {
    return { status: 401 as const, error: "请先登录" };
  }
  if (message === "FORBIDDEN") {
    return { status: 403 as const, error: "没有权限" };
  }
  if (message === "ROLE_PENDING") {
    return { status: 403 as const, error: "账号待站长审核" };
  }
  if (message === "ADMIN_ONLY") {
    return { status: 403 as const, error: "仅站长可操作" };
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  ) {
    return { status: 400 as const, error: "已存在相同内容" };
  }

  console.error("[studio]", error);
  if (error instanceof Error && error.message) {
    return { status: 500 as const, error: error.message };
  }
  return { status: 500 as const, error: "请求失败" };
}

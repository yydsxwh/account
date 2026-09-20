/**
 * 兼容层：老代码从 `@andyyyds/shared/oauth` 导入的东西都还在这里。
 *
 * 新代码请直接用分模块的实现：
 *   oidc/clients、oidc/server、oidc/scopes、oidc/redirect-uri、oidc/tokens
 */

import { prisma } from "./db";
import { isPlaceholderEmail } from "./auth-email";
import { normalizeRoles, primaryRole, type Role } from "./roles";

export {
  generateClientId,
  generateClientSecret,
  hashClientSecret,
  findEnabledClient,
  isPublicClient,
  requiresPkce,
  supportsGrant,
  CLIENT_TYPES,
  GRANT_TYPES,
  type ClientType,
  type GrantType,
  type OAuthClientRow,
} from "./oidc/clients";

export {
  isAllowedRedirectUri,
  normalizeRedirectUri,
  parseUriList,
  serializeUriList,
  validateRegisteredRedirectUri,
} from "./oidc/redirect-uri";

export {
  ACCESS_TOKEN_TTL_SEC,
  AUTHORIZATION_CODE_TTL_SEC,
  REFRESH_TOKEN_TTL_SEC,
  generateOpaqueToken,
  hashToken,
} from "./oidc/tokens";

export {
  exchangeAuthorizationCode,
  issueAuthorizationCode,
  refreshTokens,
  resolveAccessToken,
  revokeToken,
  validateAuthorizationRequest,
} from "./oidc/server";

export type PublicAccountUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  kkNumber: number | null;
  avatarUrl: string;
  role: Role;
  roles: Role[];
};

export async function listPublicProducts() {
  return prisma.oAuthClient.findMany({
    where: { enabled: true },
    orderBy: { createdAt: "asc" },
    select: { clientId: true, name: true, homepageUrl: true },
  });
}

/**
 * 旧版 /api/oauth/token 与 /api/oauth/userinfo 响应里的 user 字段。
 * `id` 是内部主键，仅为兼容已上线的产品保留；新产品请用 OIDC 的 sub。
 */
export function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  username: string | null;
  kkNumber?: number | null;
  avatarUrl: string;
  role: string;
  roles: string;
}): PublicAccountUser {
  const roles = normalizeRoles({ role: user.role, roles: user.roles });
  return {
    id: user.id,
    name: user.name,
    email: isPlaceholderEmail(user.email) ? "" : user.email,
    username: user.username || "",
    kkNumber: user.kkNumber ?? null,
    avatarUrl: user.avatarUrl || "",
    role: primaryRole(roles),
    roles,
  };
}

export function buildAuthorizePath(input: {
  clientId: string;
  redirectUri: string;
  state?: string;
  scope?: string;
}) {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: input.scope || "openid profile email",
  });
  if (input.state) params.set("state", input.state);
  return `/api/oauth/authorize?${params.toString()}`;
}

export function buildLoginWithProductPath(input: {
  clientId: string;
  redirectUri: string;
  state?: string;
  mode?: "login" | "register";
  /** 登录完要原样带回 /api/oauth/authorize 的查询串 */
  authorizeSearch?: string;
}) {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
  });
  if (input.state) params.set("state", input.state);
  if (input.authorizeSearch) {
    params.set("authorize", input.authorizeSearch);
  }
  return input.mode === "register"
    ? `/register?${params.toString()}`
    : `/login?${params.toString()}`;
}

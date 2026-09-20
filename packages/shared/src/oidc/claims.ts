/**
 * 把账号中心的用户映射成 OIDC 标准 claim。
 *
 * 只按已授予的 scope 返回：没拿到 email scope 就看不到邮箱，
 * 没拿到 phone scope 就看不到手机号。绝不返回密码哈希、证件号、令牌。
 */

import { isPlaceholderEmail } from "../auth-email";
import { normalizeRoles, primaryRole, type Role } from "../roles";
import { hasScope } from "./scopes";

export type ClaimsSourceUser = {
  publicId: string;
  name: string;
  email: string;
  emailVerifiedAt?: Date | null;
  username: string | null;
  kkNumber: number | null;
  avatarUrl: string;
  phone: string;
  locale?: string | null;
  timezone?: string | null;
  role: string;
  roles: string;
  updatedAt?: Date | null;
};

export type StandardClaims = {
  sub: string;
  [claim: string]: unknown;
};

export function buildUserClaims(input: {
  user: ClaimsSourceUser;
  scope: string | readonly string[];
  /** 已解析成可直接访问的头像地址 */
  avatarUrl?: string;
}): StandardClaims {
  const { user } = input;
  const claims: StandardClaims = { sub: user.publicId };

  if (hasScope(input.scope, "profile")) {
    claims.name = user.name;
    claims.nickname = user.name;
    claims.preferred_username = user.username || String(user.kkNumber ?? "");
    claims.picture = input.avatarUrl ?? user.avatarUrl ?? "";
    claims.locale = user.locale || "zh-Hans";
    claims.zoneinfo = user.timezone || "Asia/Shanghai";
    // KK 号是公开身份号（类似 QQ 号），不是凭据；放进 profile
    // 让主站等第一方产品不必额外申请 account.basic 也能展示/回写投影。
    claims.kk_number = user.kkNumber ?? null;
    if (user.updatedAt) {
      claims.updated_at = Math.floor(user.updatedAt.getTime() / 1000);
    }
  }

  if (hasScope(input.scope, "email")) {
    const real = user.email && !isPlaceholderEmail(user.email) ? user.email : "";
    claims.email = real;
    claims.email_verified = Boolean(real && user.emailVerifiedAt);
  }

  if (hasScope(input.scope, "phone")) {
    claims.phone_number = user.phone || "";
    // 手机号是验证码绑定上来的，本身就等于已验证
    claims.phone_number_verified = Boolean(user.phone);
  }

  if (hasScope(input.scope, "account.basic")) {
    const roles = normalizeRoles({ role: user.role, roles: user.roles });
    claims.kk_number = user.kkNumber ?? null;
    claims.username = user.username || "";
    claims.role = primaryRole(roles) as Role;
    claims.roles = roles;
  }

  return claims;
}

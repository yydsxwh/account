/**
 * 全生态永久用户 ID。
 *
 * 规则：usr_ + 26 位 Crockford base32。
 * - 不是邮箱，不是 username，不是手机号：这些都能改，它不能
 * - 其他产品的库里只允许存这个值（例如 Task.user_id）
 * - 它同时是 OIDC 的 sub
 *
 * 内部主键 User.id（cuid）保持不变：主站双向同步脚本按 id 对齐，动不得。
 */

import crypto from "crypto";

export const USER_ID_PREFIX = "usr_";

/** Crockford base32，去掉 I L O U，避免人工抄写时混淆 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const BODY_LENGTH = 26;

const PUBLIC_ID_RE = new RegExp(
  `^${USER_ID_PREFIX}[0-9A-HJKMNP-TV-Z]{${BODY_LENGTH}}$`,
);

export function generateUserPublicId(): string {
  const bytes = crypto.randomBytes(BODY_LENGTH);
  let body = "";
  for (let i = 0; i < BODY_LENGTH; i += 1) {
    body += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `${USER_ID_PREFIX}${body}`;
}

export function isUserPublicId(value: string | null | undefined): boolean {
  return PUBLIC_ID_RE.test(String(value || ""));
}

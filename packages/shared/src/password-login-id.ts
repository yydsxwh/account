/**
 * 密码登录身份：kk 号与自设账号分开解析，避免一个输入框两种号混用。
 */

import { validateUsername } from "./auth-username";
import { parseKkNumber } from "./kk-number";

export type PasswordLoginKind = "kk" | "username" | "any";

export function parsePasswordLoginId(
  raw: string,
  kind: PasswordLoginKind = "any",
):
  | { ok: true; via: "kk"; kkNumber: number }
  | { ok: true; via: "username"; username: string }
  | { ok: false; error: string } {
  const value = String(raw || "").trim();
  if (!value) {
    if (kind === "kk") return { ok: false, error: "请填写 kk 号" };
    if (kind === "username") return { ok: false, error: "请填写自设账号" };
    return { ok: false, error: "请填写 kk 号或自设账号" };
  }

  const kkNumber = parseKkNumber(value);
  if (kind === "kk") {
    if (kkNumber == null) {
      return { ok: false, error: "请填写 kk 号（3 位及以上数字）" };
    }
    return { ok: true, via: "kk", kkNumber };
  }

  if (kind === "username") {
    if (/^\d+$/.test(value)) {
      return { ok: false, error: "这是数字 kk 号，请切换到「kk号」登录" };
    }
    const checked = validateUsername(value);
    if (!checked.ok) return checked;
    return { ok: true, via: "username", username: checked.username };
  }

  if (kkNumber != null) {
    return { ok: true, via: "kk", kkNumber };
  }
  const checked = validateUsername(value);
  if (!checked.ok) return checked;
  return { ok: true, via: "username", username: checked.username };
}

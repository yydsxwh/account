/**
 * PKCE（RFC 7636）。
 *
 * 只接受 S256。plain 会把 verifier 明文放进授权请求的 URL，
 * 一旦落到日志或 Referer 里就等于没做防护，所以直接拒绝。
 */

import crypto from "crypto";

export const PKCE_METHODS = ["S256"] as const;
export type PkceMethod = (typeof PKCE_METHODS)[number];

/** RFC 7636 规定 code_verifier 为 43–128 位 unreserved 字符 */
const VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/;
const CHALLENGE_RE = /^[A-Za-z0-9\-_]{43}$/;

export function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function isValidCodeVerifier(verifier: string): boolean {
  return VERIFIER_RE.test(String(verifier || ""));
}

export function isValidCodeChallenge(challenge: string): boolean {
  return CHALLENGE_RE.test(String(challenge || ""));
}

export function isSupportedPkceMethod(method: string): method is PkceMethod {
  return (PKCE_METHODS as readonly string[]).includes(String(method || ""));
}

export function deriveCodeChallenge(verifier: string): string {
  return base64UrlEncode(
    crypto.createHash("sha256").update(verifier, "ascii").digest(),
  );
}

/** 供本地联调和文档示例用 */
export function createPkcePair() {
  const verifier = base64UrlEncode(crypto.randomBytes(48));
  return { verifier, challenge: deriveCodeChallenge(verifier) };
}

export function verifyCodeChallenge(input: {
  verifier: string;
  challenge: string;
  method: string;
}): boolean {
  if (!isSupportedPkceMethod(input.method)) return false;
  if (!isValidCodeVerifier(input.verifier)) return false;
  if (!isValidCodeChallenge(input.challenge)) return false;
  const derived = Buffer.from(deriveCodeChallenge(input.verifier));
  const expected = Buffer.from(input.challenge);
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

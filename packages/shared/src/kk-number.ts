/**
 * kk 号：类似 QQ 号的数字账号。
 * 从 3 位数 100 起号，人多了自动排到 4、5、6 位。注册越早号码越短。
 */

export const KK_START = 100;
export const FOUNDER_EMAIL = "yydsxwh@gmail.com";

export function parseKkNumber(raw: string | null | undefined): number | null {
  const value = String(raw || "").trim();
  if (!/^\d{3,12}$/.test(value)) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < KK_START) return null;
  return n;
}

export function formatKkNumber(n: number | null | undefined): string {
  if (n == null || !Number.isInteger(n) || n < KK_START) return "";
  return String(n);
}

export function isKkLoginId(raw: string | null | undefined): boolean {
  return parseKkNumber(raw) != null;
}

export function nextKkNumber(currentMax: number | null | undefined): number {
  if (!currentMax || currentMax < KK_START) return KK_START;
  return currentMax + 1;
}

/**
 * 登录类接口的限流：挡暴力破解和撞库。
 *
 * 进程内滑动窗口。当前是单实例部署（一台机器一个 systemd 服务），够用。
 * 以后横向扩容必须换成 Redis，否则每个实例各算各的。
 */

type Hit = { count: number; resetAt: number };

const buckets = new Map<string, Hit>();
const MAX_KEYS = 20_000;

function sweep(now: number) {
  if (buckets.size < MAX_KEYS) return;
  for (const [key, hit] of buckets) {
    if (hit.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function consumeRateLimit(input: {
  key: string;
  limit: number;
  windowSec: number;
  now?: number;
}): RateLimitResult {
  const now = input.now ?? Date.now();
  sweep(now);
  const current = buckets.get(input.key);
  if (!current || current.resetAt <= now) {
    buckets.set(input.key, {
      count: 1,
      resetAt: now + input.windowSec * 1000,
    });
    return { ok: true, remaining: input.limit - 1, retryAfterSec: 0 };
  }
  current.count += 1;
  if (current.count > input.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }
  return {
    ok: true,
    remaining: input.limit - current.count,
    retryAfterSec: 0,
  };
}

/** 登录成功后清掉计数，避免正常用户被自己之前的手滑拖累 */
export function resetRateLimit(key: string) {
  buckets.delete(key);
}

export function clearAllRateLimits() {
  buckets.clear();
}

/** 取客户端 IP：线上是 nginx 反代，真实 IP 在 X-Forwarded-For 第一段 */
export function clientIpFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return (req.headers.get("x-real-ip") || "").trim().slice(0, 64) || "unknown";
}

export function userAgentFromRequest(req: Request): string {
  return (req.headers.get("user-agent") || "").slice(0, 300);
}

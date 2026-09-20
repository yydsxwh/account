import {
  clearAllRateLimits,
  consumeRateLimit,
  resetRateLimit,
} from "./rate-limit";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

clearAllRateLimits();

const key = "login:1.2.3.4";
const base = 1_000_000;
for (let i = 0; i < 5; i += 1) {
  const result = consumeRateLimit({ key, limit: 5, windowSec: 60, now: base });
  assert(result.ok, `attempt ${i + 1} allowed`);
}

const blocked = consumeRateLimit({ key, limit: 5, windowSec: 60, now: base });
assert(!blocked.ok, "sixth attempt blocked");
assert(blocked.retryAfterSec > 0, "retry after is set");

// 窗口过去之后重新放行
const later = consumeRateLimit({
  key,
  limit: 5,
  windowSec: 60,
  now: base + 61_000,
});
assert(later.ok, "window rolls over");

// 不同 key 互不影响
assert(
  consumeRateLimit({ key: "login:9.9.9.9", limit: 1, windowSec: 60, now: base }).ok,
  "separate key",
);

resetRateLimit(key);
assert(
  consumeRateLimit({ key, limit: 1, windowSec: 60, now: base }).ok,
  "reset clears the counter",
);

clearAllRateLimits();
console.log("rate-limit ok");

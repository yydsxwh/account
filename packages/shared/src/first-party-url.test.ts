import {
  WWW_HOME_URL,
  keepNextHref,
  safeNextTarget,
  wechatReturnPath,
} from "./first-party-url";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

assert(safeNextTarget("/account") === "/account", "relative");
assert(safeNextTarget("//evil.com") === null, "protocol-relative");
assert(
  safeNextTarget("https://www.yydsxwh.com/orders") ===
    "https://www.yydsxwh.com/orders",
  "www next",
);
assert(safeNextTarget("https://evil.com/") === null, "third party");
assert(
  keepNextHref("/register", "https://www.yydsxwh.com/cart") ===
    "/register?next=https%3A%2F%2Fwww.yydsxwh.com%2Fcart",
  "keep next",
);
assert(
  wechatReturnPath("https://www.yydsxwh.com/account").startsWith(
    "/api/auth/continue?to=",
  ),
  "wechat wrap",
);
assert(wechatReturnPath("/studio") === "/studio", "wechat path");
assert(WWW_HOME_URL === "https://www.yydsxwh.com", "www home");
console.log("first-party-url ok");

import {
  formatScope,
  hasScope,
  isOpenIdRequest,
  parseScope,
  resolveGrantedScopes,
} from "./scopes";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

assert(parseScope("openid profile").length === 2, "parse");
assert(parseScope("  openid   email ").join(",") === "openid,email", "trim");
assert(parseScope("").length === 0, "empty");
assert(parseScope(null).length === 0, "null");
assert(formatScope(["openid", "openid", "email"]) === "openid email", "dedupe");

// 产品不能靠多写 scope 拿到没被授权的权限
const limited = resolveGrantedScopes({
  requested: "openid profile email entitlements.read",
  allowed: "openid profile",
});
assert(limited.granted.join(" ") === "openid profile", "only allowed scopes");
assert(
  limited.rejected.join(" ") === "email entitlements.read",
  "rejected list reported",
);

// 没写 scope 时退回产品的允许集合
const fallback = resolveGrantedScopes({ requested: "", allowed: "openid email" });
assert(fallback.granted.join(" ") === "openid email", "default to allowed");

const none = resolveGrantedScopes({ requested: "calendar.write", allowed: "openid" });
assert(none.granted.length === 0, "nothing granted");

assert(hasScope("openid email", "email"), "hasScope string");
assert(hasScope(["openid"], "openid"), "hasScope array");
assert(!hasScope("openid", "email"), "hasScope negative");

assert(isOpenIdRequest(["openid", "profile"]), "openid present");
assert(!isOpenIdRequest(["profile"]), "openid absent");

console.log("scopes ok");

import {
  isAllowedRedirectUri,
  normalizeRedirectUri,
  serializeUriList,
  validateRegisteredRedirectUri,
} from "./redirect-uri";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const client = {
  redirectUris: serializeUriList([
    "https://rishi.yydsxwh.com/api/auth/callback",
    "http://localhost:4000/callback",
    "/demo/docs/callback",
  ]),
};
const ACCOUNT = "https://account.yydsxwh.com";

assert(
  isAllowedRedirectUri(client, "https://rishi.yydsxwh.com/api/auth/callback"),
  "exact match",
);
assert(
  isAllowedRedirectUri(client, "http://localhost:4000/callback"),
  "localhost http allowed for dev",
);

// 开放重定向的常见几种写法都必须被拒
assert(!isAllowedRedirectUri(client, "https://evil.com/cb"), "other host");
assert(
  !isAllowedRedirectUri(client, "https://rishi.yydsxwh.com.evil.com/api/auth/callback"),
  "suffix host trick",
);
assert(
  !isAllowedRedirectUri(client, "https://rishi.yydsxwh.com/api/auth/callback/../../evil"),
  "path traversal",
);
assert(
  !isAllowedRedirectUri(client, "https://rishi.yydsxwh.com/api/auth/callback2"),
  "prefix is not a match",
);
assert(
  !isAllowedRedirectUri(client, "https://rishi.yydsxwh.com/api/auth/callback?next=x"),
  "extra query is not a match",
);
assert(
  !isAllowedRedirectUri(client, "http://rishi.yydsxwh.com/api/auth/callback"),
  "downgrade to http rejected",
);
assert(
  !isAllowedRedirectUri({ redirectUris: serializeUriList(["https://*.yydsxwh.com/cb"]) },
    "https://evil.yydsxwh.com/cb"),
  "wildcard never matches",
);
assert(!isAllowedRedirectUri(client, ""), "empty");
assert(
  !isAllowedRedirectUri(client, "javascript:alert(1)"),
  "javascript scheme",
);

// 账号中心自身的相对回调只在同 origin 下成立
assert(
  isAllowedRedirectUri(client, `${ACCOUNT}/demo/docs/callback`, ACCOUNT),
  "relative callback on account origin",
);
assert(
  !isAllowedRedirectUri(client, "https://evil.com/demo/docs/callback", ACCOUNT),
  "relative callback on other origin",
);
assert(
  !isAllowedRedirectUri(client, `${ACCOUNT}/demo/docs/callback`),
  "relative callback needs account origin",
);

assert(normalizeRedirectUri("https://a.com/cb#frag") === "", "fragment rejected");
assert(
  normalizeRedirectUri("https://user:pw@a.com/cb") === "",
  "credentials in uri rejected",
);

assert(!validateRegisteredRedirectUri("").ok, "register empty");
assert(!validateRegisteredRedirectUri("https://a.com/*").ok, "register wildcard");
assert(!validateRegisteredRedirectUri("http://a.com/cb").ok, "register plain http");
assert(validateRegisteredRedirectUri("https://a.com/cb").ok, "register https");
assert(
  validateRegisteredRedirectUri("http://localhost:3000/cb").ok,
  "register localhost",
);

console.log("redirect-uri ok");

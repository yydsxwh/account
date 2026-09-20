import { parsePasswordLoginId } from "./password-login-id";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const kk = parsePasswordLoginId("100", "kk");
assert(kk.ok && kk.via === "kk" && kk.kkNumber === 100, "kk 100");

const badKk = parsePasswordLoginId("yydsboss01", "kk");
assert(!badKk.ok, "username rejected on kk tab");

const username = parsePasswordLoginId("yydsboss01", "username");
assert(
  username.ok && username.via === "username" && username.username === "yydsboss01",
  "username",
);

const digitsOnUsername = parsePasswordLoginId("100", "username");
assert(!digitsOnUsername.ok, "kk rejected on username tab");

const anyKk = parsePasswordLoginId("107", "any");
assert(anyKk.ok && anyKk.via === "kk", "any still accepts kk");

const empty = parsePasswordLoginId("", "kk");
assert(!empty.ok, "empty kk");

console.log("password-login-id ok");

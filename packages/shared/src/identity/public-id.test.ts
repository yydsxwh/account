import {
  generateUserPublicId,
  isUserPublicId,
  USER_ID_PREFIX,
} from "./public-id";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const id = generateUserPublicId();
assert(id.startsWith(USER_ID_PREFIX), "prefix");
assert(isUserPublicId(id), "self check");
assert(id.length === USER_ID_PREFIX.length + 26, "length");

const seen = new Set<string>();
for (let i = 0; i < 2000; i += 1) seen.add(generateUserPublicId());
assert(seen.size === 2000, "no collision in 2000 draws");

assert(!isUserPublicId(""), "empty");
assert(!isUserPublicId("usr_"), "prefix only");
assert(!isUserPublicId("abc"), "garbage");
assert(!isUserPublicId("user@example.com"), "email is not an id");
assert(!isUserPublicId(id.toLowerCase()), "lowercase body rejected");
// 排除掉的易混字母不应出现
assert(!/[ILOU]/.test(id.slice(USER_ID_PREFIX.length)), "no ambiguous letters");

console.log("public-id ok");

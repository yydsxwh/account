/**
 * 后台只存 client_secret 的哈希。明文只在创建 / 轮换时返回一次。
 */
import { verifyPassword } from "../packages/shared/src/password";
import {
  generateClientSecret,
  hashClientSecret,
} from "../packages/shared/src/oidc/clients";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const first = generateClientSecret();
const second = generateClientSecret();
assert(first.startsWith("ys_"), `密钥应以 ys_ 开头，实际：${first}`);
assert(first !== second, "连续两次生成不应相同");
assert(!first.includes(" "), "密钥不应含空格");

const stored = await hashClientSecret(first);
assert(stored !== first, "库里不得保存明文");
assert(await verifyPassword(first, stored), "明文应能通过哈希校验");
assert(!(await verifyPassword(second, stored)), "别的密钥不得通过旧哈希");

const rotated = generateClientSecret();
const rotatedHash = await hashClientSecret(rotated);
assert(!(await verifyPassword(first, rotatedHash)), "轮换后旧密钥立刻失效");
assert(await verifyPassword(rotated, rotatedHash), "新密钥应能通过新哈希");

console.log("studio-secret: generate / hash / rotate semantics ok");

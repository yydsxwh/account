import {
  ONE_TIME_SECRET_WARNING,
  buildSecretEnvFile,
  copySecretText,
  oneTimeClientSecret,
  secretEnvFilename,
  serializeStudioApp,
} from "../src/lib/one-time-client-secret";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

assert(
  ONE_TIME_SECRET_WARNING.includes("只显示一次"),
  "警告必须写明只显示一次",
);
assert(secretEnvFilename("rishi") === "rishi-account-secret.env", "日事文件名");
assert(
  secretEnvFilename("weird id!") === "weird-id--account-secret.env",
  "文件名要去掉不安全字符",
);

const env = buildSecretEnvFile({
  clientId: "rishi",
  clientSecret: "ys_demo_secret",
});
assert(env.includes("ACCOUNT_ISSUER=https://account.yydsxwh.com"), "issuer");
assert(env.includes("ACCOUNT_CLIENT_ID=rishi"), "client id");
assert(env.includes("ACCOUNT_CLIENT_SECRET=ys_demo_secret"), "secret in file");
assert(!env.includes("undefined"), "env 文件不能有 undefined");

const copied = copySecretText("rishi", "ys_demo_secret");
assert(copied.includes("Client ID: rishi"), "复制文本含 Client ID");
assert(copied.includes("Client Secret: ys_demo_secret"), "复制文本含密钥");

assert(
  oneTimeClientSecret("confidential", "ys_plain") === "ys_plain",
  "confidential 创建必须返回明文",
);
assert(
  oneTimeClientSecret("public", "ys_plain") === undefined,
  "public 创建不得返回明文",
);
assert(oneTimeClientSecret("confidential", undefined) === undefined, "没有明文就不返回");

const listed = serializeStudioApp({
  id: "1",
  clientId: "rishi",
  clientType: "confidential",
  name: "颗秒日事",
  homepageUrl: "https://www.yydsxwh.com/products/days/",
  redirectUris: ["https://www.yydsxwh.com/api/days/auth/callback"],
  enabled: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
});
assert(!("clientSecret" in listed), "列表序列化绝不能带 secret 字段");
assert(JSON.stringify(listed).includes("rishi"), "列表仍有 client_id");
assert(!JSON.stringify(listed).includes("ys_"), "列表 JSON 不得出现 ys_ 明文");

console.log("one-time-client-secret: copy / download / public-vs-confidential ok");

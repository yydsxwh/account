import {
  ONE_TIME_SECRET_WARNING,
  buildSecretEnvFile,
  oneTimeClientSecret,
  secretEnvFilename,
} from "../src/helpers/one-time-client-secret";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(
  ONE_TIME_SECRET_WARNING.includes("只显示一次"),
  "警告必须明确密钥只显示一次",
);
assert(
  secretEnvFilename("rishi") === "rishi-account-secret.env",
  "下载文件名应稳定",
);

const env = buildSecretEnvFile({
  clientId: "rishi",
  clientSecret: "ys_demo_secret",
});
assert(
  env.includes("ACCOUNT_ISSUER=https://account.yydsxwh.com"),
  "env 必须包含 issuer",
);
assert(env.includes("ACCOUNT_CLIENT_ID=rishi"), "env 必须包含 client id");
assert(
  env.includes("ACCOUNT_CLIENT_SECRET=ys_demo_secret"),
  "env 必须包含本次明文 secret",
);
assert(
  oneTimeClientSecret("confidential", "ys_demo_secret") === "ys_demo_secret",
  "confidential 应显示本次 secret",
);
assert(
  oneTimeClientSecret("public", "ys_demo_secret") === undefined,
  "public 不应显示 secret",
);

console.log("one-time-client-secret: ok");

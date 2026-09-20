export const ONE_TIME_SECRET_WARNING =
  "此密钥只显示一次，关闭后无法再次查看；丢失只能重新生成。";

export const ACCOUNT_ISSUER_DEFAULT = "https://account.yydsxwh.com";

export function secretEnvFilename(clientId: string) {
  const safe = (clientId || "client").replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `${safe}-account-secret.env`;
}

export function buildSecretEnvFile(input: {
  clientId: string;
  clientSecret: string;
  issuer?: string;
}) {
  const issuer = (input.issuer || ACCOUNT_ISSUER_DEFAULT).replace(/\/+$/, "");
  return [
    `ACCOUNT_ISSUER=${issuer}`,
    `ACCOUNT_CLIENT_ID=${input.clientId}`,
    `ACCOUNT_CLIENT_SECRET=${input.clientSecret}`,
    "",
  ].join("\n");
}

export function oneTimeClientSecret(
  clientType: string | undefined,
  plaintext: string | undefined,
) {
  if (!plaintext || clientType === "public") return undefined;
  return plaintext;
}

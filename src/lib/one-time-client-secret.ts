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

export function copySecretText(clientId: string, clientSecret: string) {
  return `Client ID: ${clientId}\nClient Secret: ${clientSecret}`;
}

export function oneTimeClientSecret(
  clientType: string | undefined,
  plaintext: string | undefined,
) {
  if (!plaintext) return undefined;
  if (clientType === "public") return undefined;
  return plaintext;
}

export function serializeStudioApp(row: {
  id: string;
  clientId: string;
  clientType: string;
  name: string;
  description?: string;
  homepageUrl: string;
  redirectUris: string[] | string;
  allowedScopes?: string[] | string;
  grantTypes?: string[] | string;
  requirePkce?: boolean;
  enabled: boolean;
  createdAt: Date | string;
}) {
  return {
    id: row.id,
    clientId: row.clientId,
    clientType: row.clientType,
    name: row.name,
    description: row.description || "",
    homepageUrl: row.homepageUrl,
    redirectUris: Array.isArray(row.redirectUris) ? row.redirectUris : [],
    allowedScopes: Array.isArray(row.allowedScopes) ? row.allowedScopes : [],
    grantTypes: Array.isArray(row.grantTypes) ? row.grantTypes : [],
    requirePkce: Boolean(row.requirePkce),
    enabled: row.enabled,
    createdAt:
      typeof row.createdAt === "string" ? row.createdAt : row.createdAt.toISOString(),
  };
}

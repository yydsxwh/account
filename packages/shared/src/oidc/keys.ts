/**
 * ID Token 的 RS256 签名密钥。
 *
 * 取值顺序：
 * 1. OIDC_PRIVATE_KEY（PKCS#8 PEM）+ 可选 OIDC_KEY_ID —— 生产推荐，多实例必须用这个
 * 2. 数据库 SigningKey 表 —— 单机部署时首次启动自动生成并持久化
 *
 * 不用每次启动现生成内存密钥：那样重启后 JWKS 就变了，已签发的 ID Token 全部验不过。
 */

import crypto from "crypto";
import { exportJWK, importPKCS8, type JWK } from "jose";
import { prisma } from "../db";

export const SIGNING_ALG = "RS256";

/** jose 各大版本对密钥类型的命名不一样，跟着 importPKCS8 的返回类型走最稳 */
type SigningPrivateKey = Awaited<ReturnType<typeof importPKCS8>>;

export type ActiveSigningKey = {
  kid: string;
  alg: string;
  privateKey: SigningPrivateKey;
  publicJwk: JWK;
};

let cached: { at: number; key: ActiveSigningKey } | null = null;
const CACHE_MS = 60_000;

function kidFromJwk(jwk: JWK): string {
  const material = JSON.stringify({ e: jwk.e, kty: jwk.kty, n: jwk.n });
  return crypto
    .createHash("sha256")
    .update(material)
    .digest("base64url")
    .slice(0, 22);
}

/** 从 PKCS#8 私钥 PEM 推出对应的公钥 JWK */
async function publicJwkFromPrivatePem(pem: string): Promise<JWK> {
  const publicKey = crypto.createPublicKey({ key: pem, format: "pem" });
  return exportJWK(publicKey as unknown as Parameters<typeof exportJWK>[0]);
}

async function fromEnv(): Promise<ActiveSigningKey | null> {
  const pem = process.env.OIDC_PRIVATE_KEY?.trim();
  if (!pem) return null;
  // .env 里换行常写成 \n，还原成真正的换行才能解析
  const normalized = pem.includes("\\n") ? pem.replace(/\\n/g, "\n") : pem;
  const privateKey = await importPKCS8(normalized, SIGNING_ALG);
  const publicJwk = await publicJwkFromPrivatePem(normalized);
  const kid = process.env.OIDC_KEY_ID?.trim() || kidFromJwk(publicJwk);
  return {
    kid,
    alg: SIGNING_ALG,
    privateKey,
    publicJwk: { ...publicJwk, kid, alg: SIGNING_ALG, use: "sig" },
  };
}

function generatePrivateKeyPem() {
  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

async function fromDatabase(): Promise<ActiveSigningKey> {
  const existing = await prisma.signingKey.findFirst({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return {
      kid: existing.kid,
      alg: existing.alg,
      privateKey: await importPKCS8(existing.privateKeyPem, existing.alg),
      publicJwk: JSON.parse(existing.publicJwk) as JWK,
    };
  }

  const privateKeyPem = generatePrivateKeyPem();
  const rawJwk = await publicJwkFromPrivatePem(privateKeyPem);
  const kid = kidFromJwk(rawJwk);
  const publicJwk: JWK = { ...rawJwk, kid, alg: SIGNING_ALG, use: "sig" };
  await prisma.signingKey.create({
    data: {
      kid,
      alg: SIGNING_ALG,
      privateKeyPem,
      publicJwk: JSON.stringify(publicJwk),
    },
  });
  return {
    kid,
    alg: SIGNING_ALG,
    privateKey: await importPKCS8(privateKeyPem, SIGNING_ALG),
    publicJwk,
  };
}

export async function getActiveSigningKey(): Promise<ActiveSigningKey> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.key;
  const key = (await fromEnv()) ?? (await fromDatabase());
  cached = { at: Date.now(), key };
  return key;
}

export function invalidateSigningKeyCache() {
  cached = null;
}

/** JWKS 只吐公钥。退役的密钥也留一段时间，老 ID Token 才验得过 */
export async function listPublicJwks(): Promise<JWK[]> {
  const active = await getActiveSigningKey();
  const retired = await prisma.signingKey.findMany({
    where: { active: false },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  const jwks: JWK[] = [active.publicJwk];
  for (const row of retired) {
    try {
      const jwk = JSON.parse(row.publicJwk) as JWK;
      if (jwk.kid && jwk.kid !== active.kid) jwks.push(jwk);
    } catch {
      /* 坏数据直接跳过，不要让 JWKS 整个挂掉 */
    }
  }
  return jwks;
}

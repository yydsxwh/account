import {
  createPkcePair,
  deriveCodeChallenge,
  isSupportedPkceMethod,
  isValidCodeVerifier,
  verifyCodeChallenge,
} from "./pkce";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

// RFC 7636 附录 B 的官方测试向量
const RFC_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const RFC_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
assert(deriveCodeChallenge(RFC_VERIFIER) === RFC_CHALLENGE, "rfc7636 vector");

const pair = createPkcePair();
assert(
  verifyCodeChallenge({
    verifier: pair.verifier,
    challenge: pair.challenge,
    method: "S256",
  }),
  "round trip",
);

assert(
  !verifyCodeChallenge({
    verifier: createPkcePair().verifier,
    challenge: pair.challenge,
    method: "S256",
  }),
  "wrong verifier rejected",
);

assert(
  !verifyCodeChallenge({
    verifier: pair.verifier,
    challenge: pair.challenge,
    method: "plain",
  }),
  "plain method rejected",
);

assert(!isSupportedPkceMethod("plain"), "plain unsupported");
assert(!isSupportedPkceMethod(""), "empty unsupported");
assert(isSupportedPkceMethod("S256"), "S256 supported");

assert(!isValidCodeVerifier("short"), "too short verifier");
assert(!isValidCodeVerifier("a".repeat(129)), "too long verifier");
assert(!isValidCodeVerifier(`${"a".repeat(42)}!`), "bad charset");
assert(isValidCodeVerifier("a".repeat(43)), "min length ok");

assert(
  !verifyCodeChallenge({ verifier: pair.verifier, challenge: "", method: "S256" }),
  "empty challenge rejected",
);

console.log("pkce ok");

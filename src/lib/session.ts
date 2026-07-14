// Session tokens and helpers built on the Web Crypto API so they work in BOTH
// the Node route-handler runtime and the middleware/proxy runtime.

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Web Crypto accepts a Uint8Array at runtime; this bridges the TS 5.7 generic
// Uint8Array to the DOM BufferSource parameter type without changing behavior.
function src(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", src(encoder.encode(secret)), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export type SessionClaims = {
  sub: string; // user id
  roles: string[]; // capability set (UserRole[])
  exp: number; // unix seconds
};

// Compact HMAC-signed token: base64url(payload).base64url(signature).
export async function signSession(claims: SessionClaims, secret: string): Promise<string> {
  const payload = base64UrlEncode(encoder.encode(JSON.stringify(claims)));
  const key = await hmacKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, src(encoder.encode(payload))));
  return `${payload}.${base64UrlEncode(signature)}`;
}

// Returns the claims if the signature is valid and the token is unexpired, else null.
export async function verifySession(token: string, secret: string): Promise<SessionClaims | null> {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payloadPart = token.slice(0, dot);
  const signaturePart = token.slice(dot + 1);

  try {
    const key = await hmacKey(secret);
    const valid = await crypto.subtle.verify("HMAC", key, src(base64UrlDecode(signaturePart)), src(encoder.encode(payloadPart)));
    if (!valid) return null;

    const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadPart))) as SessionClaims;
    if (typeof claims.sub !== "string" || !Array.isArray(claims.roles) || typeof claims.exp !== "number") {
      return null;
    }
    if (claims.exp * 1000 <= Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

// High-entropy opaque token (for mobile refresh tokens / server-side session ids).
export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

// SHA-256 of a token, for storing in Session.tokenHash / User.activationCodeHash
// (the token itself is never persisted).
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", src(encoder.encode(token)));
  return base64UrlEncode(new Uint8Array(digest));
}

// Human-friendly one-time activation code, e.g. "K7Q2-9XP4" (no ambiguous chars).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateActivationCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < 8; i += 1) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

// Compare/hash codes case-insensitively and ignoring separators/spaces, so a
// user can type "k7q2-9xp4", "K7Q29XP4", etc. and still match.
export function normalizeActivationCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

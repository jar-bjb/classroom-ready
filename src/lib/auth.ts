import { cookies } from "next/headers";
import { signSession, verifySession, type SessionClaims } from "@/lib/session";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/access";

// Server-only session helpers (use next/headers). NOT for the middleware —
// proxy.ts reads request.cookies + verifySession directly.

const cookiePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "/";

function getSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 16 ? secret : null;
}

// Issue a signed session cookie. Returns false if SESSION_SECRET is not set
// (caller surfaces a config error instead of a silent broken login).
export async function startSession(userId: string, roles: string[]): Promise<boolean> {
  const secret = getSecret();
  if (!secret) return false;
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = await signSession({ sub: userId, roles, exp }, secret);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: cookiePath,
    maxAge: SESSION_TTL_SECONDS,
  });
  return true;
}

export async function readSession(): Promise<SessionClaims | null> {
  const secret = getSecret();
  if (!secret) return null;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token, secret);
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete({ name: SESSION_COOKIE, path: cookiePath });
}

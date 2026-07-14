import { readSession } from "@/lib/auth";
import { hasRole } from "@/lib/access";

// Authorize a Server Action (or route handler) by the CALLER's session —
// defense in depth that does NOT depend on which page path the action was
// POSTed to. This matters because a Next.js action id is registered for every
// route whose page imports the action module, so route-middleware path gating
// alone lets a low-privilege user reach an action exported from a shared module.
//
// Dual-mode transition: a legacy basic-auth request carries no per-user session.
// It can only have reached here by passing the middleware's basic-auth challenge
// (the shared `admjar` admin credential), so "no session" is treated as allowed.
// Once basic-auth is retired in Fase D, no-session requests are rejected at the
// middleware anyway. Revisit this when [[classroom-ready-hardening-state]] Fase D
// lands: flip the default to deny.
export async function requireRole(...allowed: string[]): Promise<void> {
  const session = await readSession();
  if (!session) return; // legacy basic-auth: guarded by the middleware
  if (allowed.some((role) => hasRole(session.roles, role))) return;
  throw new Error("Tindakan ini tidak diizinkan untuk peran Anda.");
}

// Boolean variant for route handlers that return their own HTTP response
// instead of throwing. Same dual-mode semantics as requireRole.
export async function callerHasRole(...allowed: string[]): Promise<boolean> {
  const session = await readSession();
  if (!session) return true; // legacy basic-auth: guarded by the middleware
  return allowed.some((role) => hasRole(session.roles, role));
}

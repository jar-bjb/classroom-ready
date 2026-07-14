import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";
import { SESSION_COOKIE, homePathForRoles, isPublicPath, rolesAllowPath } from "@/lib/access";

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; "),
};

function applySecurityHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

function appRelativePath(request: NextRequest): string {
  const basePath = request.nextUrl.basePath;
  return basePath && request.nextUrl.pathname.startsWith(basePath)
    ? request.nextUrl.pathname.slice(basePath.length) || "/"
    : request.nextUrl.pathname;
}

async function getRequestSession(request: NextRequest) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) return null;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token, secret);
}

// Constant-time-ish comparison, independent of runtime crypto availability
// (works in both Edge and Node runtimes). Avoids leaking length/prefix via
// the short-circuit timing of `===`.
function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

function isAuthorized(request: NextRequest) {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD;
  // Fail closed: if credentials are not configured, deny access rather than
  // exposing the entire app to everyone.
  if (!expectedUser || !expectedPassword) return false;

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return false;

  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    // Split on the first colon only, so passwords containing ":" stay intact.
    const separator = decoded.indexOf(":");
    if (separator === -1) return false;
    const user = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    // Evaluate both comparisons before combining to avoid short-circuit timing.
    const userOk = safeEqual(user, expectedUser);
    const passwordOk = safeEqual(password, expectedPassword);
    return userOk && passwordOk;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const path = appRelativePath(request);

  if (!isPublicPath(path)) {
    const session = await getRequestSession(request);
    if (session) {
      // Authenticated via new per-user session → gate by role.
      if (!rolesAllowPath(session.roles, path)) {
        const url = request.nextUrl.clone();
        url.pathname = `${request.nextUrl.basePath}${homePathForRoles(session.roles)}`;
        return applySecurityHeaders(NextResponse.redirect(url));
      }
    } else if (!isAuthorized(request)) {
      // No session and no legacy basic-auth → keep the basic-auth challenge.
      // Dual-mode transition: existing basic-auth access is unaffected.
      return applySecurityHeaders(
        new NextResponse("Authentication required", {
          status: 401,
          headers: { "WWW-Authenticate": 'Basic realm="Classroom Ready", charset="UTF-8"' },
        }),
      );
    }
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|company-logo.jpg).*)"],
};

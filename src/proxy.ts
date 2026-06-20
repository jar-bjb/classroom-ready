import { NextRequest, NextResponse } from "next/server";

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

function isPublicIntegrationRoute(request: NextRequest) {
  return request.nextUrl.pathname === "/api/integration/dashboard-summary";
}

function isAuthorized(request: NextRequest) {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD;
  if (!expectedUser || !expectedPassword) return true;

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return false;

  try {
    const [user, password] = Buffer.from(header.slice(6), "base64").toString("utf8").split(":");
    return user === expectedUser && password === expectedPassword;
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  if (!isPublicIntegrationRoute(request) && !isAuthorized(request)) {
    return applySecurityHeaders(
      new NextResponse("Authentication required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Classroom Ready", charset="UTF-8"' },
      }),
    );
  }

  const response = NextResponse.next();

  return applySecurityHeaders(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

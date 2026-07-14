// Pure auth access rules + constants. MUST NOT import next/headers or anything
// Node-only, so it is safe to import from the middleware (proxy.ts).

export const SESSION_COOKIE = "cr_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours

// App-relative paths (basePath already stripped) reachable without a session.
export function isPublicPath(path: string): boolean {
  return (
    path === "/login" ||
    path === "/aktivasi" ||
    path === "/api/health" ||
    path === "/api/integration/dashboard-summary"
  );
}

export function hasRole(roles: string[] | null | undefined, role: string): boolean {
  return Array.isArray(roles) && roles.includes(role);
}

// Coarse route gating for a single capability. Per-action authorization is
// enforced separately inside the Server Actions (defense in depth).
function singleRoleAllows(role: string, path: string): boolean {
  if (role === "ADMIN") return true;
  if (path.startsWith("/admin")) return false; // /admin/* is ADMIN-only
  if (role === "SUPERVISOR") return true; // supervisor (assigner): oversight of everything except /admin
  if (role === "FOLLOWUP") {
    // tindak lanjut: the issue-handling area + root/api
    return path === "/" || path.startsWith("/supervisor") || path.startsWith("/api");
  }
  if (role === "INSPECTOR") {
    return path === "/" || path.startsWith("/mobile") || path.startsWith("/api");
  }
  return path === "/" || path.startsWith("/api");
}

// A multi-role user may reach a path if ANY of their capabilities allows it
// (e.g. [INSPECTOR, SUPERVISOR] reaches both /mobile and /supervisor).
export function rolesAllowPath(roles: string[], path: string): boolean {
  return roles.some((role) => singleRoleAllows(role, path));
}

// Landing page after login / when redirected out of a forbidden area.
export function homePathForRoles(roles: string[]): string {
  if (roles.includes("ADMIN")) return "/dashboard";
  if (roles.includes("SUPERVISOR") || roles.includes("FOLLOWUP")) return "/supervisor/issues";
  return "/mobile";
}

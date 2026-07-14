import { NextRequest } from "next/server";
import { filtersFromSearchParams, getAdminLogData, issueLogRows, rowsToExcelHtml } from "@/lib/admin-log-export";
import { callerHasRole } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // The route lives under /api (open to every role at the middleware) but the
  // data is admin-only, so re-check the caller's role here. Legacy basic-auth
  // (no session) is allowed — it already passed the middleware admin credential.
  if (!(await callerHasRole("ADMIN"))) {
    return new Response("Forbidden", { status: 403 });
  }

  const filters = filtersFromSearchParams(request.nextUrl.searchParams);
  const { issues } = await getAdminLogData(filters);
  const rows = issueLogRows(issues);
  const html = rowsToExcelHtml(rows);
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(html, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="log-issue-kelas-${stamp}.xls"`,
      "Cache-Control": "no-store",
    },
  });
}

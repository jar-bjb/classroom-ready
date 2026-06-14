import { NextRequest } from "next/server";
import { filtersFromSearchParams, getAdminLogData, issueLogRows, rowsToExcelHtml } from "@/lib/admin-log-export";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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

import { prisma } from "@/lib/prisma";
import { categoryLabel, inspectionResultLabel } from "@/lib/status";
import { formatDateTime } from "@/lib/dates";
import type { IssueStatus } from "@/generated/prisma/client";

const activeIssueStatuses: IssueStatus[] = ["OPEN", "IN_PROGRESS"];
const allIssueStatuses: IssueStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CANCELLED"];

export interface LogFilters {
  roomId?: string;
  status?: string;
  from?: string;
  to?: string;
}

function parseDateStart(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000+07:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseDateEnd(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T23:59:59.999+07:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function filtersFromSearchParams(searchParams: URLSearchParams | Record<string, string | string[] | undefined>): LogFilters {
  const get = (key: string) => {
    if (searchParams instanceof URLSearchParams) return searchParams.get(key) || undefined;
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    roomId: get("roomId"),
    status: get("status"),
    from: get("from"),
    to: get("to"),
  };
}

export function logFilterQuery(filters: LogFilters) {
  const status = filters.status && allIssueStatuses.includes(filters.status as IssueStatus) ? (filters.status as IssueStatus) : undefined;
  const createdAt: { gte?: Date; lte?: Date } = {};
  const from = parseDateStart(filters.from);
  const to = parseDateEnd(filters.to);
  if (from) createdAt.gte = from;
  if (to) createdAt.lte = to;

  return {
    ...(filters.roomId ? { roomId: filters.roomId } : {}),
    ...(status ? { status } : {}),
    ...(from || to ? { createdAt } : {}),
  };
}

export async function getAdminLogData(filters: LogFilters = {}) {
  const [rooms, issues] = await Promise.all([
    prisma.room.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.issue.findMany({
      where: logFilterQuery(filters),
      orderBy: { createdAt: "desc" },
      include: {
        room: true,
        createdBy: true,
        session: { include: { inspector: true } },
        response: { include: { item: true } },
      },
    }),
  ]);

  return { rooms, issues };
}

export type AdminLogIssue = Awaited<ReturnType<typeof getAdminLogData>>["issues"][number];

export function issueStatusLabel(status: IssueStatus | string) {
  const labels: Record<string, string> = {
    OPEN: "Terbuka",
    IN_PROGRESS: "Diproses",
    RESOLVED: "Selesai",
    CANCELLED: "Dibatalkan",
  };
  return labels[status] ?? status;
}

export function issueLogRows(issues: AdminLogIssue[]) {
  return issues.map((issue) => ({
    "Tanggal Issue": formatDateTime(issue.createdAt),
    "Kelas": issue.room.code,
    "Nama Kelas": issue.room.name,
    "Judul Issue": issue.title,
    "Kategori": categoryLabel(issue.category),
    "Prioritas": issue.priority,
    "Status": issueStatusLabel(issue.status),
    "Petugas Pemeriksa": issue.session?.inspector?.name || issue.createdBy?.name || "-",
    "Hasil Pemeriksaan": issue.session ? inspectionResultLabel(issue.session.result) : "-",
    "Item Checklist": issue.response?.item?.prompt || "-",
    "Catatan Temuan": issue.description || "-",
    "Ditugaskan Ke": issue.assignedRole || "-",
    "Waktu Close": formatDateTime(issue.resolvedAt),
    "Catatan Close": issue.resolutionNote || "-",
  }));
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function rowsToExcelHtml(rows: Record<string, string>[]) {
  const headers = rows[0] ? Object.keys(rows[0]) : ["Tidak ada data"];
  const bodyRows = rows.length > 0 ? rows : [{ "Tidak ada data": "Tidak ada log sesuai filter." }];
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("")}</tr></thead><tbody>${bodyRows
    .map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(row[header] || "")}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></body></html>`;
}

export { activeIssueStatuses, allIssueStatuses };

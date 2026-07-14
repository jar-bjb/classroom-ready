import { prisma } from "@/lib/prisma";
import { categoryLabel, inspectionResultLabel } from "@/lib/status";
import { formatDateTime } from "@/lib/dates";
import { issueDisplayTitle, issueResponseValueLabel } from "@/lib/issues";
import type { IssueStatus } from "@/generated/prisma/client";

const activeIssueStatuses: IssueStatus[] = ["OPEN", "IN_PROGRESS"];
const allIssueStatuses: IssueStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CANCELLED"];

export interface LogFilters {
  roomId?: string;
  status?: string;
  from?: string;
  to?: string;
}

// Day boundaries are interpreted in WITA (UTC+8), Banjarbaru's local time, so a
// date filter of e.g. 2026-07-14 covers that whole local day (not the +07:00/WIB
// window used before, which was off by an hour).
function parseDateStart(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000+08:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseDateEnd(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T23:59:59.999+08:00`);
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
        resolvedBy: true,
        session: { include: { inspector: true } },
        response: { include: { item: true } },
        logs: { orderBy: { createdAt: "asc" }, include: { actor: true } },
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
    "Temuan": issueDisplayTitle(issue),
    "Kategori": categoryLabel(issue.category),
    "Prioritas": issue.priority,
    "Status": issueStatusLabel(issue.status),
    "Petugas Pemeriksa": issue.session?.inspector?.name || issue.createdBy?.name || "-",
    "Hasil Pemeriksaan": issue.session ? inspectionResultLabel(issue.session.result) : "-",
    "Item Checklist": issue.response?.item?.prompt || "-",
    "Status Item": issueResponseValueLabel(issue.response?.value),
    "Catatan Temuan": issue.description || "-",
    "Ditugaskan Ke": issue.assignedRole || "-",
    "Waktu Close": formatDateTime(issue.resolvedAt),
    "Ditutup Oleh": issue.resolvedBy?.name || "-",
    "Catatan Close": issue.resolutionNote || "-",
    "Log Lifecycle": issue.logs.map((log) => `${formatDateTime(log.createdAt)} ${log.actor?.name || "Sistem"}: ${log.action}${log.newStatus ? ` -> ${issueStatusLabel(log.newStatus)}` : ""}${log.note ? ` (${log.note})` : ""}`).join(" | ") || "-",
  }));
}

// Neutralize spreadsheet formula/command injection: a cell whose text starts with
// = + - @ (or a control char) is treated as a live formula by Excel/Sheets. User
// free-text (issue notes, resolution notes) flows into this export, so prefix such
// values with an apostrophe to force them to be read as text.
function neutralizeFormula(value: string) {
  return /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeCell(value: unknown) {
  return escapeHtml(neutralizeFormula(String(value ?? "")));
}

export function rowsToExcelHtml(rows: Record<string, string>[]) {
  const headers = rows[0] ? Object.keys(rows[0]) : ["Tidak ada data"];
  const bodyRows = rows.length > 0 ? rows : [{ "Tidak ada data": "Tidak ada log sesuai filter." }];
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("")}</tr></thead><tbody>${bodyRows
    .map((row) => `<tr>${headers.map((header) => `<td>${escapeCell(row[header] || "")}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></body></html>`;
}

export { activeIssueStatuses, allIssueStatuses };

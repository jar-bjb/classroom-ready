import { prisma } from "@/lib/prisma";
import { getEffectiveRoomStatus, inspectionResultLabel, roomStatusLabel } from "@/lib/status";
import { issueDisplayTitle } from "@/lib/issues";

export const dynamic = "force-dynamic";

const activeIssueStatuses = ["OPEN", "IN_PROGRESS"] as const;
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";

// Restrict cross-origin reads to the known dashboard origin instead of "*",
// so arbitrary third-party sites cannot read this operational data from a
// visitor's browser. Same-origin and server-side consumers are unaffected.
const allowedOrigin = process.env.INTEGRATION_ALLOWED_ORIGIN?.trim() || "https://pengajaran.updlbanjarbaru.web.id";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  Vary: "Origin",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Cache-Control": "no-store",
};

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      ...corsHeaders,
      ...init.headers,
    },
  });
}

function toIso(value?: Date | null) {
  return value ? value.toISOString() : null;
}

function countBy<T extends string>(items: T[]) {
  return items.reduce<Record<T, number>>((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {} as Record<T, number>);
}

function appPath(path: `/${string}`) {
  return `${basePath}${path}`;
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  try {
    const [rooms, latestInspections, openIssues] = await Promise.all([
      prisma.room.findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
        include: {
          type: { select: { name: true, slug: true } },
          issues: {
            where: { status: { in: [...activeIssueStatuses] } },
            select: { id: true, priority: true, status: true },
          },
          inspections: {
            where: { status: "SUBMITTED" },
            orderBy: { submittedAt: "desc" },
            take: 1,
            select: {
              id: true,
              result: true,
              submittedAt: true,
              inspector: { select: { name: true } },
            },
          },
        },
      }),
      prisma.inspectionSession.findMany({
        where: { status: "SUBMITTED" },
        orderBy: { submittedAt: "desc" },
        take: 6,
        include: { room: true, inspector: true },
      }),
      prisma.issue.findMany({
        where: { status: { in: [...activeIssueStatuses] } },
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        take: 10,
        include: { room: true, response: { include: { item: true } } },
      }),
    ]);

    const roomRows = rooms.map((room) => {
      const effectiveStatus = getEffectiveRoomStatus(room.status, room.certificationExpiresAt);
      const latestInspection = room.inspections[0] || null;

      return {
        id: room.id,
        code: room.code,
        name: room.name,
        type: room.type.name,
        location: room.location,
        capacity: room.capacity,
        status: effectiveStatus,
        statusLabel: roomStatusLabel(effectiveStatus),
        certificationExpiresAt: toIso(room.certificationExpiresAt),
        latestInspectionAt: toIso(latestInspection?.submittedAt),
        latestInspectionResult: latestInspection?.result ? inspectionResultLabel(latestInspection.result) : null,
        // Inspector name intentionally omitted: this endpoint is public/unauthenticated (PII).
        openIssuesCount: room.issues.length,
        priorityIssuesCount: room.issues.filter((issue) => ["P1", "P2"].includes(issue.priority)).length,
        links: {
          report: appPath(`/admin/rooms/${room.id}`),
          inspect: appPath(`/mobile/rooms/${room.id}/inspect`),
        },
      };
    });

    const statusCounts = countBy(roomRows.map((room) => room.statusLabel));
    const readyRooms = roomRows.filter((room) => room.status === "CERTIFIED").length;
    const needsActionRooms = roomRows.filter((room) => ["CERTIFIED_WITH_NOTES", "NOT_CERTIFIED"].includes(room.status)).length;
    const uncheckedRooms = roomRows.filter((room) => ["UNCHECKED", "EXPIRED"].includes(room.status)).length;
    const priorityIssues = openIssues.filter((issue) => ["P1", "P2"].includes(issue.priority)).length;

    return jsonResponse({
      ok: true,
      generatedAt: new Date().toISOString(),
      source: "classroom-ready",
      links: {
        dashboard: appPath("/dashboard"),
        mobile: appPath("/mobile"),
        supervisorInbox: appPath("/supervisor/issues"),
        adminRooms: appPath("/admin/rooms"),
        adminLogs: appPath("/admin/logs"),
        templates: appPath("/admin/templates"),
      },
      summary: {
        totalRooms: roomRows.length,
        readyRooms,
        needsActionRooms,
        uncheckedRooms,
        activeIssues: openIssues.length,
        priorityIssues,
        latestInspectionAt: toIso(latestInspections[0]?.submittedAt),
      },
      statusCounts,
      rooms: roomRows,
      openIssues: openIssues.map((issue) => ({
        id: issue.id,
        roomCode: issue.room.code,
        roomName: issue.room.name,
        title: issueDisplayTitle(issue),
        priority: issue.priority,
        status: issue.status,
        category: issue.category,
        createdAt: toIso(issue.createdAt),
        updatedAt: toIso(issue.updatedAt),
        link: appPath("/supervisor/issues"),
      })),
      latestInspections: latestInspections.map((inspection) => ({
        id: inspection.id,
        roomCode: inspection.room.code,
        roomName: inspection.room.name,
        result: inspection.result,
        resultLabel: inspectionResultLabel(inspection.result),
        submittedAt: toIso(inspection.submittedAt),
        // Inspector name intentionally omitted: this endpoint is public/unauthenticated (PII).
        link: appPath(`/admin/rooms/${inspection.room.id}`),
      })),
    });
  } catch (error) {
    // Log the detail server-side; never leak internal/driver error text to an
    // unauthenticated caller.
    console.error("[integration/dashboard-summary] failed:", error);
    return jsonResponse(
      {
        ok: false,
        generatedAt: new Date().toISOString(),
        error: "Gagal memuat ringkasan pemeriksaan kelas",
      },
      { status: 500 },
    );
  }
}

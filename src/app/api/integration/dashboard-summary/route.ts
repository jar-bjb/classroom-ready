import { prisma } from "@/lib/prisma";
import { getEffectiveRoomStatus, inspectionResultLabel, roomStatusLabel } from "@/lib/status";

export const dynamic = "force-dynamic";

const activeIssueStatuses = ["OPEN", "IN_PROGRESS"] as const;
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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
        include: { room: true },
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
        latestInspector: latestInspection?.inspector?.name || null,
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
        title: issue.title,
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
        inspector: inspection.inspector?.name || null,
        link: appPath(`/admin/rooms/${inspection.room.id}`),
      })),
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        generatedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Gagal memuat ringkasan pemeriksaan kelas",
      },
      { status: 500 },
    );
  }
}

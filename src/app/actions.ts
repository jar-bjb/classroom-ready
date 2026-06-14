"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { addDays } from "@/lib/dates";
import { assignedRoleForCategory, priorityForItem } from "@/lib/status";
import { getEffectiveChecklistItems } from "@/lib/checklist";
import { getSafeUploadExtension, validateUploadFile } from "@/lib/upload-policy";
import type { ChecklistItem, InspectionResult, ItemCategory, ResponseValue, RoomCertificationStatus } from "@/generated/prisma/client";

const validResponseValues = new Set<ResponseValue>(["OK", "NOT_OK", "NA"]);

function safeFileName(name: string, mimeType: string) {
  const extension = getSafeUploadExtension(mimeType);
  const rawBase = path.basename(name || "photo", path.extname(name || "photo"));
  const base = rawBase.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 40);
  return `${base || "photo"}-${crypto.randomUUID()}${extension}`;
}

function redirectWithFormError(roomId: string, message: string): never {
  redirect(`/mobile/rooms/${roomId}/inspect?error=${encodeURIComponent(message)}`);
}

function parseResponseValue(value: FormDataEntryValue | null, item: Pick<ChecklistItem, "prompt">, roomId: string) {
  if (typeof value !== "string" || !validResponseValues.has(value as ResponseValue)) {
    redirectWithFormError(roomId, `Jawaban checklist tidak valid untuk item: ${item.prompt}`);
  }

  return value as ResponseValue;
}

function getUploadFile(value: FormDataEntryValue | null) {
  if (value instanceof File && value.size > 0) return value;
  return null;
}

async function persistFile(file: File, sessionId: string, responseId?: string | null, caption?: string | null) {
  validateUploadFile(file);

  const uploadRoot = process.env.UPLOAD_DIR || "/tmp/classroom-ready-uploads";
  const today = new Date();
  const relativeDir = path.join(
    String(today.getFullYear()),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  );
  const absoluteDir = path.join(uploadRoot, relativeDir);
  await mkdir(absoluteDir, { recursive: true });

  const fileName = safeFileName(file.name, file.type);
  const storagePath = path.join(absoluteDir, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(storagePath, buffer);

  return prisma.attachment.create({
    data: {
      sessionId,
      responseId: responseId || null,
      fileName,
      originalName: file.name || fileName,
      mimeType: file.type,
      sizeBytes: file.size,
      storagePath,
      publicPath: `/api/uploads/${relativeDir.split(path.sep).join("/")}/${fileName}`,
      caption: caption || null,
    },
  });
}

async function notifySupervisors(issueId: string, roomCode: string, title: string) {
  const supervisors = await prisma.user.findMany({ where: { role: "SUPERVISOR", isActive: true }, select: { id: true } });
  if (supervisors.length === 0) return;

  await prisma.notification.createMany({
    data: supervisors.map((supervisor) => ({
      recipientId: supervisor.id,
      issueId,
      title: `Issue baru ${roomCode}`,
      message: title,
    })),
  });
}

export async function submitWeeklyInspection(formData: FormData) {
  const roomId = String(formData.get("roomId") || "");
  const templateVersionId = String(formData.get("templateVersionId") || "");
  const inspectorId = String(formData.get("inspectorId") || "").trim();
  const summaryNote = String(formData.get("summaryNote") || "").trim();

  if (!roomId || !templateVersionId) {
    throw new Error("Ruang dan template checklist wajib tersedia");
  }

  if (!inspectorId) {
    redirectWithFormError(roomId, "Nama petugas wajib dipilih dari daftar.");
  }

  const [room, templateVersion] = await Promise.all([
    prisma.room.findUnique({ where: { id: roomId }, include: { type: true } }),
    prisma.checklistTemplateVersion.findUnique({
      where: { id: templateVersionId },
      include: {
        sections: {
          orderBy: { sortOrder: "asc" },
          include: {
            items: {
              where: { isActive: true },
              orderBy: { sortOrder: "asc" },
              include: { roomOverrides: { where: { roomId } } },
            },
          }
        },
      },
    }),
  ]);

  if (!room || !templateVersion) {
    throw new Error("Data ruang/template tidak ditemukan");
  }

  const items = templateVersion.sections.flatMap((section) => getEffectiveChecklistItems(section.items, room.id, room.type.slug));
  const inspectionPhoto = getUploadFile(formData.get("inspectionPhoto"));
  const inspectionPhotoNote = String(formData.get("inspectionPhotoNote") || "").trim();

  if (inspectionPhoto) {
    try {
      validateUploadFile(inspectionPhoto);
    } catch (error) {
      redirectWithFormError(roomId, error instanceof Error ? error.message : "File foto tidak valid.");
    }
  }

  const responseInputs = items.map((item) => {
    const value = parseResponseValue(formData.get(`value_${item.id}`), item, roomId);
    const note = String(formData.get(`note_${item.id}`) || "").trim();

    return { item, value, note };
  });

  const failedResponses = responseInputs.filter(({ item, value }) => value === "NOT_OK" || (item.isCritical && value === "NA"));
  const hasCriticalFailure = failedResponses.some(({ item }) => item.isCritical);
  const result: InspectionResult = hasCriticalFailure
    ? "NOT_CERTIFIED"
    : failedResponses.length > 0
      ? "CERTIFIED_WITH_NOTES"
      : "CERTIFIED";
  const roomStatus: RoomCertificationStatus = result;
  const expiresAt = addDays(new Date(), 7);

  const inspector = await prisma.user.findFirst({
    where: { id: inspectorId, role: "INSPECTOR", isActive: true },
  });

  if (!inspector) {
    redirectWithFormError(roomId, "Petugas tidak ditemukan atau sudah tidak aktif.");
  }

  const session = await prisma.inspectionSession.create({
    data: {
      roomId,
      templateVersionId,
      inspectorId: inspector.id,
      type: "WEEKLY_CERTIFICATION",
      status: "SUBMITTED",
      result,
      submittedAt: new Date(),
      expiresAt,
      summaryNote: summaryNote || null,
    },
  });

  if (inspectionPhoto) {
    await persistFile(inspectionPhoto, session.id, null, inspectionPhotoNote);
  }

  for (const { item, value, note } of responseInputs) {
    const response = await prisma.inspectionResponse.create({
      data: {
        sessionId: session.id,
        itemId: item.id,
        value,
        note: note || null,
      },
    });

    if (value === "NOT_OK" || (item.isCritical && value === "NA")) {
      const issueTitle = `${room.code} - ${item.prompt}`;
      const issue = await prisma.issue.create({
        data: {
          roomId,
          sessionId: session.id,
          responseId: response.id,
          category: item.category,
          title: issueTitle,
          description: note || (value === "NA" ? "Item kritikal tidak dapat diverifikasi." : null),
          priority: priorityForItem(item.isCritical),
          status: "OPEN",
          assignedRole: assignedRoleForCategory(item.category),
          createdById: inspector.id,
        },
      });

      await prisma.issueLog.create({
        data: {
          issueId: issue.id,
          actorId: inspector.id,
          action: "ISSUE_CREATED",
          newStatus: "OPEN",
          note: note || "Issue dibuat otomatis dari hasil pemeriksaan petugas.",
        },
      });

      await notifySupervisors(issue.id, room.code, issueTitle);
    }
  }

  await prisma.room.update({
    where: { id: roomId },
    data: {
      status: roomStatus,
      certificationExpiresAt: expiresAt,
      lastInspectionId: session.id,
    },
  });

  revalidatePath("/mobile");
  revalidatePath(`/mobile/rooms/${roomId}/inspect`);
  revalidatePath(`/admin/rooms/${roomId}`);
  revalidatePath("/dashboard");
  revalidatePath("/supervisor/issues");
  redirect(`/mobile?submitted=1`);
}

function formString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function formOptionalInt(formData: FormData, key: string) {
  const value = formString(formData, key);
  return value ? Number(value) : null;
}

function inspectorEmailFromName(name: string) {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 48);
  return `${slug || "petugas"}@petugas.local`;
}

async function uniqueInspectorEmail(name: string) {
  const baseEmail = inspectorEmailFromName(name);
  const [local, domain] = baseEmail.split("@");
  let candidate = baseEmail;
  let suffix = 2;

  while (await prisma.user.findUnique({ where: { email: candidate } })) {
    candidate = `${local}.${suffix}@${domain}`;
    suffix += 1;
  }

  return candidate;
}

function formCategory(formData: FormData): ItemCategory {
  const value = formString(formData, "category") as ItemCategory;
  const valid: ItemCategory[] = ["FACILITY", "HVAC", "LIGHTING", "ELECTRICAL", "AV", "IT", "CONSUMABLE", "CLEANLINESS", "SAFETY"];
  return valid.includes(value) ? value : "FACILITY";
}

export async function createRoom(formData: FormData) {
  const code = formString(formData, "code").toUpperCase();
  const name = formString(formData, "name");
  if (!code || !name) throw new Error("Kode dan nama ruang wajib diisi");

  const roomType = await prisma.roomType.upsert({
    where: { slug: "kelas" },
    update: { name: "Kelas" },
    create: { slug: "kelas", name: "Kelas" },
  });

  await prisma.room.create({
    data: {
      code,
      name,
      typeId: roomType.id,
      floor: formString(formData, "floor") || null,
      location: formString(formData, "location") || null,
      capacity: formOptionalInt(formData, "capacity"),
    },
  });
  revalidatePath("/admin/rooms");
  revalidatePath("/mobile");
}

export async function deleteRoom(formData: FormData) {
  const roomId = formString(formData, "roomId");
  if (!roomId) throw new Error("Room ID wajib ada");
  await prisma.room.update({ where: { id: roomId }, data: { isActive: false } });
  revalidatePath("/admin/rooms");
  revalidatePath("/mobile");
}

export async function createInspector(formData: FormData) {
  const name = formString(formData, "name");
  if (!name) throw new Error("Nama petugas wajib diisi");

  await prisma.user.create({
    data: {
      name,
      email: await uniqueInspectorEmail(name),
      role: "INSPECTOR",
      isActive: true,
    },
  });

  revalidatePath("/admin/rooms");
  revalidatePath("/mobile");
}

export async function deactivateInspector(formData: FormData) {
  const inspectorId = formString(formData, "inspectorId");
  if (!inspectorId) throw new Error("Petugas wajib dipilih");

  await prisma.user.update({
    where: { id: inspectorId },
    data: { isActive: false },
  });

  revalidatePath("/admin/rooms");
  revalidatePath("/mobile");
}

async function requireActiveSupervisor(supervisorId: string) {
  const supervisor = await prisma.user.findFirst({ where: { id: supervisorId, role: "SUPERVISOR", isActive: true } });
  if (!supervisor) throw new Error("Supervisor tidak valid atau tidak aktif");
  return supervisor;
}

async function markRoomReadyWhenNoActiveIssues(roomId: string) {
  const activeIssueCount = await prisma.issue.count({
    where: { roomId, status: { in: ["OPEN", "IN_PROGRESS"] } },
  });

  if (activeIssueCount === 0) {
    await prisma.room.update({
      where: { id: roomId },
      data: { status: "CERTIFIED" },
    });
  }
}

export async function markIssueInProgress(formData: FormData) {
  const issueId = formString(formData, "issueId");
  const supervisorId = formString(formData, "supervisorId");
  const note = formString(formData, "note");
  if (!issueId || !supervisorId) throw new Error("Issue dan supervisor wajib dipilih");

  const supervisor = await requireActiveSupervisor(supervisorId);
  const issue = await prisma.issue.findUnique({ where: { id: issueId }, include: { room: true } });
  if (!issue) throw new Error("Issue tidak ditemukan");
  if (!["OPEN", "IN_PROGRESS"].includes(issue.status)) throw new Error("Issue ini sudah tidak terbuka");

  await prisma.issue.update({ where: { id: issueId }, data: { status: "IN_PROGRESS" } });
  await prisma.issueLog.create({
    data: {
      issueId,
      actorId: supervisor.id,
      action: "STATUS_CHANGED",
      previousStatus: issue.status,
      newStatus: "IN_PROGRESS",
      note: note || "Supervisor menandai issue sedang diproses.",
    },
  });
  await prisma.notification.updateMany({ where: { issueId, recipientId: supervisor.id, isRead: false }, data: { isRead: true, readAt: new Date() } });

  revalidatePath("/supervisor/issues");
  revalidatePath(`/admin/rooms/${issue.roomId}`);
  revalidatePath("/admin/rooms");
  revalidatePath("/admin/logs");
  revalidatePath("/dashboard");
  revalidatePath("/mobile");
}

export async function resolveIssue(formData: FormData) {
  const issueId = formString(formData, "issueId");
  const supervisorId = formString(formData, "supervisorId");
  const resolutionNote = formString(formData, "resolutionNote");
  if (!issueId || !supervisorId) throw new Error("Issue dan supervisor wajib dipilih");
  if (!resolutionNote) throw new Error("Catatan penyelesaian wajib diisi");

  const supervisor = await requireActiveSupervisor(supervisorId);
  const issue = await prisma.issue.findUnique({ where: { id: issueId }, include: { room: true } });
  if (!issue) throw new Error("Issue tidak ditemukan");
  if (!["OPEN", "IN_PROGRESS"].includes(issue.status)) throw new Error("Issue ini sudah ditutup");

  await prisma.issue.update({
    where: { id: issueId },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedById: supervisor.id,
      resolutionNote,
    },
  });
  await prisma.issueLog.create({
    data: {
      issueId,
      actorId: supervisor.id,
      action: "ISSUE_RESOLVED",
      previousStatus: issue.status,
      newStatus: "RESOLVED",
      note: resolutionNote,
    },
  });
  await prisma.notification.updateMany({ where: { issueId, recipientId: supervisor.id, isRead: false }, data: { isRead: true, readAt: new Date() } });
  await markRoomReadyWhenNoActiveIssues(issue.roomId);

  revalidatePath("/supervisor/issues");
  revalidatePath(`/admin/rooms/${issue.roomId}`);
  revalidatePath("/admin/rooms");
  revalidatePath("/admin/logs");
  revalidatePath("/dashboard");
  revalidatePath("/mobile");
}

export async function updateRoomComponent(formData: FormData) {
  const roomId = formString(formData, "roomId");
  const itemId = formString(formData, "itemId");
  if (!roomId || !itemId) throw new Error("Room/item ID wajib ada");

  await prisma.roomChecklistItemOverride.upsert({
    where: { roomId_itemId: { roomId, itemId } },
    update: {
      prompt: formString(formData, "prompt"),
      helpText: formString(formData, "helpText") || null,
      category: formCategory(formData),
      isCritical: formData.get("isCritical") === "on",
      sortOrder: formOptionalInt(formData, "sortOrder"),
      isActive: true,
    },
    create: {
      roomId,
      itemId,
      prompt: formString(formData, "prompt"),
      helpText: formString(formData, "helpText") || null,
      category: formCategory(formData),
      isCritical: formData.get("isCritical") === "on",
      sortOrder: formOptionalInt(formData, "sortOrder"),
      isActive: true,
    },
  });
  revalidatePath(`/admin/rooms/${roomId}`);
  revalidatePath(`/admin/rooms/${roomId}/edit`);
  revalidatePath(`/mobile/rooms/${roomId}/inspect`);
}

export async function deleteRoomComponent(formData: FormData) {
  const roomId = formString(formData, "roomId");
  const itemId = formString(formData, "itemId");
  if (!roomId || !itemId) throw new Error("Room/item ID wajib ada");

  await prisma.roomChecklistItemOverride.upsert({
    where: { roomId_itemId: { roomId, itemId } },
    update: { isActive: false },
    create: { roomId, itemId, isActive: false },
  });
  revalidatePath(`/admin/rooms/${roomId}`);
  revalidatePath(`/admin/rooms/${roomId}/edit`);
  revalidatePath(`/mobile/rooms/${roomId}/inspect`);
}

export async function addRoomComponent(formData: FormData) {
  const roomId = formString(formData, "roomId");
  const sectionId = formString(formData, "sectionId");
  const prompt = formString(formData, "prompt");
  if (!roomId || !sectionId || !prompt) throw new Error("Ruang, bagian, dan nama komponen wajib diisi");

  const item = await prisma.checklistItem.create({
    data: {
      sectionId,
      code: `room-${roomId.slice(-6)}-${Date.now()}`,
      prompt,
      helpText: formString(formData, "helpText") || null,
      category: formCategory(formData),
      isCritical: formData.get("isCritical") === "on",
      appliesToRoomTypeSlugs: [`__room:${roomId}`],
      sortOrder: formOptionalInt(formData, "sortOrder") || 999,
    },
  });

  await prisma.roomChecklistItemOverride.create({
    data: {
      roomId,
      itemId: item.id,
      prompt,
      helpText: formString(formData, "helpText") || null,
      category: formCategory(formData),
      isCritical: formData.get("isCritical") === "on",
      sortOrder: formOptionalInt(formData, "sortOrder") || 999,
    },
  });
  revalidatePath(`/admin/rooms/${roomId}`);
  revalidatePath(`/admin/rooms/${roomId}/edit`);
  revalidatePath(`/mobile/rooms/${roomId}/inspect`);
}

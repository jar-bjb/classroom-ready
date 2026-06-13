"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { addDays } from "@/lib/dates";
import { assignedRoleForCategory, priorityForItem } from "@/lib/status";
import { getSafeUploadExtension, validateUploadFile } from "@/lib/upload-policy";
import type { ChecklistItem, InspectionResult, ResponseValue, RoomCertificationStatus } from "@/generated/prisma/client";

const validResponseValues = new Set<ResponseValue>(["OK", "NOT_OK", "NA"]);
const inspectorEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeFileName(name: string, mimeType: string) {
  const extension = getSafeUploadExtension(mimeType);
  const rawBase = path.basename(name || "photo", path.extname(name || "photo"));
  const base = rawBase.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 40);
  return `${base || "photo"}-${crypto.randomUUID()}${extension}`;
}

function redirectWithFormError(roomId: string, message: string): never {
  redirect(`/mobile/rooms/${roomId}/inspect?error=${encodeURIComponent(message)}`);
}

function parseResponseValue(value: FormDataEntryValue | null, item: ChecklistItem, roomId: string) {
  if (typeof value !== "string" || !validResponseValues.has(value as ResponseValue)) {
    redirectWithFormError(roomId, `Jawaban checklist tidak valid untuk item: ${item.prompt}`);
  }

  return value as ResponseValue;
}

function getUploadFile(value: FormDataEntryValue | null) {
  if (value instanceof File && value.size > 0) return value;
  return null;
}

async function persistFile(file: File, sessionId: string, responseId: string) {
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
      responseId,
      fileName,
      originalName: file.name || fileName,
      mimeType: file.type,
      sizeBytes: file.size,
      storagePath,
      publicPath: `/api/uploads/${relativeDir.split(path.sep).join("/")}/${fileName}`,
    },
  });
}

export async function submitWeeklyInspection(formData: FormData) {
  const roomId = String(formData.get("roomId") || "");
  const templateVersionId = String(formData.get("templateVersionId") || "");
  const inspectorName = String(formData.get("inspectorName") || "Petugas Pemeriksa").trim();
  const inspectorEmail = String(formData.get("inspectorEmail") || "petugas@example.local").trim().toLowerCase();
  const summaryNote = String(formData.get("summaryNote") || "").trim();

  if (!roomId || !templateVersionId) {
    throw new Error("Ruang dan template checklist wajib tersedia");
  }

  if (!inspectorEmailPattern.test(inspectorEmail)) {
    redirectWithFormError(roomId, "Email/ID petugas harus berbentuk email valid.");
  }

  const [room, templateVersion] = await Promise.all([
    prisma.room.findUnique({ where: { id: roomId } }),
    prisma.checklistTemplateVersion.findUnique({
      where: { id: templateVersionId },
      include: {
        sections: {
          orderBy: { sortOrder: "asc" },
          include: { items: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
        },
      },
    }),
  ]);

  if (!room || !templateVersion) {
    throw new Error("Data ruang/template tidak ditemukan");
  }

  const items = templateVersion.sections.flatMap((section) => section.items);
  const responseInputs = items.map((item) => {
    const value = parseResponseValue(formData.get(`value_${item.id}`), item, roomId);
    const note = String(formData.get(`note_${item.id}`) || "").trim();
    const file = getUploadFile(formData.get(`photo_${item.id}`));

    if (value === "NOT_OK" && !file) {
      redirectWithFormError(roomId, `Foto wajib dilampirkan untuk temuan Tidak OK: ${item.prompt}`);
    }

    if (file) {
      try {
        validateUploadFile(file);
      } catch (error) {
        redirectWithFormError(roomId, error instanceof Error ? error.message : "File foto tidak valid.");
      }
    }

    return { item, value, note, file };
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

  const inspector = await prisma.user.upsert({
    where: { email: inspectorEmail },
    update: { name: inspectorName || "Petugas Pemeriksa", isActive: true },
    create: {
      name: inspectorName || "Petugas Pemeriksa",
      email: inspectorEmail,
      role: "INSPECTOR",
    },
  });

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

  for (const { item, value, note, file } of responseInputs) {
    const response = await prisma.inspectionResponse.create({
      data: {
        sessionId: session.id,
        itemId: item.id,
        value,
        note: note || null,
      },
    });

    if (file) {
      await persistFile(file, session.id, response.id);
    }

    if (value === "NOT_OK" || (item.isCritical && value === "NA")) {
      await prisma.issue.create({
        data: {
          roomId,
          sessionId: session.id,
          responseId: response.id,
          category: item.category,
          title: `${room.code} - ${item.prompt}`,
          description: note || (value === "NA" ? "Item kritikal tidak dapat diverifikasi." : null),
          priority: priorityForItem(item.isCritical),
          status: "OPEN",
          assignedRole: assignedRoleForCategory(item.category),
          createdById: inspector.id,
        },
      });
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
  revalidatePath(`/mobile/rooms/${roomId}`);
  revalidatePath("/dashboard");
  redirect(`/mobile/rooms/${roomId}?submitted=1`);
}

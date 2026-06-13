"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { addDays } from "@/lib/dates";
import { assignedRoleForCategory, priorityForItem } from "@/lib/status";
import type { InspectionResult, ResponseValue, RoomCertificationStatus } from "@/generated/prisma/client";

function safeFileName(name: string) {
  const extension = path.extname(name).toLowerCase().replace(/[^.a-z0-9]/g, "");
  const base = path.basename(name, extension).toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 40);
  return `${base || "photo"}-${crypto.randomUUID()}${extension || ".bin"}`;
}

async function persistFile(file: File, sessionId: string, responseId: string) {
  if (!file || file.size === 0) return null;

  const uploadRoot = process.env.UPLOAD_DIR || "/tmp/classroom-ready-uploads";
  const today = new Date();
  const relativeDir = path.join(
    String(today.getFullYear()),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  );
  const absoluteDir = path.join(uploadRoot, relativeDir);
  await mkdir(absoluteDir, { recursive: true });

  const fileName = safeFileName(file.name || "photo.jpg");
  const storagePath = path.join(absoluteDir, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(storagePath, buffer);

  return prisma.attachment.create({
    data: {
      sessionId,
      responseId,
      fileName,
      originalName: file.name || fileName,
      mimeType: file.type || "application/octet-stream",
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
  const failedItems = items.filter((item) => formData.get(`value_${item.id}`) === "NOT_OK");
  const hasCriticalFailure = failedItems.some((item) => item.isCritical);
  const result: InspectionResult = hasCriticalFailure
    ? "NOT_CERTIFIED"
    : failedItems.length > 0
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

  for (const item of items) {
    const rawValue = formData.get(`value_${item.id}`);
    const value = (rawValue || "NA") as ResponseValue;
    const note = String(formData.get(`note_${item.id}`) || "").trim();
    const response = await prisma.inspectionResponse.create({
      data: {
        sessionId: session.id,
        itemId: item.id,
        value,
        note: note || null,
      },
    });

    const maybeFile = formData.get(`photo_${item.id}`);
    if (maybeFile instanceof File && maybeFile.size > 0) {
      await persistFile(maybeFile, session.id, response.id);
    }

    if (value === "NOT_OK") {
      await prisma.issue.create({
        data: {
          roomId,
          sessionId: session.id,
          responseId: response.id,
          category: item.category,
          title: `${room.code} - ${item.prompt}`,
          description: note || null,
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

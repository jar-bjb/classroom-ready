"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { addDays } from "@/lib/dates";
import { assignedRoleForCategory, priorityForItem } from "@/lib/status";
import { getEffectiveChecklistItems } from "@/lib/checklist";
import { buildIssueTitle } from "@/lib/issues";
import { assertImageBytes, getSafeUploadExtension, validateUploadFile } from "@/lib/upload-policy";
import type { ChecklistItem, InspectionResult, ItemCategory, ResponseValue, RoomCertificationStatus } from "@/generated/prisma/client";

const validResponseValues = new Set<ResponseValue>(["OK", "NOT_OK", "NA"]);

function appPath(pathname: string) {
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

function safeFileName(name: string, mimeType: string) {
  const extension = getSafeUploadExtension(mimeType);
  const rawBase = path.basename(name || "photo", path.extname(name || "photo"));
  const base = rawBase.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 40);
  return `${base || "photo"}-${crypto.randomUUID()}${extension}`;
}

// User-fixable validation error. Caught by submitWeeklyInspection and returned
// as form state (via useActionState) so the filled inspection form stays mounted
// and the petugas never loses their answers on a server-side reject.
class InspectionValidationError extends Error {}

function fail(message: string): never {
  throw new InspectionValidationError(message);
}

type InspectionFormState = { error: string | null };

function redirectWithAdminRoomsMessage(kind: "error" | "success", message: string): never {
  redirect(appPath(`/admin/rooms?${kind}=${encodeURIComponent(message)}`));
}

function redirectWithEditRoomMessage(roomId: string, kind: "error" | "success", message: string): never {
  redirect(appPath(`/admin/rooms/${roomId}/edit?${kind}=${encodeURIComponent(message)}`));
}

function redirectInspectionSuccess(hasPhoto: boolean): never {
  redirect(appPath(`/mobile?submitted=1${hasPhoto ? "&photo=1" : ""}`));
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function parseResponseValue(value: FormDataEntryValue | null, item: Pick<ChecklistItem, "prompt">) {
  if (typeof value !== "string" || !validResponseValues.has(value as ResponseValue)) {
    fail(`Pilih OK, Tidak OK, atau N/A untuk item: ${item.prompt}`);
  }

  return value as ResponseValue;
}

function getUploadFile(value: FormDataEntryValue | null) {
  if (value instanceof File && value.size > 0) return value;
  return null;
}

function getCompressedUploadFile(formData: FormData) {
  const dataUrl = String(formData.get("inspectionPhotoCompressedData") || "");
  if (!dataUrl) return null;

  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    fail("Data foto hasil kompres tidak valid. Pilih ulang foto lalu submit lagi.");
  }

  try {
    const [, mimeType, base64Data] = match;
    const originalName = String(formData.get("inspectionPhotoCompressedName") || "foto-pemeriksaan-compressed.jpg");
    const fileName = path.basename(originalName) || "foto-pemeriksaan-compressed.jpg";
    const buffer = Buffer.from(base64Data, "base64");
    if (buffer.length === 0) {
      fail("Foto hasil kompres kosong. Pilih ulang foto lalu submit lagi.");
    }

    return new File([buffer], fileName, { type: mimeType });
  } catch (error) {
    // Keep the specific validation message; only genuine decode failures fall through.
    if (error instanceof InspectionValidationError) throw error;
    fail("Foto hasil kompres tidak bisa dibaca. Pilih ulang foto lalu submit lagi.");
  }
}

// Write the upload to disk (a side effect a DB transaction cannot roll back) and
// return the metadata; the Attachment row itself is created inside the caller's
// transaction so the write stays atomic with the rest of the submission.
async function storeUploadToDisk(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = validatedImageMime(file, buffer);

  const uploadRoot = process.env.UPLOAD_DIR || "/tmp/classroom-ready-uploads";
  const today = new Date();
  const relativeDir = path.join(
    String(today.getFullYear()),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  );
  const absoluteDir = path.join(uploadRoot, relativeDir);
  await mkdir(absoluteDir, { recursive: true });

  // Extension and stored MIME come from the detected type, not the client claim.
  const fileName = safeFileName(file.name, mimeType);
  const storagePath = path.join(absoluteDir, fileName);
  await writeFile(storagePath, buffer);

  return {
    fileName,
    originalName: file.name || fileName,
    mimeType,
    sizeBytes: file.size,
    storagePath,
    publicPath: `/api/uploads/${relativeDir.split(path.sep).join("/")}/${fileName}`,
  };
}

// Validate size + client MIME + actual magic bytes; returns the detected image
// MIME, or fails with a user-facing message when the content isn't a real image.
function validatedImageMime(file: File, buffer: Buffer): string {
  try {
    validateUploadFile(file);
    return assertImageBytes(buffer);
  } catch (error) {
    fail(error instanceof Error ? error.message : "File foto tidak valid.");
  }
}

export async function submitWeeklyInspection(
  _prevState: InspectionFormState,
  formData: FormData,
): Promise<InspectionFormState> {
  const roomId = String(formData.get("roomId") || "");
  const templateVersionId = String(formData.get("templateVersionId") || "");
  const submissionToken = String(formData.get("submissionToken") || "").trim();
  const inspectorId = String(formData.get("inspectorId") || "").trim();
  const summaryNote = String(formData.get("summaryNote") || "").trim().slice(0, 5000);

  try {
    if (!roomId || !templateVersionId) {
      fail("Ruang dan template checklist tidak tersedia. Buka ulang tugas dari daftar.");
    }

    if (submissionToken) {
      const existingSubmission = await prisma.inspectionSession.findUnique({
        where: { submissionToken },
        select: { attachments: { select: { id: true }, take: 1 } },
      });

      if (existingSubmission) {
        redirectInspectionSuccess(existingSubmission.attachments.length > 0);
      }
    }

    if (!inspectorId) {
      fail("Nama petugas wajib dipilih dari daftar.");
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
      fail("Data ruang/template tidak ditemukan. Buka ulang tugas dari daftar.");
    }

    const items = templateVersion.sections.flatMap((section) => getEffectiveChecklistItems(section.items, room.id, room.type.slug));
    const inspectionPhoto = getUploadFile(formData.get("inspectionPhoto")) || getCompressedUploadFile(formData);
    const inspectionPhotoNote = String(formData.get("inspectionPhotoNote") || "").trim().slice(0, 5000);

    const responseInputs = items.map((item) => {
      const value = parseResponseValue(formData.get(`value_${item.id}`), item);
      const note = String(formData.get(`note_${item.id}`) || "").trim().slice(0, 5000);

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
      where: { id: inspectorId, roles: { has: "INSPECTOR" }, isActive: true },
    });

    if (!inspector) {
      fail("Petugas tidak ditemukan atau sudah tidak aktif.");
    }

    const inspectorUserId = inspector.id;

    // Filesystem I/O BEFORE the transaction — it cannot be rolled back by the DB
    // transaction, so the Attachment row (created inside the tx) references a
    // file that already exists on disk.
    const photoMeta = inspectionPhoto ? await storeUploadToDisk(inspectionPhoto) : null;

    // Atomic write: session + attachment + all responses + issues + logs +
    // notifications + room status commit together, or none do. Prevents the
    // partial-write and false-success-on-retry problem where a session row
    // exists but its responses/issues were never written.
    try {
      await prisma.$transaction(
        async (tx) => {
          const session = await tx.inspectionSession.create({
            data: {
              roomId,
              templateVersionId,
              inspectorId: inspectorUserId,
              type: "WEEKLY_CERTIFICATION",
              status: "SUBMITTED",
              result,
              submittedAt: new Date(),
              expiresAt,
              summaryNote: summaryNote || null,
              submissionToken: submissionToken || null,
            },
          });

          if (photoMeta) {
            await tx.attachment.create({
              data: { sessionId: session.id, responseId: null, caption: inspectionPhotoNote || null, ...photoMeta },
            });
          }

          const supervisors = await tx.user.findMany({ where: { roles: { has: "SUPERVISOR" }, isActive: true }, select: { id: true } });
          const notifications: { recipientId: string; issueId: string; title: string; message: string }[] = [];

          for (const { item, value, note } of responseInputs) {
            const response = await tx.inspectionResponse.create({
              data: { sessionId: session.id, itemId: item.id, value, note: note || null },
            });

            if (value === "NOT_OK" || (item.isCritical && value === "NA")) {
              const issueTitle = buildIssueTitle(room.code, item.prompt, value);
              const issue = await tx.issue.create({
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
                  createdById: inspectorUserId,
                },
              });

              await tx.issueLog.create({
                data: {
                  issueId: issue.id,
                  actorId: inspectorUserId,
                  action: "ISSUE_CREATED",
                  newStatus: "OPEN",
                  note: note || "Issue dibuat otomatis dari hasil pemeriksaan petugas.",
                },
              });

              for (const supervisor of supervisors) {
                notifications.push({ recipientId: supervisor.id, issueId: issue.id, title: `Issue baru ${room.code}`, message: issueTitle });
              }
            }
          }

          if (notifications.length > 0) {
            await tx.notification.createMany({ data: notifications });
          }

          await tx.room.update({
            where: { id: roomId },
            data: { status: roomStatus, certificationExpiresAt: expiresAt, lastInspectionId: session.id },
          });
        },
        { timeout: 20000 },
      );
    } catch (error) {
      // Idempotent replay: a concurrent/retried submit with the same token hit the
      // unique constraint — the first one already committed the whole submission.
      if (submissionToken && isUniqueConstraintError(error)) {
        const existingSubmission = await prisma.inspectionSession.findUnique({
          where: { submissionToken },
          select: { attachments: { select: { id: true }, take: 1 } },
        });

        if (existingSubmission) {
          redirectInspectionSuccess(existingSubmission.attachments.length > 0);
        }
      }

      throw error;
    }

    revalidatePath("/mobile");
    revalidatePath(`/mobile/rooms/${roomId}/inspect`);
    revalidatePath(`/admin/rooms/${roomId}`);
    revalidatePath("/dashboard");
    revalidatePath("/supervisor/issues");
    redirectInspectionSuccess(Boolean(inspectionPhoto));
  } catch (error) {
    if (error instanceof InspectionValidationError) {
      return { error: error.message };
    }

    throw error;
  }
}

// Cap free-text length to bound pathological input; legitimate values are far shorter.
function formString(formData: FormData, key: string, maxLength = 5000) {
  return String(formData.get(key) || "").trim().slice(0, maxLength);
}

function formOptionalInt(formData: FormData, key: string) {
  const value = formString(formData, key);
  if (!value) return null;

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  // Clamp to a sane, non-negative integer range (capacity, sort order) so
  // negatives / huge / fractional values can't be persisted.
  return Math.min(1_000_000, Math.max(0, Math.trunc(numberValue)));
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

function formCategory(formData: FormData, key = "category"): ItemCategory {
  const value = formString(formData, key) as ItemCategory;
  const valid: ItemCategory[] = ["FACILITY", "HVAC", "LIGHTING", "ELECTRICAL", "AV", "IT", "CONSUMABLE", "CLEANLINESS", "SAFETY"];
  return valid.includes(value) ? value : "FACILITY";
}

export async function createRoom(formData: FormData) {
  const code = formString(formData, "code").toUpperCase();
  const name = formString(formData, "name");
  if (!code || !name) redirectWithAdminRoomsMessage("error", "Kode dan nama kelas wajib diisi.");

  const roomType = await prisma.roomType.upsert({
    where: { slug: "kelas" },
    update: { name: "Kelas" },
    create: { slug: "kelas", name: "Kelas" },
  });

  const roomData = {
    name,
    typeId: roomType.id,
    floor: formString(formData, "floor") || null,
    location: formString(formData, "location") || null,
    capacity: formOptionalInt(formData, "capacity"),
  };
  const existingRoom = await prisma.room.findUnique({ where: { code } });

  if (existingRoom?.isActive) {
    redirectWithAdminRoomsMessage("error", `Kode kelas ${code} sudah ada. Pakai kode lain atau edit kelas yang sudah terdaftar.`);
  }

  if (existingRoom) {
    await prisma.room.update({
      where: { id: existingRoom.id },
      data: {
        ...roomData,
        isActive: true,
      },
    });
  } else {
    await prisma.room.create({
      data: {
        code,
        ...roomData,
      },
    });
  }
  revalidatePath("/admin/rooms");
  revalidatePath("/mobile");
  redirectWithAdminRoomsMessage(
    "success",
    existingRoom ? `Kelas ${code} sudah diaktifkan kembali.` : `Kelas ${code} berhasil ditambahkan.`,
  );
}

export async function updateRoom(formData: FormData) {
  const roomId = formString(formData, "roomId");
  const code = formString(formData, "code").toUpperCase();
  const name = formString(formData, "name");

  if (!roomId) throw new Error("Room ID wajib ada");
  if (!code || !name) redirectWithEditRoomMessage(roomId, "error", "Kode dan nama kelas wajib diisi.");

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new Error("Data kelas tidak ditemukan");

  const roomWithSameCode = await prisma.room.findUnique({ where: { code } });
  if (roomWithSameCode && roomWithSameCode.id !== roomId) {
    redirectWithEditRoomMessage(roomId, "error", `Kode kelas ${code} sudah dipakai kelas lain.`);
  }

  await prisma.room.update({
    where: { id: roomId },
    data: {
      code,
      name,
      floor: formString(formData, "floor") || null,
      location: formString(formData, "location") || null,
      capacity: formOptionalInt(formData, "capacity"),
    },
  });

  revalidatePath("/admin/rooms");
  revalidatePath(`/admin/rooms/${roomId}`);
  revalidatePath(`/admin/rooms/${roomId}/edit`);
  revalidatePath(`/mobile/rooms/${roomId}/inspect`);
  revalidatePath("/mobile");
  revalidatePath("/dashboard");
  redirectWithEditRoomMessage(roomId, "success", `Data kelas ${code} berhasil diperbarui.`);
}

export async function updateRoomWithComponents(formData: FormData) {
  const roomId = formString(formData, "roomId");
  const code = formString(formData, "code").toUpperCase();
  const name = formString(formData, "name");

  if (!roomId) throw new Error("Room ID wajib ada");
  if (!code || !name) redirectWithEditRoomMessage(roomId, "error", "Kode dan nama kelas wajib diisi.");

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new Error("Data kelas tidak ditemukan");

  const roomWithSameCode = await prisma.room.findUnique({ where: { code } });
  if (roomWithSameCode && roomWithSameCode.id !== roomId) {
    redirectWithEditRoomMessage(roomId, "error", `Kode kelas ${code} sudah dipakai kelas lain.`);
  }

  const itemIds = Array.from(new Set(formData.getAll("componentItemId").map((value) => String(value)).filter(Boolean)));
  const updates = itemIds.map((itemId) => {
    const prompt = formString(formData, `prompt_${itemId}`);

    if (!prompt) {
      redirectWithEditRoomMessage(roomId, "error", "Nama fasilitas/komponen tidak boleh kosong.");
    }

    return {
      itemId,
      prompt,
      helpText: formString(formData, `helpText_${itemId}`) || null,
      category: formCategory(formData, `category_${itemId}`),
      isCritical: formData.get(`isCritical_${itemId}`) === "on",
      sortOrder: formOptionalInt(formData, `sortOrder_${itemId}`),
    };
  });

  await prisma.$transaction([
    prisma.room.update({
      where: { id: roomId },
      data: {
        code,
        name,
        floor: formString(formData, "floor") || null,
        location: formString(formData, "location") || null,
        capacity: formOptionalInt(formData, "capacity"),
      },
    }),
    ...updates.map((update) =>
      prisma.roomChecklistItemOverride.upsert({
        where: { roomId_itemId: { roomId, itemId: update.itemId } },
        update: {
          prompt: update.prompt,
          helpText: update.helpText,
          category: update.category,
          isCritical: update.isCritical,
          sortOrder: update.sortOrder,
          isActive: true,
        },
        create: {
          roomId,
          itemId: update.itemId,
          prompt: update.prompt,
          helpText: update.helpText,
          category: update.category,
          isCritical: update.isCritical,
          sortOrder: update.sortOrder,
          isActive: true,
        },
      }),
    ),
  ]);

  revalidatePath("/admin/rooms");
  revalidatePath(`/admin/rooms/${roomId}`);
  revalidatePath(`/admin/rooms/${roomId}/edit`);
  revalidatePath(`/mobile/rooms/${roomId}/inspect`);
  revalidatePath("/mobile");
  revalidatePath("/dashboard");
  redirectWithEditRoomMessage(roomId, "success", `Kelas ${code} dan seluruh komponen berhasil diperbarui.`);
}

export async function deleteRoom(formData: FormData) {
  const roomId = formString(formData, "roomId");
  if (!roomId) throw new Error("Room ID wajib ada");
  await prisma.room.update({ where: { id: roomId }, data: { isActive: false } });
  revalidatePath("/admin/rooms");
  revalidatePath("/mobile");
  revalidatePath("/dashboard");
  redirectWithAdminRoomsMessage("success", "Kelas sudah dinonaktifkan dari daftar aktif.");
}

async function createUserWithRole(name: string, role: "INSPECTOR" | "FOLLOWUP") {
  return prisma.user.create({
    data: {
      name,
      email: await uniqueInspectorEmail(name),
      role,
      roles: [role],
      isActive: true,
    },
  });
}

export async function createInspector(formData: FormData) {
  const name = formString(formData, "name");
  if (!name) throw new Error("Nama petugas pemeriksa wajib diisi");

  await createUserWithRole(name, "INSPECTOR");

  revalidatePath("/admin/rooms");
  revalidatePath("/mobile");
}

export async function deactivateInspector(formData: FormData) {
  const inspectorId = formString(formData, "inspectorId");
  if (!inspectorId) throw new Error("Petugas pemeriksa wajib dipilih");

  await prisma.user.update({
    where: { id: inspectorId },
    data: { isActive: false },
  });

  revalidatePath("/admin/rooms");
  revalidatePath("/mobile");
}

export async function createSupervisor(formData: FormData) {
  const name = formString(formData, "name");
  if (!name) throw new Error("Nama petugas tindak lanjut wajib diisi");

  await createUserWithRole(name, "FOLLOWUP");

  revalidatePath("/admin/rooms");
  revalidatePath("/supervisor/issues");
}

export async function deactivateSupervisor(formData: FormData) {
  const supervisorId = formString(formData, "supervisorId");
  if (!supervisorId) throw new Error("Petugas tindak lanjut wajib dipilih");

  await prisma.user.update({
    where: { id: supervisorId },
    data: { isActive: false },
  });

  revalidatePath("/admin/rooms");
  revalidatePath("/supervisor/issues");
}

async function requireActiveSupervisor(supervisorId: string) {
  const supervisor = await prisma.user.findFirst({ where: { id: supervisorId, roles: { has: "FOLLOWUP" }, isActive: true } });
  if (!supervisor) throw new Error("Petugas tindak lanjut tidak valid atau tidak aktif");
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

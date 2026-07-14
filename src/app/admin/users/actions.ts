"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateActivationCode, hashToken, normalizeActivationCode } from "@/lib/session";

const ROLES = ["INSPECTOR", "FOLLOWUP", "SUPERVISOR", "ADMIN"] as const;
type CreatableRole = (typeof ROLES)[number];
const ACTIVATION_TTL_HOURS = 72;

function activationExpiry(): Date {
  return new Date(Date.now() + ACTIVATION_TTL_HOURS * 3600 * 1000);
}

export type CreateUserState = { error: string | null; code: string | null; username: string | null };
export type CodeState = { error: string | null; code: string | null };

// A username held by a DEACTIVATED account may be reclaimed: the inactive
// holder loses it (plus its now-useless pending activation code). An active
// holder still blocks the username. Returns an error message, or null if the
// username is available for `forUserId`.
async function releaseUsernameIfInactive(username: string, forUserId?: string): Promise<string | null> {
  const clash = await prisma.user.findUnique({ where: { username } });
  if (!clash || clash.id === forUserId) return null;
  if (clash.isActive) return `Username "${username}" sudah dipakai akun aktif (${clash.name}).`;

  await prisma.user.update({
    where: { id: clash.id },
    data: { username: null, activationCodeHash: null, activationExpiresAt: null },
  });
  return null;
}

export async function createUserAccount(_prev: CreateUserState, formData: FormData): Promise<CreateUserState> {
  const name = String(formData.get("name") || "").trim().slice(0, 200);
  const username = String(formData.get("username") || "").trim().toLowerCase().slice(0, 100);
  const roles = Array.from(
    new Set(
      formData.getAll("roles").map(String).filter((r): r is CreatableRole => (ROLES as readonly string[]).includes(r)),
    ),
  );

  if (!name || !username) return { error: "Nama dan username wajib diisi.", code: null, username: null };
  if (roles.length === 0) return { error: "Pilih minimal satu peran (kapabilitas).", code: null, username: null };
  if (!/^[a-z0-9._-]{3,}$/.test(username)) {
    return { error: "Username minimal 3 karakter: huruf kecil, angka, titik, garis bawah, atau strip.", code: null, username: null };
  }
  const clashError = await releaseUsernameIfInactive(username);
  if (clashError) return { error: clashError, code: null, username: null };

  const code = generateActivationCode();
  try {
    await prisma.user.create({
      data: {
        name,
        username,
        email: `${username}@petugas.local`,
        role: roles[0],
        roles,
        isActive: true,
        activationCodeHash: await hashToken(normalizeActivationCode(code)),
        activationExpiresAt: activationExpiry(),
      },
    });
  } catch {
    return { error: "Gagal membuat akun (username/email bentrok?).", code: null, username: null };
  }

  revalidatePath("/admin/users");
  return { error: null, code, username };
}

// Assign a username to a pre-existing account (created before login existed) and
// issue its first activation code, so old petugas/supervisor records can log in.
export async function assignUsername(_prev: CreateUserState, formData: FormData): Promise<CreateUserState> {
  const userId = String(formData.get("userId") || "");
  const username = String(formData.get("username") || "").trim().toLowerCase().slice(0, 100);
  if (!userId) return { error: "User tidak valid.", code: null, username: null };
  if (!/^[a-z0-9._-]{3,}$/.test(username)) {
    return { error: "Username minimal 3 karakter: huruf kecil, angka, titik, garis bawah, atau strip.", code: null, username: null };
  }
  const clashError = await releaseUsernameIfInactive(username, userId);
  if (clashError) return { error: clashError, code: null, username: null };

  const code = generateActivationCode();
  await prisma.user.update({
    where: { id: userId },
    data: {
      username,
      passwordHash: null,
      activationCodeHash: await hashToken(normalizeActivationCode(code)),
      activationExpiresAt: activationExpiry(),
    },
  });

  revalidatePath("/admin/users");
  return { error: null, code, username };
}

export async function regenerateActivationCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const userId = String(formData.get("userId") || "");
  if (!userId) return { error: "User tidak valid.", code: null };
  if (!(await prisma.user.findUnique({ where: { id: userId } }))) {
    return { error: "User tidak ditemukan.", code: null };
  }

  const code = generateActivationCode();
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: null, // force re-activation with the new code
      activationCodeHash: await hashToken(normalizeActivationCode(code)),
      activationExpiresAt: activationExpiry(),
    },
  });

  revalidatePath("/admin/users");
  return { error: null, code };
}

// Edit the capability set of an existing account (e.g. promote a petugas to
// Supervisor) without recreating it. The signed-in session keeps its old roles
// until the user logs in again (the session cookie carries the role claims).
export async function updateUserRoles(formData: FormData): Promise<void> {
  const userId = String(formData.get("userId") || "");
  const roles = Array.from(
    new Set(
      formData.getAll("roles").map(String).filter((r): r is CreatableRole => (ROLES as readonly string[]).includes(r)),
    ),
  );

  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
  if (!user) redirect(`/admin/users?error=${encodeURIComponent("Akun tidak ditemukan.")}`);
  if (roles.length === 0) {
    redirect(`/admin/users?error=${encodeURIComponent(`Pilih minimal satu peran untuk ${user.name}.`)}`);
  }

  // Lockout guard: never strip ADMIN from the last active admin account.
  if (user.roles.includes("ADMIN") && !roles.includes("ADMIN")) {
    const otherActiveAdmins = await prisma.user.count({
      where: { id: { not: user.id }, isActive: true, roles: { has: "ADMIN" } },
    });
    if (otherActiveAdmins === 0) {
      redirect(`/admin/users?error=${encodeURIComponent("Tidak bisa mencabut peran Admin dari admin aktif terakhir.")}`);
    }
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: roles[0], roles } });

  revalidatePath("/admin/users");
  revalidatePath("/admin/rooms");
  revalidatePath("/supervisor/issues");
  revalidatePath("/mobile");
  redirect(
    `/admin/users?success=${encodeURIComponent(`Peran ${user.name} diperbarui. Jika sedang login, ${user.name} perlu login ulang agar peran baru berlaku.`)}`,
  );
}

export async function setUserActive(formData: FormData): Promise<void> {
  const userId = String(formData.get("userId") || "");
  const active = formData.get("active") === "true";
  if (userId) {
    await prisma.user.update({ where: { id: userId }, data: { isActive: active } });
    revalidatePath("/admin/users");
    revalidatePath("/mobile");
  }
  redirect(`/admin/users?success=${encodeURIComponent(active ? "Akun diaktifkan." : "Akun dinonaktifkan.")}`);
}

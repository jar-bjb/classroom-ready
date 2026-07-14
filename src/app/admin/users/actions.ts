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
  if (await prisma.user.findUnique({ where: { username } })) {
    return { error: `Username "${username}" sudah dipakai.`, code: null, username: null };
  }

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
  const clash = await prisma.user.findUnique({ where: { username } });
  if (clash && clash.id !== userId) {
    return { error: `Username "${username}" sudah dipakai.`, code: null, username: null };
  }

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

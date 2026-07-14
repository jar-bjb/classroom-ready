"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { hashToken, normalizeActivationCode } from "@/lib/session";

export type ActivateState = { error: string | null };

export async function activateAccount(_prev: ActivateState, formData: FormData): Promise<ActivateState> {
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const code = String(formData.get("code") || "").trim();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  if (!username || !code || !password) return { error: "Semua kolom wajib diisi." };
  if (password.length < 8) return { error: "Password minimal 8 karakter." };
  if (password !== confirm) return { error: "Konfirmasi password tidak cocok." };

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive || !user.activationCodeHash || !user.activationExpiresAt) {
    return { error: "Akun tidak ditemukan atau tidak sedang menunggu aktivasi." };
  }
  if (user.activationExpiresAt.getTime() < Date.now()) {
    return { error: "Kode aktivasi sudah kedaluwarsa. Minta admin menerbitkan kode baru." };
  }
  if ((await hashToken(normalizeActivationCode(code))) !== user.activationCodeHash) {
    return { error: "Kode aktivasi salah." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), activationCodeHash: null, activationExpiresAt: null },
  });

  redirect("/login?activated=1");
}

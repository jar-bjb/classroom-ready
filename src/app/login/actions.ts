"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { startSession, clearSession } from "@/lib/auth";
import { homePathForRoles } from "@/lib/access";

export type LoginState = { error: string | null };

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  if (!username || !password) {
    return { error: "Username dan password wajib diisi." };
  }

  const user = await prisma.user.findUnique({ where: { username } });
  const valid = Boolean(user?.isActive && user.passwordHash && (await verifyPassword(password, user.passwordHash)));
  if (!user || !valid) {
    return { error: "Username atau password salah." };
  }

  const roles = user.roles.length > 0 ? user.roles : [user.role];
  const ok = await startSession(user.id, roles);
  if (!ok) {
    return { error: "Sesi belum dikonfigurasi (SESSION_SECRET belum di-set). Hubungi admin." };
  }

  redirect(homePathForRoles(roles));
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}

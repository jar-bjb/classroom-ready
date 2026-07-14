import { UserCog } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/admin-nav";
import { CreateUserForm } from "@/components/create-user-form";
import { RegenerateCodeButton } from "@/components/regenerate-code-button";
import { AssignUsernameForm } from "@/components/assign-username-form";
import { SubmitButton } from "@/components/submit-button";
import { setUserActive, updateUserRoles } from "@/app/admin/users/actions";

export const dynamic = "force-dynamic";

const roleLabel: Record<string, string> = {
  ADMIN: "Admin",
  SUPERVISOR: "Supervisor",
  FOLLOWUP: "Tindak Lanjut",
  INSPECTOR: "Pemeriksa",
  COORDINATOR: "Koordinator",
  FACILITY: "Fasilitas",
  IT_AV: "IT/AV",
  MANAGEMENT: "Manajemen",
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

// Roles offered in the per-account editor: the four creatable roles, plus any
// legacy role the account already holds (so saving never silently drops one).
const EDITABLE_ROLES = ["INSPECTOR", "FOLLOWUP", "SUPERVISOR", "ADMIN"];

function editableRolesFor(currentRoles: string[]) {
  return [...EDITABLE_ROLES, ...currentRoles.filter((r) => !EDITABLE_ROLES.includes(r))];
}

function accountStatus(user: { isActive: boolean; passwordHash: string | null; activationCodeHash: string | null }) {
  if (!user.isActive) return { label: "Nonaktif", cls: "bg-rose-50 text-rose-700" };
  if (user.passwordHash) return { label: "Aktif · siap login", cls: "bg-emerald-50 text-emerald-700" };
  if (user.activationCodeHash) return { label: "Menunggu aktivasi", cls: "bg-amber-50 text-amber-800" };
  return { label: "Belum ada kredensial", cls: "bg-background text-muted" };
}

export default async function AdminUsersPage({ searchParams }: { searchParams?: Promise<{ success?: string | string[]; error?: string | string[] }> }) {
  const params = await searchParams;
  const successMessage = firstParam(params?.success);
  const errorMessage = firstParam(params?.error);
  const users = await prisma.user.findMany({ orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }] });

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-6 lg:py-10">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Admin</p>
          <h1 className="mt-2 flex items-center gap-2 text-4xl font-black tracking-[-0.05em]"><UserCog size={30} /> Kelola Akun</h1>
          <p className="mt-2 text-muted">Buat akun login (admin, supervisor, petugas), terbitkan kode aktivasi, dan nonaktifkan akun.</p>
        </div>

        {successMessage ? (
          <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900" role="status">
            {successMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mt-5 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-900" role="alert">
            {errorMessage}
          </div>
        ) : null}

        <section className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-black tracking-[-0.03em]">Buat akun baru</h2>
          <CreateUserForm />
        </section>

        <section className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-black tracking-[-0.03em]">Daftar akun ({users.length})</h2>
          <div className="grid gap-3">
            {users.map((user) => {
              const status = accountStatus(user);
              const currentRoles = user.roles.length ? user.roles : [user.role];
              return (
                <div key={user.id} className="grid gap-3 rounded-2xl border border-border bg-background p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black">{user.name}</p>
                      <span className="font-mono text-xs text-muted">{user.username || "—"}</span>
                      {currentRoles.map((r) => (
                        <span key={r} className="rounded-full border border-border px-2 py-0.5 text-[11px] font-bold">{roleLabel[r] || r}</span>
                      ))}
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${status.cls}`}>{status.label}</span>
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer select-none text-xs font-black text-muted hover:text-foreground">Atur peran</summary>
                      <form action={updateUserRoles} className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">
                        <input type="hidden" name="userId" value={user.id} />
                        {editableRolesFor(currentRoles).map((r) => (
                          <label key={r} className="inline-flex items-center gap-1.5 font-semibold">
                            <input type="checkbox" name="roles" value={r} defaultChecked={(currentRoles as string[]).includes(r)} className="size-4" /> {roleLabel[r] || r}
                          </label>
                        ))}
                        <SubmitButton
                          pendingLabel="Menyimpan…"
                          confirmMessage={`Simpan perubahan peran untuk ${user.name}?`}
                          className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-black hover:border-accent/50"
                        >
                          Simpan peran
                        </SubmitButton>
                      </form>
                    </details>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {user.username ? <RegenerateCodeButton userId={user.id} /> : <AssignUsernameForm userId={user.id} />}
                    <form action={setUserActive}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="active" value={user.isActive ? "false" : "true"} />
                      <SubmitButton
                        pendingLabel="…"
                        confirmMessage={user.isActive ? `Nonaktifkan akun ${user.name}?` : `Aktifkan kembali akun ${user.name}?`}
                        className={`rounded-xl border px-3 py-2 text-xs font-black ${user.isActive ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
                      >
                        {user.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}

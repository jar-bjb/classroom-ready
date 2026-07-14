"use client";

import { useActionState } from "react";
import { AlertCircle, KeyRound, UserPlus } from "lucide-react";
import { createUserAccount, type CreateUserState } from "@/app/admin/users/actions";
import { SubmitButton } from "@/components/submit-button";

const initialState: CreateUserState = { error: null, code: null, username: null };

export function CreateUserForm() {
  const [state, action] = useActionState(createUserAccount, initialState);

  return (
    <form action={action} className="grid gap-3">
      {state.error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-900" role="alert">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}
      {state.code ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-900">
            <KeyRound size={16} /> Akun <span className="font-mono">{state.username}</span> dibuat.
          </p>
          <p className="mt-1 text-xs text-emerald-800">Berikan kode aktivasi ini (berlaku 72 jam, sekali pakai):</p>
          <p className="mt-2 select-all font-mono text-2xl font-black tracking-[0.15em] text-emerald-900">{state.code}</p>
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <input name="name" required placeholder="Nama lengkap" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent" />
        <input name="username" required placeholder="username / NIP" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent" />
      </div>
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-background px-4 py-3 text-sm">
        <span className="font-semibold text-muted">Peran (boleh lebih dari satu):</span>
        <label className="inline-flex items-center gap-1.5 font-semibold">
          <input type="checkbox" name="roles" value="INSPECTOR" defaultChecked className="size-4" /> Pemeriksa
        </label>
        <label className="inline-flex items-center gap-1.5 font-semibold">
          <input type="checkbox" name="roles" value="FOLLOWUP" defaultChecked className="size-4" /> Tindak Lanjut
        </label>
        <label className="inline-flex items-center gap-1.5 font-semibold">
          <input type="checkbox" name="roles" value="SUPERVISOR" className="size-4" /> Supervisor
        </label>
        <label className="inline-flex items-center gap-1.5 font-semibold">
          <input type="checkbox" name="roles" value="ADMIN" className="size-4" /> Admin
        </label>
      </div>
      <SubmitButton
        pendingLabel="Membuat…"
        className="inline-flex items-center justify-center gap-2 self-start rounded-2xl bg-accent px-5 py-3 text-sm font-black text-accent-foreground"
      >
        <UserPlus size={16} /> Buat akun + kode aktivasi
      </SubmitButton>
    </form>
  );
}

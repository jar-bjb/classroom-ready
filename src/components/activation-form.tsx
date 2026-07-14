"use client";

import { useActionState } from "react";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { activateAccount, type ActivateState } from "@/app/aktivasi/actions";
import { SubmitButton } from "@/components/submit-button";

const initialState: ActivateState = { error: null };

const inputClass = "tap-target rounded-2xl border border-border bg-background px-4 py-3 font-normal outline-none focus:border-accent";

export function ActivationForm() {
  const [state, action] = useActionState(activateAccount, initialState);

  return (
    <form action={action} className="grid gap-4">
      {state.error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-900" role="alert" aria-live="assertive">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}
      <label className="grid gap-1 text-sm font-semibold">
        Username / NIP
        <input name="username" autoComplete="username" required className={inputClass} />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Kode aktivasi
        <input name="code" required placeholder="mis. K7Q2-9XP4" className={`${inputClass} font-mono tracking-wider`} />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Password baru
        <input name="password" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Ulangi password
        <input name="confirm" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
      </label>
      <SubmitButton
        pendingLabel="Mengaktifkan…"
        className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 text-base font-black text-accent-foreground shadow-sm"
      >
        <ShieldCheck size={18} /> Aktifkan &amp; set password
      </SubmitButton>
    </form>
  );
}

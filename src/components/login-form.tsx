"use client";

import { useActionState } from "react";
import { AlertCircle, LogIn } from "lucide-react";
import { loginAction, type LoginState } from "@/app/login/actions";
import { SubmitButton } from "@/components/submit-button";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, action] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="grid gap-4">
      {state.error ? (
        <div
          className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-900"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}
      <label className="grid gap-1 text-sm font-semibold">
        Username / NIP
        <input
          name="username"
          autoComplete="username"
          required
          className="tap-target rounded-2xl border border-border bg-background px-4 py-3 font-normal outline-none focus:border-accent"
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="tap-target rounded-2xl border border-border bg-background px-4 py-3 font-normal outline-none focus:border-accent"
        />
      </label>
      <SubmitButton
        pendingLabel="Masuk…"
        className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 text-base font-black text-accent-foreground shadow-sm"
      >
        <LogIn size={18} /> Masuk
      </SubmitButton>
    </form>
  );
}

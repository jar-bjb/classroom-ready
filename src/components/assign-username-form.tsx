"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { assignUsername, type CreateUserState } from "@/app/admin/users/actions";
import { SubmitButton } from "@/components/submit-button";

const initialState: CreateUserState = { error: null, code: null, username: null };

// For accounts created before login existed (no username yet): set a username and
// issue the first activation code in one step.
export function AssignUsernameForm({ userId }: { userId: string }) {
  const [state, action] = useActionState(assignUsername, initialState);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input
        name="username"
        required
        placeholder="set username / NIP"
        className="min-w-0 rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none focus:border-accent"
      />
      <SubmitButton
        pendingLabel="…"
        className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-black hover:border-accent/50"
      >
        <KeyRound size={13} /> Set + kode
      </SubmitButton>
      {state.code ? (
        <span className="select-all rounded-lg bg-emerald-50 px-2 py-1 font-mono text-sm font-black tracking-wider text-emerald-900">{state.code}</span>
      ) : null}
      {state.error ? <span className="text-xs font-bold text-rose-700">{state.error}</span> : null}
    </form>
  );
}

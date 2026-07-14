"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { submitWeeklyInspection } from "@/app/actions";

const initialState: { error: string | null } = { error: null };

// Wraps the inspection form with useActionState so that a server-side validation
// reject returns an inline error WITHOUT navigating. The form stays mounted, so
// the petugas keeps every answer they already filled (the uncontrolled radios,
// notes, and photo are preserved) instead of landing on a blank remounted form.
export function InspectionForm({ children }: { children: React.ReactNode }) {
  const [state, formAction] = useActionState(submitWeeklyInspection, initialState);

  return (
    <form action={formAction} className="space-y-5" encType="multipart/form-data" noValidate>
      {state.error ? (
        <div
          className="flex items-start gap-2 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-900"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}
      {children}
    </form>
  );
}

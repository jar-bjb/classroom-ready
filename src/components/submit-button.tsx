"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

type SubmitButtonProps = {
  children: ReactNode;
  className?: string;
  // Text shown next to the spinner while the form is submitting (icon-only buttons omit it).
  pendingLabel?: string;
  disabled?: boolean;
  // Override the form action for this button (used when one form has several actions).
  formAction?: (formData: FormData) => void | Promise<void>;
  formNoValidate?: boolean;
  // If set, the click must be confirmed via a native dialog before the form submits.
  confirmMessage?: string;
  "aria-label"?: string;
};

// Submit button that reflects the enclosing form's pending state: it disables
// while a submission is in flight (blocking double-submit) and shows a spinner.
// Optionally guards destructive actions behind a confirm dialog.
export function SubmitButton({
  children,
  className = "",
  pendingLabel,
  disabled,
  formAction,
  formNoValidate,
  confirmMessage,
  "aria-label": ariaLabel,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      formAction={formAction}
      formNoValidate={formNoValidate}
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      aria-label={ariaLabel}
      onClick={
        confirmMessage
          ? (event) => {
              if (!window.confirm(confirmMessage)) event.preventDefault();
            }
          : undefined
      }
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

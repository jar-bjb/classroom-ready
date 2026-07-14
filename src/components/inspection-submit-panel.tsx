"use client";

import { AlertCircle, CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type ChecklistProgress = {
  answered: number;
  firstMissingLabel: string | null;
  inspectorSelected: boolean;
  photoCompressing: boolean;
  total: number;
};

function readFormProgress(form: HTMLFormElement, totalItems: number, markMissing: boolean): ChecklistProgress {
  const items = Array.from(form.querySelectorAll<HTMLElement>("[data-checklist-item]"));
  const inspector = form.querySelector<HTMLSelectElement>("[data-inspector-select]");
  const photoState = form.querySelector<HTMLInputElement>("[data-photo-client-state]");
  let answered = 0;
  let firstMissingLabel: string | null = null;

  for (const item of items) {
    const isAnswered = Boolean(item.querySelector<HTMLInputElement>("input[type='radio']:checked"));
    if (isAnswered) {
      answered += 1;
      item.removeAttribute("data-missing");
      continue;
    }

    if (!firstMissingLabel) {
      firstMissingLabel = item.dataset.itemLabel || "item checklist";
    }
    if (markMissing) item.dataset.missing = "true";
  }

  return {
    answered,
    firstMissingLabel,
    inspectorSelected: Boolean(inspector?.value),
    photoCompressing: photoState?.value === "compressing",
    total: items.length || totalItems,
  };
}

function getProgressMeta(progress: ChecklistProgress) {
  const missingItems = Math.max(0, progress.total - progress.answered);
  const isReady = progress.inspectorSelected && missingItems === 0 && !progress.photoCompressing;
  const progressPercent = progress.total > 0 ? Math.round((progress.answered / progress.total) * 100) : 0;
  const statusText = progress.photoCompressing
    ? "Foto masih dikompres"
    : !progress.inspectorSelected
      ? "Nama petugas belum dipilih"
      : missingItems > 0
        ? `${missingItems} item belum lengkap`
        : "Siap disimpan";
  const helpText = isReady
    ? `${progress.answered} item selesai. Data siap disimpan.`
    : !progress.inspectorSelected
      ? "Pilih nama petugas dulu, lalu lengkapi checklist dari atas ke bawah."
      : progress.photoCompressing
        ? "Tunggu kompresi foto selesai sebelum submit."
        : `${progress.answered} selesai, ${missingItems} item belum diisi.`;

  return { helpText, isReady, missingItems, progressPercent, statusText };
}

function useChecklistProgress(totalItems: number, formRef: React.RefObject<HTMLElement | null>, handleValidation: boolean) {
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [progress, setProgress] = useState<ChecklistProgress>({
    answered: 0,
    firstMissingLabel: null,
    inspectorSelected: false,
    photoCompressing: false,
    total: totalItems,
  });

  useEffect(() => {
    const anchor = formRef.current;
    const form = anchor instanceof HTMLFormElement ? anchor : anchor?.closest("form");
    if (!form) return;
    const formElement = form;

    function updateProgress() {
      setProgress(readFormProgress(formElement, totalItems, attemptedSubmit));
    }

    function handleSubmit(event: SubmitEvent) {
      if (!handleValidation) return;
      const nextProgress = readFormProgress(formElement, totalItems, true);
      setProgress(nextProgress);
      setAttemptedSubmit(true);

      if (!nextProgress.inspectorSelected || nextProgress.answered < nextProgress.total || nextProgress.photoCompressing) {
        event.preventDefault();
        const firstMissing = !nextProgress.inspectorSelected
          ? formElement.querySelector<HTMLElement>("[data-inspector-select]")
          : formElement.querySelector<HTMLElement>("[data-checklist-item][data-missing='true']");
        firstMissing?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    updateProgress();
    formElement.addEventListener("input", updateProgress);
    formElement.addEventListener("change", updateProgress);
    formElement.addEventListener("submit", handleSubmit);

    return () => {
      formElement.removeEventListener("input", updateProgress);
      formElement.removeEventListener("change", updateProgress);
      formElement.removeEventListener("submit", handleSubmit);
    };
  }, [attemptedSubmit, formRef, handleValidation, totalItems]);

  return { attemptedSubmit, progress };
}

export function InspectionProgressPanel({ totalItems }: { totalItems: number }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { attemptedSubmit, progress } = useChecklistProgress(totalItems, panelRef, true);
  const { helpText, isReady, progressPercent, statusText } = getProgressMeta(progress);

  return (
    <div ref={panelRef} className="sticky top-24 z-10 rounded-3xl border border-border bg-card/95 p-3 shadow-[0_10px_28px_rgba(23,19,15,0.12)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-foreground">Checklist {progress.answered}/{progress.total}</p>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ${isReady ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-900"}`}>
          {isReady ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
          {statusText}
        </span>
      </div>
      <p className="mt-1 text-xs font-semibold text-muted">{helpText}</p>
      <div className="inspection-progress-track mt-2 h-2 overflow-hidden rounded-full" aria-hidden="true">
        <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${progressPercent}%` }} />
      </div>
      {attemptedSubmit && !isReady ? (
        <p className="mt-2 text-xs font-bold text-rose-700" role="alert">
          {!progress.inspectorSelected
            ? "Pilih nama petugas dulu."
            : progress.photoCompressing
              ? "Tunggu kompresi foto selesai."
              : `Item pertama yang belum diisi: ${progress.firstMissingLabel}.`}
        </p>
      ) : null}
    </div>
  );
}

export function InspectionSubmitPanel({ totalItems }: { totalItems: number }) {
  const { pending } = useFormStatus();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { progress } = useChecklistProgress(totalItems, buttonRef, false);
  const { helpText, isReady } = getProgressMeta(progress);
  const buttonLabel = pending
    ? "Menyimpan..."
    : isReady
      ? "Submit Pemeriksaan Kelas"
      : "Cek yang belum lengkap";

  return (
    <div className="rounded-3xl border border-border bg-card p-3 shadow-sm">
      <div className="mb-3 rounded-2xl border border-border bg-background p-3">
        <p className="text-sm font-black text-foreground">Finalisasi pemeriksaan</p>
        <p className="mt-1 text-xs font-semibold text-muted">{helpText}</p>
      </div>
      <button
        ref={buttonRef}
        type="submit"
        disabled={pending}
        data-ready={isReady ? "true" : "false"}
        className={`tap-target flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-base font-black shadow-sm disabled:cursor-wait disabled:opacity-75 ${isReady ? "bg-accent text-accent-foreground" : "border border-border bg-background text-foreground ring-1 ring-amber-500/20"}`}
      >
        {pending ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={18} />}
        {buttonLabel}
      </button>
      {pending ? (
        <p className="mt-2 text-center text-xs font-semibold text-muted" role="status" aria-live="polite">
          Mohon tunggu, data dan foto sedang dikirim.
        </p>
      ) : null}
    </div>
  );
}

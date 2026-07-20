"use client";
import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
};

export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onCancel, busy }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      onCancel={onCancel}
      className="w-full max-w-sm rounded-card border border-line bg-surface p-6 text-ink shadow-xl backdrop:bg-black/40"
      aria-labelledby="confirm-title"
    >
      <h2 id="confirm-title" className="font-serif text-xl">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className="btn-ghost !py-2 text-sm" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn-danger" onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

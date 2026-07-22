"use client";

import { useEffect, useRef, useState } from "react";
import { Flag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  targetType: "profile" | "event" | "country";
  targetId: string;
  targetUrl: string;
};

export function ReportButton({ targetType, targetId, targetUrl }: Props) {
  const supabase = createClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    setBusy(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sign in to report content.");
      setBusy(false);
      return;
    }
    const { error: err } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      target_url: targetUrl,
      reason: reason.trim(),
    });
    setBusy(false);
    if (err) {
      setError("Could not send the report. Try again.");
      return;
    }
    setSent(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-red-700"
      >
        <Flag size={12} /> Report
      </button>
      <dialog
        ref={dialogRef}
        onClose={() => {
          setOpen(false);
          setSent(false);
          setReason("");
        }}
        className="w-full max-w-sm rounded-card border border-line bg-surface p-6 text-ink shadow-xl backdrop:bg-black/40"
        aria-labelledby="report-title"
      >
        {sent ? (
          <>
            <h2 id="report-title" className="font-serif text-xl">Thanks for flagging this.</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">We&rsquo;ll take a look.</p>
            <div className="mt-6 flex justify-end">
              <button type="button" className="btn-ghost !py-2 text-sm" onClick={() => setOpen(false)}>Close</button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2 id="report-title" className="font-serif text-xl">Report this content</h2>
            <p className="mt-2 text-sm text-muted">Tell us what&rsquo;s wrong. We review every report.</p>
            <textarea
              className="field mt-4 min-h-24"
              placeholder="What's the issue?"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              required
              autoFocus
            />
            {error && <p role="alert" className="mt-2 text-xs text-red-800 dark:text-red-400">{error}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="btn-ghost !py-2 text-sm" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
              <button type="submit" className="btn-danger" disabled={busy}>{busy ? "Sending…" : "Send report"}</button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}

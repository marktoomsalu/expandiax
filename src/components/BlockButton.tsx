"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tapSuccess } from "@/lib/haptics";

type Props = {
  targetId: string;
  targetName: string;
  targetUsername: string;
};

// Blocking is personal: it hides two accounts from each other and nothing
// else. Reporting is a separate, deliberate choice inside the same dialog —
// blocking alone never sends anything to us and never affects their account.
export function BlockButton({ targetId, targetName, targetUsername }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [alsoReport, setAlsoReport] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (alsoReport && !reason.trim()) return;
    setBusy(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sign in to block someone.");
      setBusy(false);
      return;
    }

    // Report first: if it fails nothing has changed yet and they can retry.
    if (alsoReport) {
      const { error: reportError } = await supabase.from("reports").insert({
        reporter_id: user.id,
        target_type: "profile",
        target_id: targetId,
        target_url: `/u/${targetUsername}`,
        reason: reason.trim(),
      });
      if (reportError) {
        setError("Could not send the report. Try again.");
        setBusy(false);
        return;
      }
    }

    const { error: blockError } = await supabase.rpc("block_user", { p_blocked_id: targetId });
    if (blockError) {
      setError("Could not block this account. Try again.");
      setBusy(false);
      return;
    }

    tapSuccess();
    setOpen(false);
    router.replace("/feed");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-red-700"
      >
        <Ban size={12} /> Block
      </button>
      <dialog
        ref={dialogRef}
        onClose={() => {
          setOpen(false);
          setAlsoReport(false);
          setReason("");
          setError(null);
        }}
        className="w-full max-w-sm rounded-card border border-line bg-surface p-6 text-ink shadow-xl backdrop:bg-black/40"
        aria-labelledby="block-title"
      >
        <form onSubmit={submit}>
          <h2 id="block-title" className="font-serif text-xl">Block {targetName}?</h2>
          <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-muted">
            <li>· You won&rsquo;t see each other&rsquo;s profiles, trips, events, likes or comments.</li>
            <li>· You&rsquo;ll stop following each other, and neither of you can follow again.</li>
            <li>· They won&rsquo;t be told.</li>
            <li>· Nothing happens to their account, and you can undo this any time in Settings &rarr; Blocked accounts.</li>
          </ul>

          <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]"
              checked={alsoReport}
              onChange={(e) => setAlsoReport(e.target.checked)}
            />
            <span>
              Also report this account to our team
              <span className="block text-xs text-muted">Only if it breaks the rules - a person who&rsquo;s just not for you doesn&rsquo;t need a report.</span>
            </span>
          </label>
          {alsoReport && (
            <textarea
              className="field mt-3 min-h-20"
              placeholder="What's the issue?"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          )}

          {error && <p role="alert" className="mt-3 text-xs text-red-800 dark:text-red-400">{error}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className="btn-ghost !py-2 text-sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn-danger" disabled={busy}>
              {busy ? "Blocking…" : "Block"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

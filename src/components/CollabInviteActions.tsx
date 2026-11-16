"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tapSuccess } from "@/lib/haptics";

/**
 * Accept or decline a collab invitation (migration 075). Accepting puts the
 * shared trip or event on your profile and in your Countries or Events
 * (a trip's country on your map too); declining just lets it go.
 */
export function CollabInviteActions({ collabId, openHref }: { collabId: string; openHref: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);
  const [error, setError] = useState(false);

  async function answer(accept: boolean) {
    setBusy(accept ? "yes" : "no");
    setError(false);
    const { data, error: err } = await createClient().rpc("respond_collab", { p_id: collabId, p_accept: accept });
    setBusy(null);
    if (err || data === "not_found") {
      setError(true);
      return;
    }
    setDone(accept ? "accepted" : "declined");
    if (accept) tapSuccess();
    router.refresh();
  }

  if (done === "accepted") {
    return (
      <p className="mt-2 text-sm text-accent">
        You&rsquo;re a collaborator now.{" "}
        <a href={openHref} className="font-medium underline-offset-4 hover:underline">
          Open it
        </a>
      </p>
    );
  }
  if (done === "declined") return <p className="mt-2 text-sm text-muted">Declined.</p>;

  return (
    <div className="mt-2">
      <div className="flex gap-2">
        <button type="button" onClick={() => void answer(true)} disabled={!!busy} className="btn-accent !py-1.5 !px-3.5 text-sm">
          {busy === "yes" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Accept
        </button>
        <button type="button" onClick={() => void answer(false)} disabled={!!busy} className="btn-ghost !py-1.5 !px-3.5 text-sm">
          {busy === "no" ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Decline
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-800 dark:text-red-400">This is no longer open.</p>}
    </div>
  );
}

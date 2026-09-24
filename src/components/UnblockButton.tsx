"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function UnblockButton({ blockedId, name }: { blockedId: string; name: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unblock() {
    setBusy(true);
    setError(null);
    // RLS only lets you delete your own blocks.
    const { error: err } = await supabase.from("blocks").delete().eq("blocked_id", blockedId);
    if (err) {
      setError("Could not unblock. Try again.");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="shrink-0 text-right">
      <button type="button" className="btn-ghost !py-1.5 text-sm" onClick={unblock} disabled={busy} aria-label={`Unblock ${name}`}>
        {busy ? "Unblocking…" : "Unblock"}
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-red-800 dark:text-red-400">{error}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function DigestToggle({ userId, initialEnabled }: { userId: string; initialEnabled: boolean }) {
  const supabase = createClient();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const next = !enabled;
    const { error } = await supabase.from("profiles").update({ weekly_digest_enabled: next }).eq("id", userId);
    if (!error) setEnabled(next);
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={enabled}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        enabled ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-accent"
      )}
    >
      {enabled ? "On" : "Off"}
    </button>
  );
}

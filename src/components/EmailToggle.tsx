"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** On/off for one kind of email, saved straight to the member's profile. */
export function EmailToggle({
  userId,
  column,
  label,
  initialEnabled,
}: {
  userId: string;
  column: "weekly_digest_enabled" | "follow_email_enabled";
  label: string;
  initialEnabled: boolean;
}) {
  const supabase = createClient();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const next = !enabled;
    const { error } = await supabase.from("profiles").update({ [column]: next }).eq("id", userId);
    if (!error) setEnabled(next);
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={enabled}
      aria-label={label}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        enabled ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-accent"
      )}
    >
      {enabled ? "On" : "Off"}
    </button>
  );
}

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { tapLight } from "@/lib/haptics";
import { Switch } from "./Switch";

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
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);

  async function change(next: boolean) {
    tapLight();
    setBusy(true);
    setEnabled(next);
    const { error } = await createClient().from("profiles").update({ [column]: next }).eq("id", userId);
    if (error) setEnabled(!next);
    setBusy(false);
  }

  return <Switch checked={enabled} onChange={change} label={label} disabled={busy} />;
}

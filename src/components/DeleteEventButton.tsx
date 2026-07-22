"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "./ConfirmDialog";

export function DeleteEventButton({ eventId, mediaPaths }: { eventId: string; mediaPaths: string[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onConfirm() {
    setBusy(true);
    await supabase.from("events").delete().eq("id", eventId);
    if (mediaPaths.length) await supabase.storage.from("media").remove(mediaPaths);
    router.push("/events");
    router.refresh();
  }

  return (
    <>
      <button type="button" className="btn-danger" onClick={() => setOpen(true)}>
        Delete event
      </button>
      <ConfirmDialog
        open={open}
        title="Delete this event?"
        body="The entry and all of its photos and videos will be removed. This cannot be undone."
        confirmLabel="Delete event"
        busy={busy}
        onConfirm={onConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "./ConfirmDialog";

export function DeleteConcertButton({ concertId, mediaPaths }: { concertId: string; mediaPaths: string[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onConfirm() {
    setBusy(true);
    await supabase.from("concerts").delete().eq("id", concertId);
    if (mediaPaths.length) await supabase.storage.from("media").remove(mediaPaths);
    router.push("/concerts");
    router.refresh();
  }

  return (
    <>
      <button type="button" className="btn-danger" onClick={() => setOpen(true)}>
        Delete concert
      </button>
      <ConfirmDialog
        open={open}
        title="Delete this concert?"
        body="The entry and all of its photos and videos will be removed. This cannot be undone."
        confirmLabel="Delete concert"
        busy={busy}
        onConfirm={onConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

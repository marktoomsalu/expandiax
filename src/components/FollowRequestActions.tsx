"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { tapLight, tapSuccess } from "@/lib/haptics";

export function FollowRequestActions({ requesterId }: { requesterId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [handled, setHandled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    tapLight();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("accept_follow_request", { p_requester_id: requesterId });
    setBusy(false);
    if (err) {
      setError("Could not accept. Try again.");
      return;
    }
    tapSuccess();
    setHandled(true);
    router.refresh();
  }

  async function decline() {
    tapLight();
    setBusy(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return;
    }
    const { error: err } = await supabase.from("follow_requests").delete().eq("requester_id", requesterId).eq("target_id", user.id);
    setBusy(false);
    if (err) {
      setError("Could not decline. Try again.");
      return;
    }
    setHandled(true);
    router.refresh();
  }

  if (handled) return null;

  return (
    <div className="mt-2 flex items-center gap-2">
      <button type="button" onClick={accept} disabled={busy} className="btn-accent !px-3 !py-1.5 text-xs">
        Accept
      </button>
      <button type="button" onClick={decline} disabled={busy} className="btn-ghost !px-3 !py-1.5 text-xs">
        Decline
      </button>
      {error && <p role="alert" className="text-xs text-red-800 dark:text-red-400">{error}</p>}
    </div>
  );
}

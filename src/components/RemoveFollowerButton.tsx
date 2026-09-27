"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Removes someone from your followers — they aren't told and aren't blocked. */
export function RemoveFollowerButton({ followerId, name }: { followerId: string; name: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "confirm" | "busy" | "done">("idle");

  async function remove() {
    setState("busy");
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return setState("idle");
    const { error } = await supabase.from("follows").delete().eq("follower_id", followerId).eq("followee_id", auth.user.id);
    if (error) return setState("idle");
    setState("done");
    router.refresh();
  }

  if (state === "done") return <span className="text-xs text-muted">Removed</span>;
  if (state === "confirm" || state === "busy")
    return (
      <span className="flex items-center gap-2">
        <button type="button" onClick={remove} disabled={state === "busy"} className="rounded-full bg-red-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
          Remove
        </button>
        <button type="button" onClick={() => setState("idle")} className="text-xs text-muted hover:text-ink">
          Cancel
        </button>
      </span>
    );
  return (
    <button
      type="button"
      onClick={() => setState("confirm")}
      aria-label={`Remove ${name} from your followers`}
      className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted hover:border-red-700 hover:text-red-700"
    >
      Remove
    </button>
  );
}

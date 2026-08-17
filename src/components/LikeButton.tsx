"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { tapLight } from "@/lib/haptics";

type Props = {
  kind: "country" | "event";
  targetId: string;
  initialLiked: boolean;
};

// Deliberately no visible like count — the point of this app is a personal
// archive of memories, not a metric to chase. Liking still works exactly
// the same underneath; owners can see their own total on /stats, but it's
// never shown publicly, including to the poster here on the button itself.
export function LikeButton({ kind, targetId, initialLiked }: Props) {
  const supabase = createClient();
  const [liked, setLiked] = useState(initialLiked);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    tapLight();
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return;
    }
    if (liked) {
      const { error } = await supabase
        .from("likes")
        .delete()
        .eq("user_id", user.id)
        .eq("kind", kind)
        .eq("target_id", targetId);
      if (!error) setLiked(false);
    } else {
      const { error } = await supabase.from("likes").insert({ user_id: user.id, kind, target_id: targetId });
      if (!error) setLiked(true);
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={liked}
      aria-label={liked ? "Unlike" : "Like"}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm transition-colors",
        liked ? "text-accent" : "text-muted hover:text-accent"
      )}
    >
      <Heart size={16} className={liked ? "fill-accent" : undefined} />
    </button>
  );
}

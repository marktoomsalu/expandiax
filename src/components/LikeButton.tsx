"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  kind: "country" | "concert";
  targetId: string;
  initialLiked: boolean;
  initialCount: number;
};

export function LikeButton({ kind, targetId, initialLiked, initialCount }: Props) {
  const supabase = createClient();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
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
      if (!error) {
        setLiked(false);
        setCount((c) => Math.max(0, c - 1));
      }
    } else {
      const { error } = await supabase.from("likes").insert({ user_id: user.id, kind, target_id: targetId });
      if (!error) {
        setLiked(true);
        setCount((c) => c + 1);
      }
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={liked}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm transition-colors",
        liked ? "text-accent" : "text-muted hover:text-accent"
      )}
    >
      <Heart size={16} className={liked ? "fill-accent" : undefined} />
      {count > 0 && count}
    </button>
  );
}

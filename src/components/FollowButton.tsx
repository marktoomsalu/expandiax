"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function FollowButton({ targetId, initialFollowing }: { targetId: string; initialFollowing: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sign in to follow.");
      setBusy(false);
      return;
    }
    if (following) {
      const { error: err } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("followee_id", targetId);
      if (err) setError("Could not unfollow. Try again.");
      else setFollowing(false);
    } else {
      const { error: err } = await supabase
        .from("follows")
        .insert({ follower_id: user.id, followee_id: targetId });
      if (err) setError("Could not follow. Try again.");
      else setFollowing(true);
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={following ? "btn-ghost !py-2 text-sm" : "btn-accent !py-2 text-sm"}
      >
        {following ? <UserCheck size={16} /> : <UserPlus size={16} />}
        {following ? "Following" : "Follow"}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-800 dark:text-red-400">{error}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, UserCheck, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tapLight } from "@/lib/haptics";
import type { ProfileVisibility } from "@/lib/types";

export function FollowButton({
  targetId,
  visibility,
  initialFollowing,
  initialRequested = false,
}: {
  targetId: string;
  visibility: ProfileVisibility;
  initialFollowing: boolean;
  initialRequested?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [following, setFollowing] = useState(initialFollowing);
  const [requested, setRequested] = useState(initialRequested);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withUser(fn: (userId: string) => Promise<void>) {
    tapLight();
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
    await fn(user.id);
    setBusy(false);
    router.refresh();
  }

  async function unfollow() {
    await withUser(async (userId) => {
      const { error: err } = await supabase.from("follows").delete().eq("follower_id", userId).eq("followee_id", targetId);
      if (err) setError("Could not unfollow. Try again.");
      else setFollowing(false);
    });
  }

  async function follow() {
    await withUser(async (userId) => {
      const { error: err } = await supabase.from("follows").insert({ follower_id: userId, followee_id: targetId });
      if (err) setError("Could not follow. Try again.");
      else setFollowing(true);
    });
  }

  async function requestToFollow() {
    await withUser(async (userId) => {
      const { error: err } = await supabase.from("follow_requests").insert({ requester_id: userId, target_id: targetId });
      if (err) setError("Could not send the request. Try again.");
      else setRequested(true);
    });
  }

  async function cancelRequest() {
    await withUser(async (userId) => {
      const { error: err } = await supabase.from("follow_requests").delete().eq("requester_id", userId).eq("target_id", targetId);
      if (err) setError("Could not cancel the request. Try again.");
      else setRequested(false);
    });
  }

  const mode = following ? "following" : visibility === "private" ? (requested ? "requested" : "request") : "follow";

  const config = {
    following: { label: "Following", icon: UserCheck, className: "btn-ghost !py-2 text-sm", onClick: unfollow },
    follow: { label: "Follow", icon: UserPlus, className: "btn-accent !py-2 text-sm", onClick: follow },
    request: { label: "Request to follow", icon: UserPlus, className: "btn-accent !py-2 text-sm", onClick: requestToFollow },
    requested: { label: "Requested", icon: Clock, className: "btn-ghost !py-2 text-sm", onClick: cancelRequest },
  }[mode];

  const Icon = config.icon;

  return (
    <div>
      <button type="button" onClick={config.onClick} disabled={busy} className={config.className}>
        <Icon size={16} />
        {config.label}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-800 dark:text-red-400">{error}</p>}
    </div>
  );
}

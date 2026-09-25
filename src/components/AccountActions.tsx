"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "./ConfirmDialog";

// Everything under the user's own folder, whatever it's called — older
// uploads live in folders (like "concerts") that no longer exist in the app,
// and a fixed list of folder names would leave those behind on deletion.
async function listUserFiles(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string[]> {
  const paths: string[] = [];
  async function walk(prefix: string, depth: number) {
    if (depth > 4) return;
    let offset = 0;
    for (;;) {
      const { data: entries } = await supabase.storage.from("media").list(prefix, { limit: 1000, offset });
      if (!entries || entries.length === 0) return;
      for (const entry of entries) {
        if (entry.id === null) await walk(`${prefix}/${entry.name}`, depth + 1);
        else paths.push(`${prefix}/${entry.name}`);
      }
      if (entries.length < 1000) return;
      offset += 1000;
    }
  }
  await walk(userId, 0);
  return paths;
}

export function ExportDataButton({ userId }: { userId: string }) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportData() {
    setBusy(true);
    setError(null);
    const [
      { data: profile },
      { data: countries },
      { data: events },
      { data: comments },
      { data: likes },
      { data: following },
      { data: followers },
      { data: followRequests },
      { data: blocks },
      { data: notifications },
      { data: billing },
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase
        .from("visited_countries")
        .select("*, country_visits(*), country_cities(*), country_media!country_media_visited_country_id_fkey(*)")
        .eq("user_id", userId),
      supabase
        .from("events")
        .select("*, event_media!event_media_event_id_fkey(*)")
        .eq("user_id", userId),
      supabase.from("comments").select("kind, target_id, body, created_at").eq("user_id", userId),
      supabase.from("likes").select("kind, target_id, created_at").eq("user_id", userId),
      supabase.from("follows").select("created_at, followee:profiles!follows_followee_id_fkey(username, display_name)").eq("follower_id", userId),
      supabase.from("follows").select("created_at, follower:profiles!follows_follower_id_fkey(username, display_name)").eq("followee_id", userId),
      supabase.from("follow_requests").select("requester_id, target_id, created_at").or(`requester_id.eq.${userId},target_id.eq.${userId}`),
      supabase.rpc("my_blocked_profiles"),
      supabase.from("notifications").select("kind, target_kind, target_id, comment_body, read, created_at").eq("user_id", userId),
      supabase.from("billing").select("plan, source, current_period_end, updated_at").eq("user_id", userId).maybeSingle(),
    ]);
    setBusy(false);
    if (!profile) {
      setError("Could not prepare your export. Try again.");
      return;
    }
    const payload = {
      exported_at: new Date().toISOString(),
      profile,
      countries,
      events,
      comments_you_wrote: comments,
      likes_you_gave: likes,
      following,
      followers,
      follow_requests: followRequests,
      accounts_you_blocked: blocks,
      notifications,
      subscription: billing,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expandiax-export-${profile.username}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <button type="button" className="btn-ghost !py-2 text-sm" onClick={exportData} disabled={busy}>
        <Download size={16} /> {busy ? "Preparing…" : "Export my data"}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-800 dark:text-red-400">{error}</p>}
    </div>
  );
}

export type DeletableSubscription = { source: "stripe" | "apple" } | null;

function deletionWarning(subscription: DeletableSubscription): string {
  const base = "Everything goes - your profile, countries, events, photos and videos. This cannot be undone. Consider exporting your data first.";
  if (subscription?.source === "stripe") {
    return `${base} Your Premium subscription will be cancelled immediately, with no refund for the rest of the period.`;
  }
  if (subscription?.source === "apple") {
    return `${base} Your Premium subscription is managed by Apple, so deleting your account does NOT cancel it - cancel it first on your iPhone under Settings > your name > Subscriptions, or Apple will keep charging you.`;
  }
  return base;
}

export function DeleteAccountButton({ userId, subscription = null }: { userId: string; subscription?: DeletableSubscription }) {
  const router = useRouter();
  const supabase = createClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    // First stop any subscription, so deleting the account can never leave
    // it billing. If that fails, nothing is deleted.
    try {
      const res = await fetch("/api/account/cancel-subscription", { method: "POST" });
      if (!res.ok) throw new Error("cancel failed");
    } catch {
      setError("We couldn't cancel your subscription, so your account has NOT been deleted. Try again, or contact support.");
      setBusy(false);
      setConfirmOpen(false);
      return;
    }
    const paths = await listUserFiles(supabase, userId);
    if (paths.length) await supabase.storage.from("media").remove(paths);
    const { error: err } = await supabase.rpc("delete_own_account");
    if (err) {
      setError("Could not delete your account. Try again, or contact support.");
      setBusy(false);
      return;
    }
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div>
      <button type="button" className="btn-danger !py-2 text-sm" onClick={() => setConfirmOpen(true)}>
        Delete my account
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-800 dark:text-red-400">{error}</p>}
      <ConfirmDialog
        open={confirmOpen}
        title="Delete your account?"
        body={deletionWarning(subscription)}
        confirmLabel="Delete everything"
        busy={busy}
        onConfirm={deleteAccount}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

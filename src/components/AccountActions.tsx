"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "./ConfirmDialog";

async function listUserFiles(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string[]> {
  const paths: string[] = [];
  for (const folder of ["avatar", "countries", "events"]) {
    const { data: entries } = await supabase.storage.from("media").list(`${userId}/${folder}`, { limit: 1000 });
    for (const entry of entries ?? []) {
      if (entry.id === null) {
        const { data: files } = await supabase.storage
          .from("media")
          .list(`${userId}/${folder}/${entry.name}`, { limit: 1000 });
        for (const f of files ?? []) paths.push(`${userId}/${folder}/${entry.name}/${f.name}`);
      } else {
        paths.push(`${userId}/${folder}/${entry.name}`);
      }
    }
  }
  return paths;
}

export function ExportDataButton({ userId }: { userId: string }) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportData() {
    setBusy(true);
    setError(null);
    const [{ data: profile }, { data: countries }, { data: events }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase
        .from("visited_countries")
        .select("*, country_visits(*), country_cities(*), country_media!country_media_visited_country_id_fkey(*)")
        .eq("user_id", userId),
      supabase
        .from("events")
        .select("*, event_media!event_media_event_id_fkey(*)")
        .eq("user_id", userId),
    ]);
    setBusy(false);
    if (!profile) {
      setError("Could not prepare your export. Try again.");
      return;
    }
    const payload = { exported_at: new Date().toISOString(), profile, countries, events };
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

export function DeleteAccountButton({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    setBusy(true);
    setError(null);
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
        body="Everything goes — your profile, countries, events, photos and videos. This cannot be undone. Consider exporting your data first."
        confirmLabel="Delete everything"
        busy={busy}
        onConfirm={deleteAccount}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

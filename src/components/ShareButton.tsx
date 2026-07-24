"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  kind: "country" | "event";
  targetId: string;
  title: string;
  className?: string;
};

export function ShareButton({ kind, targetId, title, className }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/share-card/${kind}/${targetId}`);
      if (!res.ok) throw new Error("card failed");
      const blob = await res.blob();
      const file = new File([blob], "expandiax.png", { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${title} — ExpandiaX` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "expandiax.png";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("Could not share this. Try again.");
    }
    setBusy(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={share}
        disabled={busy}
        className={cn("inline-flex items-center gap-1.5 text-sm text-muted hover:text-accent", className)}
      >
        <Share2 size={16} />
        {busy ? "Preparing…" : "Share"}
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-red-800 dark:text-red-400">{error}</p>}
    </div>
  );
}

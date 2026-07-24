"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Download, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  kind: "country" | "event";
  targetId: string;
  title: string;
  className?: string;
};

export function ShareButton({ kind, targetId, title, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);

  useEffect(() => setMounted(true), []);

  async function getCard(): Promise<Blob> {
    if (blob) return blob;
    const res = await fetch(`/api/share-card/${kind}/${targetId}`);
    if (!res.ok) throw new Error("card failed");
    const fresh = await res.blob();
    setBlob(fresh);
    return fresh;
  }

  async function share() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const card = await getCard();
      const file = new File([card], "expandiax.png", { type: "image/png" });
      await navigator.share({ files: [file], title: `${title} — ExpandiaX` });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("Could not share this. Try again.");
    }
    setBusy(false);
  }

  async function copyImage() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const card = await getCard();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": card })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Could not copy — try downloading instead.");
    }
    setBusy(false);
  }

  async function downloadImage() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const card = await getCard();
      const url = URL.createObjectURL(card);
      const a = document.createElement("a");
      a.href = url;
      a.download = "expandiax.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not download the image. Try again.");
    }
    setBusy(false);
  }

  if (!mounted) return <span className={cn("inline-block h-5 w-16", className)} aria-hidden />;

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.canShare === "function";
  const btnClass = "inline-flex items-center gap-1.5 text-sm text-muted hover:text-accent disabled:opacity-50";

  return (
    <div>
      {canNativeShare ? (
        <button type="button" onClick={share} disabled={busy} className={cn(btnClass, className)}>
          <Share2 size={16} />
          {busy ? "Preparing…" : "Share to Instagram & more"}
        </button>
      ) : (
        <div className="flex items-center gap-5">
          <button type="button" onClick={copyImage} disabled={busy} className={cn(btnClass, className)}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied — paste into Instagram" : "Copy image"}
          </button>
          <button type="button" onClick={downloadImage} disabled={busy} className={cn(btnClass, className)}>
            <Download size={16} />
            Download
          </button>
        </div>
      )}
      {error && <p role="alert" className="mt-1.5 text-xs text-red-800 dark:text-red-400">{error}</p>}
    </div>
  );
}

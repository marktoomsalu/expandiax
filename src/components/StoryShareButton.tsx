"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { tapLight } from "@/lib/haptics";

function InstagramGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="17.4" cy="6.6" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * "Share to Story": the memory as a 9:16 picture (the card on its own photo,
 * blurred into ExpandiaX purple, the logo above), handed to the phone's share
 * sheet, where Instagram offers Story. Made as soon as the card is on
 * screen, so the tap opens the sheet at once (iPhone only allows sharing
 * straight from a tap).
 */
export function StoryShareButton({ kind, id, eyebrow, title }: { kind: "event" | "country"; id: string; eyebrow: string; title: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const loading = useRef<Promise<File | null> | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const url = `/api/story/memory?kind=${kind}&id=${id}&eyebrow=${encodeURIComponent(eyebrow)}`;
  const name = `expandiax-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "memory"}.png`;

  const prepare = useCallback(() => {
    loading.current ??= fetch(url)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => (b ? new File([b], name, { type: "image/png" }) : null))
      .then((f) => {
        setFile(f);
        return f;
      })
      .catch(() => null);
    return loading.current;
  }, [url, name]);

  // Ready before the tap: made once the card comes into view.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void prepare();
          io.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [prepare]);

  async function share() {
    tapLight();
    setNote(null);
    let f = file;
    if (!f) {
      setBusy(true);
      f = await prepare();
      setBusy(false);
      if (!f) return setNote("Couldn't make the picture. Try again?");
    }
    try {
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f] });
        return;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      // The picture took longer than iPhone allows after a tap: it's ready now.
      if ((e as Error).name === "NotAllowedError") return setNote("Ready: tap again to share.");
    }
    // No share sheet (a computer): save it instead.
    const a = document.createElement("a");
    a.href = URL.createObjectURL(f);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  return (
    <div className="flex-1">
      <button
        ref={ref}
        type="button"
        onClick={() => void share()}
        disabled={busy}
        className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-[#7c3aed] via-[#fa51a2] to-[#fb7822] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(250,81,162,0.9)] transition-transform active:scale-[0.98] disabled:opacity-80"
      >
        {busy ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <InstagramGlyph />}
        {busy ? "Making your Story…" : "Share to Story"}
      </button>
      {note && <p className="mt-1.5 text-center text-xs text-muted">{note}</p>}
    </div>
  );
}

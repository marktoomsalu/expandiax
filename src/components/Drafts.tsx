"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FilePen, ImageIcon, X } from "lucide-react";
import { clearDraft, listDrafts, savedAgo, type DraftKind, type DraftMeta } from "@/lib/drafts";

/** "Unfinished drafts": memories started on this device and not saved yet, to carry on with (or let go). */
export function DraftsList({ kind, match, className }: { kind: DraftKind; /** Only drafts whose key has this in it (one country's, say: ":IT:"). */ match?: string; className?: string }) {
  const [drafts, setDrafts] = useState<DraftMeta[]>([]);
  useEffect(() => {
    const load = () => setDrafts(listDrafts(kind).filter((d) => !match || d.key.includes(match)));
    load();
    window.addEventListener("expandiax:drafts", load);
    window.addEventListener("focus", load);
    return () => {
      window.removeEventListener("expandiax:drafts", load);
      window.removeEventListener("focus", load);
    };
  }, [kind, match]);
  if (!drafts.length) return null;

  return (
    <section className={className} aria-labelledby={`drafts-${kind}-h`}>
      <h2 id={`drafts-${kind}-h`} className="flex items-center gap-2 font-serif text-xl">
        <FilePen size={18} className="text-accent" aria-hidden /> Unfinished drafts
      </h2>
      <p className="mt-0.5 text-xs text-muted">Kept on this device until you save them.</p>
      <ul className="mt-3 space-y-2">
        {drafts.map((d) => (
          <li key={d.key} className="flex items-center gap-2 rounded-2xl border border-dashed border-accent/50 bg-accent-soft/30 pl-4 pr-1.5">
            <Link href={d.href} className="min-w-0 flex-1 py-3">
              <span className="block truncate font-medium">{d.editing ? `Unsaved changes: ${d.title}` : d.title}</span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                Saved {savedAgo(d.savedAt)}
                {d.files ? (
                  <>
                    {" · "}
                    <ImageIcon size={11} aria-hidden /> {d.files}
                  </>
                ) : null}
              </span>
            </Link>
            <Link href={d.href} className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white">
              Continue
            </Link>
            <button type="button" onClick={() => clearDraft(d.key)} aria-label={`Discard ${d.title}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-ink">
              <X size={15} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Shown on a form that brought a draft back: when it was from, and a way to start over. */
export function DraftRestored({ at, onDiscard }: { at: number; onDiscard: () => void }) {
  return (
    <p role="status" className="flex items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent-soft/50 px-4 py-2.5 text-sm">
      <span>
        <span className="font-medium">Your draft is back</span>
        <span className="text-muted"> · saved {savedAgo(at)}</span>
      </span>
      <button type="button" onClick={onDiscard} className="shrink-0 text-xs font-medium text-muted hover:text-ink hover:underline">
        Start over
      </button>
    </p>
  );
}

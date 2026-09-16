"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { validateFile } from "@/lib/media";

export type PendingItem = { file: File; previewUrl: string };

const NOUN: Record<"image" | "video", string> = { image: "photos", video: "videos" };

// A create-time-only picker — pick, preview, remove, nothing uploads until
// the parent form's own submit. Self-contained (validation, cap, preview
// URL lifecycle) so callers just hold the `items` array; distinct from
// MediaUploader, which handles the "already saved, add more anytime"
// surface with real upload/progress/reorder/cover.
export function PendingMediaPicker({
  kind,
  items,
  onChange,
  cap,
  onFirstAdd,
}: {
  kind: "image" | "video";
  items: PendingItem[];
  onChange: (items: PendingItem[]) => void;
  cap: number;
  /** Fires with the first file of the first-ever batch — e.g. EXIF date prefill. */
  onFirstAdd?: (file: File) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const noun = NOUN[kind];

  function addFiles(files: File[]) {
    setError(null);
    const wasEmpty = items.length === 0;
    const next: PendingItem[] = [];
    for (const file of files) {
      if (items.length + next.length >= cap) {
        setError(`You can add up to ${cap} ${noun} here.`);
        break;
      }
      const problem = validateFile(file, kind);
      if (problem) {
        setError(problem);
        continue;
      }
      next.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    if (next.length) {
      onChange([...items, ...next]);
      if (wasEmpty) onFirstAdd?.(next[0].file);
    }
  }

  function remove(url: string) {
    onChange(items.filter((x) => x.previewUrl !== url));
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {items.length > 0 && (
        <ul className="mb-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {items.map((p) => (
            <li key={p.previewUrl} className="relative aspect-square overflow-hidden rounded-lg border border-line bg-raised">
              {kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <video src={p.previewUrl} muted className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                aria-label={`Remove ${kind}`}
                onClick={() => remove(p.previewUrl)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={items.length >= cap}
        className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-card border border-dashed border-line bg-surface disabled:opacity-50"
      >
        <span className="text-sm text-muted">{items.length > 0 ? `Add more ${noun}` : `Add ${noun} (optional)`}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={kind === "image" ? "image/*" : "video/*"}
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) addFiles(Array.from(e.target.files));
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      {error && <p role="alert" className="mt-2 text-xs text-red-800 dark:text-red-400">{error}</p>}
    </div>
  );
}

"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Loader2, X } from "lucide-react";
import { hasNativePhotoPicker, pickNativePhotos, type PickProgress } from "@/lib/nativePhotoPicker";

const never = () => () => {};
import { classifyFile, validateFile } from "@/lib/media";
import { convertHeic } from "@/lib/heic";

export type PendingItem = { file: File; previewUrl: string; kind: "image" | "video" };

// A create-time-only picker — pick, preview, remove, nothing uploads until
// the parent form's own submit. Self-contained (classify, validate, cap,
// preview URL lifecycle) so callers just hold the `items` array; distinct
// from MediaUploader, which handles the "already saved, add more anytime"
// surface with real upload/progress/reorder/cover. Photos and videos share
// one list and one add button — each file is still capped against its own
// kind, since those limits genuinely differ (photoCap vs videoCap), but
// nothing stops a mixed batch: hitting one cap only blocks that kind.
export function PendingMediaPicker({
  items,
  onChange,
  photoCap,
  videoCap,
  onFirstAdd,
}: {
  items: PendingItem[];
  onChange: (items: PendingItem[]) => void;
  photoCap: number;
  videoCap: number;
  /** Fires with the first file of the first-ever batch — e.g. EXIF date prefill. */
  onFirstAdd?: (file: File) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // The app's own picker (build 10+): it closes at once and photos follow from iCloud.
  const nativePicker = useSyncExternalStore(never, hasNativePhotoPicker, () => false);
  const [fetching, setFetching] = useState<PickProgress | null>(null);

  async function pickNative() {
    const left = photoCap - items.filter((i) => i.kind === "image").length;
    if (left <= 0) {
      setError(`You can add up to ${photoCap} photos here.`);
      return;
    }
    setError(null);
    try {
      const { files, failed } = await pickNativePhotos(left, (n) => n && setFetching({ total: n, done: 0, fraction: 0 }), setFetching);
      if (failed) setError(`${failed} ${failed === 1 ? "photo" : "photos"} couldn't be downloaded from iCloud. Try those again.`);
      if (files.length) addFiles(files);
    } finally {
      setFetching(null);
    }
  }

  const photoCount = items.filter((i) => i.kind === "image").length;
  const videoCount = items.filter((i) => i.kind === "video").length;
  const atCap = photoCount >= photoCap && videoCount >= videoCap;

  // iPhone (HEIC) photos become JPEGs first — see lib/heic.ts.
  async function pickFiles(picked: File[]) {
    setError(null);
    setConverting(true);
    const { files, failed } = await convertHeic(picked).finally(() => setConverting(false));
    addFiles(files);
    if (failed.length) setError(`Couldn't read “${failed[0]}”. Try exporting it from Photos as JPEG.`);
  }

  function addFiles(files: File[]) {
    const wasEmpty = items.length === 0;
    const next: PendingItem[] = [];
    let addedPhotos = 0;
    let addedVideos = 0;
    for (const file of files) {
      const kind = classifyFile(file);
      if (!kind) {
        setError(`“${file.name}” isn't a supported photo or video.`);
        continue;
      }
      const cap = kind === "image" ? photoCap : videoCap;
      const current = (kind === "image" ? photoCount + addedPhotos : videoCount + addedVideos);
      if (current >= cap) {
        setError(`You can add up to ${cap} ${kind === "image" ? "photos" : "videos"} here.`);
        continue;
      }
      const problem = validateFile(file, kind);
      if (problem) {
        setError(problem);
        continue;
      }
      next.push({ file, previewUrl: URL.createObjectURL(file), kind });
      if (kind === "image") addedPhotos++;
      else addedVideos++;
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
              {p.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <video src={p.previewUrl} muted className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                aria-label={`Remove ${p.kind}`}
                onClick={() => remove(p.previewUrl)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {fetching && (
        <p className="mb-3 flex items-center gap-2 text-xs text-muted" role="status">
          <Loader2 size={14} className="animate-spin text-accent" aria-hidden />
          Getting {fetching.total} {fetching.total === 1 ? "photo" : "photos"} from your library… {Math.round(fetching.fraction * 100)}%. Fill in the rest
          meanwhile, and save once they&rsquo;re here.
        </p>
      )}
      <button
        type="button"
        onClick={() => (nativePicker ? void pickNative() : inputRef.current?.click())}
        disabled={atCap}
        className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-card border border-dashed border-line bg-surface disabled:opacity-50"
      >
        <span className="text-sm text-muted">
          {nativePicker
            ? items.length > 0
              ? "Add more photos"
              : "Add photos (optional)"
            : items.length > 0
              ? "Add more photos or videos"
              : "Add photos or videos (optional)"}
        </span>
      </button>
      {nativePicker && videoCount < videoCap && (
        <button type="button" onClick={() => inputRef.current?.click()} className="mt-2 text-sm font-medium text-accent hover:underline">
          Add a video
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif,video/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) void pickFiles(Array.from(e.target.files));
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      {converting && <p className="mt-2 text-xs text-muted">Preparing iPhone photos…</p>}
      {error && <p role="alert" className="mt-2 text-xs text-red-800 dark:text-red-400">{error}</p>}
    </div>
  );
}

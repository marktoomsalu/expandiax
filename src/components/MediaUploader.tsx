"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { validateFile, storagePath } from "@/lib/media";
import type { MediaItem } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  scope: "countries" | "events";
  parentId: string;
  table: "country_media" | "event_media";
  fkColumn: "visited_country_id" | "event_id";
  kind: "image" | "video";
  max: number;
  items: MediaItem[];
  coverId?: string | null;
  coverTable?: "visited_countries" | "events";
  captions?: boolean;
  label: string;
};

type Pending = { file: File; previewUrl: string; caption: string };

/** Upload with real progress via the Storage REST endpoint. */
async function uploadWithProgress(
  path: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("You need to be signed in to upload.");
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/media/${path}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status}). Check your storage policies.`));
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.send(file);
  });
}

export function MediaUploader(props: Props) {
  const { userId, scope, parentId, table, fkColumn, kind, max, items, coverId, coverTable, captions, label } = props;
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const remaining = max - items.length - pending.length;

  function pickFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const next: Pending[] = [];
    for (const file of Array.from(list)) {
      if (items.length + pending.length + next.length >= max) {
        setError(`You can keep up to ${max} ${kind === "image" ? "photos" : "videos"} here. Remove one to add another.`);
        break;
      }
      const problem = validateFile(file, kind);
      if (problem) {
        setError(problem);
        continue;
      }
      next.push({ file, previewUrl: URL.createObjectURL(file), caption: "" });
    }
    if (next.length) setPending((p) => [...p, ...next]);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function saveAll() {
    setBusy(true);
    setError(null);
    try {
      let order = items.length;
      for (const p of pending) {
        const path = storagePath(userId, scope, parentId, p.file);
        await uploadWithProgress(path, p.file, (pct) =>
          setProgress((cur) => ({ ...cur, [p.previewUrl]: pct }))
        );
        const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
        const { error: dbError } = await supabase.from(table).insert({
          [fkColumn]: parentId,
          storage_path: path,
          public_url: pub.publicUrl,
          media_type: kind,
          caption: p.caption,
          display_order: order++,
        });
        if (dbError) {
          await supabase.storage.from("media").remove([path]);
          throw new Error(
            dbError.message.includes("at most")
              ? dbError.message
              : "Could not save the file details. Try again."
          );
        }
        URL.revokeObjectURL(p.previewUrl);
      }
      setPending([]);
      setProgress({});
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while uploading.");
    } finally {
      setBusy(false);
    }
  }

  function removePending(url: string) {
    setPending((p) => p.filter((x) => x.previewUrl !== url));
    URL.revokeObjectURL(url);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    await supabase.from(table).delete().eq("id", toDelete.id);
    await supabase.storage.from("media").remove([toDelete.storage_path]);
    setDeleting(false);
    setToDelete(null);
    router.refresh();
  }

  async function move(item: MediaItem, dir: -1 | 1) {
    const sorted = [...items].sort((a, b) => a.display_order - b.display_order);
    const i = sorted.findIndex((x) => x.id === item.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const other = sorted[j];
    await Promise.all([
      supabase.from(table).update({ display_order: other.display_order }).eq("id", item.id),
      supabase.from(table).update({ display_order: item.display_order }).eq("id", other.id),
    ]);
    router.refresh();
  }

  async function setCover(item: MediaItem) {
    if (!coverTable) return;
    await supabase.from(coverTable).update({ cover_media_id: item.id }).eq("id", parentId);
    router.refresh();
  }

  const sorted = [...items].sort((a, b) => a.display_order - b.display_order);
  const Icon = kind === "image" ? ImagePlus : Video;

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h3 className="font-serif text-lg">{label}</h3>
        <p className="text-xs text-muted">
          {items.length}/{max} saved
        </p>
      </div>

      {sorted.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sorted.map((m, i) => (
            <li key={m.id} className="group relative overflow-hidden rounded-lg border border-line bg-raised">
              {m.media_type === "image" ? (
                <div className="relative aspect-[4/3] w-full">
                  <Image src={m.public_url} alt={m.caption || "Uploaded photo"} fill sizes="(min-width: 640px) 33vw, 50vw" className="object-cover" />
                </div>
              ) : (
                <video src={m.public_url} controls preload="metadata" className="aspect-[4/3] w-full bg-black object-contain" />
              )}
              {coverId === m.id && (
                <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-white">
                  Cover
                </span>
              )}
              {m.caption && <p className="truncate px-2 py-1.5 text-xs text-muted">{m.caption}</p>}
              <div className="flex items-center justify-between border-t border-line px-1.5 py-1">
                <div className="flex">
                  <button type="button" aria-label="Move earlier" className="p-1.5 text-muted hover:text-ink disabled:opacity-30" disabled={i === 0} onClick={() => move(m, -1)}>
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" aria-label="Move later" className="p-1.5 text-muted hover:text-ink disabled:opacity-30" disabled={i === sorted.length - 1} onClick={() => move(m, 1)}>
                    <ArrowDown size={14} />
                  </button>
                  {coverTable && m.media_type === "image" && coverId !== m.id && (
                    <button type="button" aria-label="Use as cover photo" title="Use as cover photo" className="p-1.5 text-muted hover:text-accent" onClick={() => setCover(m)}>
                      <Star size={14} />
                    </button>
                  )}
                </div>
                <button type="button" aria-label={`Delete ${kind}`} className="p-1.5 text-muted hover:text-red-700" onClick={() => setToDelete(m)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pending.length > 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-accent/50 bg-accent-soft/40 p-3">
          <p className="text-xs font-medium text-ink">Ready to save</p>
          <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {pending.map((p) => (
              <li key={p.previewUrl} className="overflow-hidden rounded-lg border border-line bg-surface">
                {kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.previewUrl} alt={`Preview of ${p.file.name}`} className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <video src={p.previewUrl} className="aspect-[4/3] w-full bg-black object-contain" muted />
                )}
                {typeof progress[p.previewUrl] === "number" && (
                  <div className="h-1 w-full bg-line" role="progressbar" aria-valuenow={progress[p.previewUrl]} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-1 bg-accent transition-all" style={{ width: `${progress[p.previewUrl]}%` }} />
                  </div>
                )}
                {captions && (
                  <input
                    type="text"
                    aria-label={`Caption for ${p.file.name}`}
                    placeholder="Caption (optional)"
                    className="w-full border-t border-line bg-transparent px-2 py-1.5 text-xs focus:outline-none"
                    value={p.caption}
                    onChange={(e) =>
                      setPending((cur) => cur.map((x) => (x.previewUrl === p.previewUrl ? { ...x, caption: e.target.value } : x)))
                    }
                  />
                )}
                <button type="button" className="w-full border-t border-line py-1.5 text-xs text-muted hover:text-red-700" onClick={() => removePending(p.previewUrl)} disabled={busy}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-accent mt-3 !py-2 text-sm" onClick={saveAll} disabled={busy}>
            {busy ? "Uploading…" : `Save ${pending.length} ${kind === "image" ? "photo" : "video"}${pending.length > 1 ? "s" : ""}`}
          </button>
        </div>
      )}

      <div className="mt-4">
        <input
          ref={inputRef}
          id={`${table}-${kind}-input`}
          type="file"
          accept={kind === "image" ? "image/*" : "video/*"}
          multiple
          className="sr-only"
          onChange={(e) => pickFiles(e.target.files)}
        />
        <label
          htmlFor={`${table}-${kind}-input`}
          className={cn(
            "btn-ghost cursor-pointer !py-2 text-sm",
            remaining <= 0 && "pointer-events-none opacity-40"
          )}
        >
          <Icon size={16} />
          {kind === "image" ? "Add photos" : "Add videos"}
        </label>
        <span className="ml-3 text-xs text-muted">
          {kind === "image" ? "JPEG, PNG or WebP · up to 10 MB each" : "MP4, WebM or MOV · up to 300 MB each"}
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-800/20 bg-red-800/5 px-3 py-2 text-sm text-red-800 dark:text-red-400">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete this ${kind}?`}
        body="It will be removed from your archive and from storage. This cannot be undone."
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
}

"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera as CameraIcon, ImagePlus, Loader2, MapPin, Move, Star, Trash2 } from "lucide-react";
import { Camera } from "@capacitor/camera";
import { createClient } from "@/lib/supabase/client";
import { classifyFile, focalPosition, validateFile } from "@/lib/media";
import { looksLikeHeic } from "@/lib/heic";
import { enqueueUploads } from "@/lib/uploadQueue";
import { QueuedMedia } from "./UploadQueue";
import type { MediaItem } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { RepositionPhotoDialog } from "./RepositionPhotoDialog";
import { cn } from "@/lib/utils";
import { useIsNative } from "@/lib/useIsNative";
import { tapSuccess } from "@/lib/haptics";
import { nearestPlace, photoTakenAt } from "@/lib/photoDates";
import { groupByTown, placeKey } from "@/lib/photoPlaces";
import { readPhotoFacts, savePlaces } from "./PhotoPlaceSuggestion";
import { PhotoArranger } from "./PhotoArranger";
import { placeByTime } from "@/lib/mediaOrder";
import { pickCover } from "@/lib/photoPrepare";
import { hasNativePhotoPicker, pickNativePhotos, type PickProgress } from "@/lib/nativePhotoPicker";

const never = () => () => {};

type Props = {
  userId: string;
  scope: "countries" | "events";
  parentId: string;
  table: "country_media" | "event_media";
  fkColumn: "visited_country_id" | "country_visit_id" | "event_id";
  photoCap: number;
  videoCap: number;
  items: MediaItem[];
  coverId?: string | null;
  coverTable?: "visited_countries" | "country_visits" | "events";
  captions?: boolean;
  label: string;
  /** Extra fixed columns to set on every inserted row — e.g. a per-visit photo also needs its parent country's id. */
  extraFields?: Record<string, string>;
  /** Big "Take photo" / "Add photos or videos" tiles on top instead of small buttons below. */
  tiles?: boolean;
  /** A trip's places: each photo can belong to one (matched by where it was taken, on the device). */
  places?: UploaderPlace[];
  /** The trip's country — photos taken somewhere new in it become new places of the trip. */
  countryCode?: string;
};

export type UploaderPlace = { id: string; name: string; lat: number | null; lng: number | null; position: number; arrived: string | null; departed: string | null };

export function MediaUploader(props: Props) {
  // In the app: the native camera button. Read safely while drawing (see useIsNative).
  const native = useIsNative();
  const { userId, scope, parentId, table, fkColumn, photoCap, videoCap, items, coverId, coverTable, captions, label, extraFields, tiles = false } = props;
  const places = table === "country_media" ? props.places ?? [] : [];
  // With two or more places, each photo shows (and can change) which one it's from.
  const choosePlace = places.length >= 2;
  const cameraRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [videoQuality, setVideoQuality] = useState<"standard" | "hd">("standard");
  const [error, setError] = useState<string | null>(null);
  // Photos being read (when and where taken) before they join the uploads.
  const [preparing, setPreparing] = useState(0);
  const [toDelete, setToDelete] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toReposition, setToReposition] = useState<MediaItem | null>(null);
  const [addedPlaces, setAddedPlaces] = useState<string[]>([]);
  // The app's own picker (build 10+): it closes at once and photos follow from iCloud.
  const nativePicker = useSyncExternalStore(never, hasNativePhotoPicker, () => false);
  const [fetching, setFetching] = useState<PickProgress | null>(null);

  async function pickNative() {
    if (photoRemaining <= 0) {
      setError(`You can keep up to ${photoCap} photos here. Remove one to add another.`);
      return;
    }
    setError(null);
    try {
      const { files, failed } = await pickNativePhotos(
        photoRemaining,
        (n) => n && setFetching({ total: n, done: 0, fraction: 0 }),
        setFetching
      );
      if (failed) setError(`${failed} ${failed === 1 ? "photo" : "photos"} couldn't be downloaded from iCloud. Try those again.`);
      if (files.length) {
        window.dispatchEvent(new CustomEvent<File[]>("expandiax:photos-picked", { detail: files }));
        await addAndUpload(files);
      }
    } finally {
      setFetching(null);
    }
  }

  const photoCount = items.filter((m) => m.media_type === "image").length;
  const videoCount = items.filter((m) => m.media_type === "video").length;
  const photoRemaining = photoCap - photoCount;
  const videoRemaining = videoCap - videoCount;

  // Picked photos start uploading straight away, in the order they were
  // taken, while the person carries on with the page; there's no extra
  // "save" step. Only reading when and where each was taken happens first.
  async function addAndUpload(files: File[]) {
    setError(null);
    const accepted: { file: File; kind: "image" | "video" }[] = [];
    let photos = photoCount;
    let videos = videoCount;
    for (const file of files) {
      // iPhone (HEIC) photos are converted in the background upload, not here.
      const kind = looksLikeHeic(file) ? "image" : classifyFile(file);
      if (!kind) {
        setError(`“${file.name}” isn't a supported photo or video.`);
        continue;
      }
      if ((kind === "image" ? photos : videos) >= (kind === "image" ? photoCap : videoCap)) {
        setError(`You can keep up to ${kind === "image" ? photoCap : videoCap} ${kind === "image" ? "photos" : "videos"} here. Remove one to add another.`);
        continue;
      }
      const problem = looksLikeHeic(file) ? null : validateFile(file, kind);
      if (problem) {
        setError(problem);
        continue;
      }
      accepted.push({ file, kind });
      if (kind === "image") photos++;
      else videos++;
    }
    if (!accepted.length) return;

    setPreparing((n) => n + accepted.length);
    try {
      const images = accepted.filter((a) => a.kind === "image").map((a) => a.file);
      const [times, facts] = await Promise.all([
        Promise.all(accepted.map((a) => (a.kind === "image" ? photoTakenAt(a.file) : Promise.resolve(null)))),
        table === "country_media" && props.countryCode && images.length ? readPhotoFacts(images, props.countryCode) : Promise.resolve(null),
      ]);
      const cityOf = facts ? await placesFor(images, facts) : new Map<File, string>();

      // Slot them in by when they were taken; what's already here keeps its order.
      const keys = accepted.map((_, i) => `new-${i}`);
      const placed = placeByTime(
        items.map((m) => ({ id: m.id, order: m.display_order, takenAt: m.taken_at ?? null })),
        accepted.map((_, i) => ({ key: keys[i], takenAt: times[i] }))
      );
      const moved = placed.flatMap((p, idx) => (!p.isNew && items.find((m) => m.id === p.id)?.display_order !== idx ? [{ id: p.id, idx }] : []));
      await Promise.all(moved.map((m) => supabase.from(table).update({ display_order: m.idx }).eq("id", m.id)));
      const positionOf = new Map(placed.map((p, idx) => [p.id, idx]));

      // No cover yet: the best landscape photo of these (or the first) becomes it.
      let cover: File | undefined;
      if (coverTable && !coverId && images.length) {
        const best = await Promise.race([pickCover(images).catch(() => -1), new Promise<number>((r) => setTimeout(() => r(-1), 1500))]);
        cover = images[best] ?? images[0];
      }

      enqueueUploads(
        accepted.map((a, i) => {
          const cityId = cityOf.get(a.file);
          return {
            file: a.file,
            kind: a.kind,
            target: {
              userId,
              scope,
              parentId,
              table,
              fields: { [fkColumn]: parentId, ...extraFields, ...(cityId ? { city_id: cityId } : {}) },
              displayOrder: positionOf.get(keys[i]) ?? items.length + i,
              takenAt: times[i],
              videoQuality,
              cover: cover && a.file === cover && coverTable ? { table: coverTable, id: parentId } : undefined,
            },
          };
        })
      );
      tapSuccess();
      if (moved.length) router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while adding those.");
    } finally {
      setPreparing((n) => n - accepted.length);
    }
  }

  // Where each photo was taken (read on the device, before it's stripped for
  // upload): a photo from one of the trip's places goes under it; photos
  // from somewhere new in the country become new places of the trip, with
  // their days. Returns each photo's place.
  async function placesFor(images: File[], facts: Awaited<ReturnType<typeof readPhotoFacts>>): Promise<Map<File, string>> {
    const result = new Map<File, string>();
    const rest: { file: File; fact: (typeof facts)[number] }[] = [];
    images.forEach((file, i) => {
      const f = facts[i];
      const match =
        (f.town && places.find((p) => placeKey(p.name) === placeKey(f.town!.name))) ||
        (f.spot && nearestPlace(f.spot, places, f.town ? 10 : 60)) ||
        null;
      if (match) result.set(file, match.id);
      else rest.push({ file, fact: f });
    });
    const visitedCountryId = extraFields?.visited_country_id;
    if (!visitedCountryId) return result;
    const span = (days: (string | null | undefined)[]) => {
      const ok = days.filter((d): d is string => !!d).sort();
      return { arrived: ok[0] ?? null, departed: ok[ok.length - 1] ?? null };
    };
    // Places without days get them from their photos.
    for (const place of places) {
      if (place.arrived || place.departed) continue;
      const { arrived, departed } = span(images.flatMap((f, i) => (result.get(f) === place.id ? [facts[i].day] : [])));
      if (arrived) await supabase.from("country_cities").update({ arrived, departed }).eq("id", place.id);
    }
    const groups = groupByTown(rest.map((r) => r.fact));
    if (!groups.length) return result;
    // A trip with one place so far had all its photos "there": keep them there as others join.
    if (places.length === 1) {
      await supabase.from("country_media").update({ city_id: places[0].id }).eq("country_visit_id", parentId).is("city_id", null);
    }
    const toAdd = groups
      .map((g) => ({ key: g.key, name: g.name, lat: g.lat, lng: g.lng, ...span(g.photos.map((i) => rest[i].fact.day)) }))
      .sort((a, b) => (a.arrived ?? "9999").localeCompare(b.arrived ?? "9999"));
    const ids = await savePlaces(supabase, {
      visitedCountryId,
      visitId: parentId,
      places: toAdd,
      firstPosition: places.length ? Math.max(...places.map((p) => p.position)) + 1 : 0,
    });
    for (const g of groups) {
      const id = ids.get(g.key);
      if (id) for (const i of g.photos) result.set(rest[i].file, id);
    }
    setAddedPlaces(toAdd.filter((p) => ids.has(p.key)).map((p) => p.name));
    return result;
  }

  async function setPlace(item: MediaItem, placeId: string) {
    await supabase.from(table).update({ city_id: placeId || null }).eq("id", item.id);
    router.refresh();
  }

  function pickFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list);
    if (inputRef.current) inputRef.current.value = "";
    // Lets the page offer the dates these photos were taken (read on the device,
    // before their metadata is stripped for upload).
    window.dispatchEvent(new CustomEvent<File[]>("expandiax:photos-picked", { detail: picked }));
    void addAndUpload(picked);
  }

  async function mediaResultToFile(webPath: string | undefined, format: string | undefined): Promise<File | null> {
    if (!webPath) return null;
    const res = await fetch(webPath);
    const blob = await res.blob();
    const ext = format === "jpg" ? "jpeg" : format || "jpeg";
    return new File([blob], `photo-${Date.now()}.${ext}`, { type: blob.type || `image/${ext}` });
  }

  async function takeNativePhoto() {
    setError(null);
    try {
      const result = await Camera.takePhoto({ quality: 90, includeMetadata: true });
      const file = await mediaResultToFile(result.webPath, result.metadata?.format);
      if (file) void addAndUpload([file]);
    } catch {
      // User cancelled the camera or permission was denied — nothing to show.
    }
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

  // A new order from dragging: each photo gets its new position.
  async function reorder(ids: string[]) {
    const changed = ids.flatMap((id, idx) => (items.find((m) => m.id === id)?.display_order !== idx ? [{ id, idx }] : []));
    await Promise.all(changed.map((c) => supabase.from(table).update({ display_order: c.idx }).eq("id", c.id)));
    router.refresh();
  }

  async function saveCaption(item: MediaItem, caption: string) {
    if (caption.trim() === (item.caption ?? "").trim()) return;
    await supabase.from(table).update({ caption: caption.trim() }).eq("id", item.id);
    router.refresh();
  }

  async function setCover(item: MediaItem) {
    if (!coverTable) return;
    await supabase.from(coverTable).update({ cover_media_id: item.id }).eq("id", parentId);
    router.refresh();
  }

  const sorted = [...items].sort((a, b) => a.display_order - b.display_order);
  const byId = new Map(sorted.map((m) => [m.id, m]));

  const tile =
    "flex w-full items-center gap-2.5 rounded-2xl border border-line bg-surface p-3 text-left shadow-sm transition-colors hover:border-accent sm:gap-3.5 sm:p-4";
  const tileText = (title: string, hint: string) => (
    <span className="min-w-0 flex-1">
      <span className="block font-serif text-[15px] leading-tight sm:text-lg">{title}</span>
      <span className="mt-0.5 block text-[11px] leading-snug text-muted sm:text-xs">{hint}</span>
    </span>
  );

  return (
    <section>
      {tiles && (
        <div className="mb-5 grid grid-cols-2 gap-2.5 sm:gap-3">
          {native ? (
            <button type="button" onClick={takeNativePhoto} className={cn(tile, photoRemaining <= 0 && "pointer-events-none opacity-40")}>
              <CameraIcon size={24} className="shrink-0 text-accent" aria-hidden />
              {tileText("Take photo", "Capture a moment from this trip")}
            </button>
          ) : (
            <>
              {/* In a phone's browser this opens the camera; on a computer it's a file picker. */}
              <input
                ref={cameraRef}
                id={`${table}-camera-input`}
                type="file"
                accept="image/*,.heic,.heif"
                capture="environment"
                className="sr-only"
                onChange={(e) => pickFiles(e.target.files)}
              />
              <label htmlFor={`${table}-camera-input`} className={cn(tile, "cursor-pointer", photoRemaining <= 0 && "pointer-events-none opacity-40")}>
                <CameraIcon size={24} className="shrink-0 text-accent" aria-hidden />
                {tileText("Take photo", "Capture a moment from this trip")}
              </label>
            </>
          )}
          {nativePicker ? (
            <button type="button" onClick={() => void pickNative()} className={cn(tile, photoRemaining <= 0 && "pointer-events-none opacity-40")}>
              <ImagePlus size={24} className="shrink-0 text-accent" aria-hidden />
              {tileText("Add photos", "From your library")}
            </button>
          ) : (
            <label
              htmlFor={`${table}-media-input`}
              className={cn(tile, "cursor-pointer", photoRemaining <= 0 && videoRemaining <= 0 && "pointer-events-none opacity-40")}
            >
              <ImagePlus size={24} className="shrink-0 text-accent" aria-hidden />
              {tileText("Add photos or videos", "From your device or library")}
            </label>
          )}
        </div>
      )}
      <div className="flex items-baseline justify-between">
        <h3 className="font-serif text-lg">{label}</h3>
        <p className="text-xs text-muted">
          {photoCount}/{photoCap} photos · {videoCount}/{videoCap} videos
        </p>
      </div>

      {sorted.length > 0 && (
        <div className="mt-4">
          <PhotoArranger
            items={sorted.map((m) => ({ id: m.id, thumb: m.media_type === "image" ? m.public_url : null, isVideo: m.media_type === "video" }))}
            coverId={coverId ?? null}
            onReorder={(ids) => void reorder(ids)}
            onCover={coverTable ? (id) => { const m = byId.get(id); if (m && m.media_type === "image") void setCover(m); } : undefined}
            renderTile={(id) => {
              const m = byId.get(id)!;
              return (
                <>
                  {m.media_type === "image" ? (
                    <div className="relative aspect-[4/3] w-full">
                      <Image
                        src={m.public_url}
                        alt={m.caption || "Uploaded photo"}
                        fill
                        draggable={false}
                        sizes="(min-width: 640px) 33vw, 50vw"
                        className="pointer-events-none object-cover"
                        style={{ objectPosition: focalPosition(m) }}
                      />
                    </div>
                  ) : (
                    <video src={m.public_url} controls preload="metadata" className="aspect-[4/3] w-full bg-black object-contain" />
                  )}
                  {coverId === m.id && (
                    <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-white">
                      Cover
                    </span>
                  )}
                  {captions && (
                    <input
                      type="text"
                      aria-label="Caption"
                      placeholder="Add a caption"
                      defaultValue={m.caption}
                      onBlur={(e) => void saveCaption(m, e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      className="w-full border-t border-line bg-transparent px-2 py-1.5 text-base sm:text-xs focus:outline-none"
                    />
                  )}
                  {choosePlace && (
                    <PlaceSelect
                      places={places}
                      value={(m as MediaItem & { city_id?: string | null }).city_id ?? ""}
                      onChange={(v) => setPlace(m, v)}
                    />
                  )}
                  <div className="flex items-center justify-between border-t border-line px-1.5 py-1">
                    <div className="flex">
                      {coverTable && m.media_type === "image" && coverId !== m.id && (
                        <button type="button" aria-label="Use as cover photo" title="Use as cover photo" className="p-1.5 text-muted hover:text-accent" onClick={() => setCover(m)}>
                          <Star size={14} />
                        </button>
                      )}
                      {m.media_type === "image" && (
                        <button type="button" aria-label="Reposition photo" title="Reposition photo" className="p-1.5 text-muted hover:text-accent" onClick={() => setToReposition(m)}>
                          <Move size={14} />
                        </button>
                      )}
                    </div>
                    <button type="button" aria-label={`Delete ${m.media_type}`} className="p-1.5 text-muted hover:text-red-700" onClick={() => setToDelete(m)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              );
            }}
          />
        </div>
      )}

      {nativePicker && videoRemaining > 0 && (
        <label htmlFor={`${table}-media-input`} className="mt-3 inline-block cursor-pointer text-sm font-medium text-accent hover:underline">
          Add a video
        </label>
      )}

      {fetching && (
        <div className="mt-4" role="status">
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: Math.min(fetching.total, 8) }, (_, i) => (
              <li key={i} className={cn("aspect-square rounded-lg bg-raised", i >= fetching.done && "animate-pulse")} />
            ))}
          </ul>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted">
            <Loader2 size={14} className="animate-spin text-accent" aria-hidden />
            Getting {fetching.total} {fetching.total === 1 ? "photo" : "photos"} from your library… {Math.round(fetching.fraction * 100)}%. Keep going, they&rsquo;ll
            upload by themselves.
          </p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-raised">
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${Math.round(fetching.fraction * 100)}%` }} />
          </div>
        </div>
      )}

      {preparing > 0 && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted" role="status">
          <Loader2 size={14} className="animate-spin text-accent" aria-hidden />
          Adding {preparing} {preparing === 1 ? "photo" : "photos"}… keep going, they&rsquo;ll upload in the background.
        </p>
      )}

      <QueuedMedia parentId={parentId} className="mt-4" />

      {addedPlaces.length > 0 && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
          <MapPin size={13} className="mt-px shrink-0 text-accent" aria-hidden />
          <span>
            Added {addedPlaces.length === 1 ? addedPlaces[0] : `${addedPlaces.slice(0, -1).join(", ")} and ${addedPlaces.at(-1)}`} to this trip, from where your photos were taken
            {" - "}
            <a href="#places" className="text-accent underline-offset-4 hover:underline">
              change places
            </a>
          </span>
        </p>
      )}

      {/* Chosen before picking, since uploads start right away. */}
      {videoRemaining > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs text-muted">Videos upload in</span>
          <div className="flex gap-1.5">
            {(["standard", "hd"] as const).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setVideoQuality(q)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  videoQuality === q ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"
                )}
              >
                {q === "standard" ? "Standard - faster" : "HD - original"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <input
          ref={inputRef}
          id={`${table}-media-input`}
          type="file"
          accept="image/*,.heic,.heif,video/*"
          multiple
          className="sr-only"
          onChange={(e) => pickFiles(e.target.files)}
        />
        {!tiles && (
          <div className="flex flex-wrap items-center gap-2">
            {native && (
              <button
                type="button"
                className={cn("btn-ghost !py-2 text-sm", photoRemaining <= 0 && "pointer-events-none opacity-40")}
                onClick={takeNativePhoto}
              >
                <CameraIcon size={16} />
                Take photo
              </button>
            )}
            {/*
              Deliberately a plain file input on native too, not
              @capacitor/camera's gallery picker: WKWebView/Android WebView
              already hand file inputs off to the native picker sheet (Photos
              + Browse/Files app + Take Photo), so this loses nothing while
              gaining folder browsing and skipping the extra webPath fetch+blob
              round trip the Camera plugin needs per photo — that conversion
              was the main source of the native picker feeling slower than web.
            */}
            {nativePicker ? (
              <button type="button" onClick={() => void pickNative()} className={cn("btn-ghost !py-2 text-sm", photoRemaining <= 0 && "pointer-events-none opacity-40")}>
                <ImagePlus size={16} />
                Add photos
              </button>
            ) : (
              <label
                htmlFor={`${table}-media-input`}
                className={cn(
                  "btn-ghost cursor-pointer !py-2 text-sm",
                  photoRemaining <= 0 && videoRemaining <= 0 && "pointer-events-none opacity-40"
                )}
              >
                <ImagePlus size={16} />
                Add photos or videos
              </label>
            )}
          </div>
        )}
        <span className={cn("text-xs text-muted", !tiles && "ml-3")}>JPEG/PNG/WebP up to 10 MB, or MP4/WebM/MOV up to 300 MB</span>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-800/20 bg-red-800/5 px-3 py-2 text-sm text-red-800 dark:text-red-400">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete this ${toDelete?.media_type ?? "item"}?`}
        body="It will be removed from your archive and from storage. This cannot be undone."
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />

      {toReposition && (
        <RepositionPhotoDialog
          open={!!toReposition}
          onClose={() => setToReposition(null)}
          imageUrl={toReposition.public_url}
          table={table}
          mediaId={toReposition.id}
          initialFocalX={toReposition.focal_x}
          initialFocalY={toReposition.focal_y}
        />
      )}
    </section>
  );
}

/** Which of the trip's places a photo is from. */
function PlaceSelect({ places, value, onChange }: { places: UploaderPlace[]; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1.5 border-t border-line px-2 py-1.5 text-xs text-muted">
      <MapPin size={12} className="shrink-0 text-accent" aria-hidden />
      <span className="sr-only">Place</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 bg-transparent text-ink focus:outline-none">
        <option value="">Which place?</option>
        {places.map((pl) => (
          <option key={pl.id} value={pl.id}>
            {pl.name}
          </option>
        ))}
      </select>
    </label>
  );
}

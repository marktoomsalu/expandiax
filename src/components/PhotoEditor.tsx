"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2, RotateCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getEditedImageBlob } from "@/lib/cropImage";
import { storagePath } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/lib/types";

const SHAPES = [
  { key: "original", label: "Original" },
  { key: "square", label: "Square", ratio: 1 },
  { key: "portrait", label: "4:5", ratio: 4 / 5 },
  { key: "wide", label: "16:9", ratio: 16 / 9 },
] as const;
type Shape = (typeof SHAPES)[number]["key"];

/**
 * One photo (or video) full screen, to get it right: its caption with room
 * to read it all, and for a photo, turning it and cropping it. A caption
 * change is saved as it is; a turned or cropped photo is saved as a new
 * picture in place of the old one (same place in the trip, same cover).
 */
export function PhotoEditor({
  item,
  table,
  userId,
  scope,
  parentId,
  withCaption = true,
  onClose,
}: {
  item: MediaItem;
  table: "country_media" | "event_media";
  userId: string;
  scope: "countries" | "events";
  parentId: string;
  withCaption?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const photo = item.media_type === "image";
  const [caption, setCaption] = useState(item.caption ?? "");
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [shape, setShape] = useState<Shape>("original");
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The picture is fetched once as our own copy, so it can be redrawn
  // (turned, cropped) on the device without the browser refusing to.
  useEffect(() => {
    if (!photo) return;
    let url: string | null = null;
    let cancelled = false;
    fetch(item.public_url, { cache: "reload" })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => {
        if (cancelled) return;
        url = URL.createObjectURL(b);
        setSrc(url);
      })
      .catch(() => !cancelled && setError("Couldn't load the photo for editing. You can still change its caption."));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item.public_url, photo]);

  // The page underneath stays put while this is open.
  useEffect(() => {
    const { overflow } = document.documentElement.style;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, saving]);

  const sideways = rotation % 180 !== 0;
  const originalRatio = natural ? (sideways ? natural.h / natural.w : natural.w / natural.h) : 4 / 3;
  const chosen = SHAPES.find((s) => s.key === shape)!;
  const aspect = "ratio" in chosen ? chosen.ratio : originalRatio;
  const edited = photo && (rotation !== 0 || zoom > 1.001 || shape !== "original");

  async function save() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    try {
      const values: Record<string, string | null> = { caption: caption.trim() };
      if (edited && src && area) {
        const blob = await getEditedImageBlob(src, area, rotation);
        const file = new File([blob], "edited.jpg", { type: "image/jpeg" });
        const path = storagePath(userId, scope, parentId, file);
        const { error: upErr } = await supabase.storage.from("media").upload(path, file, { contentType: "image/jpeg" });
        if (upErr) throw upErr;
        values.storage_path = path;
        values.public_url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
        // A cropped photo starts centred again.
        values.focal_x = null;
        values.focal_y = null;
      } else if (values.caption === (item.caption ?? "").trim()) {
        onClose();
        return;
      }
      const { error: dbErr } = await supabase.from(table).update(values).eq("id", item.id);
      if (dbErr) {
        if (values.storage_path) await supabase.storage.from("media").remove([values.storage_path]);
        throw dbErr;
      }
      // The old picture isn't used anywhere any more.
      if (values.storage_path) await supabase.storage.from("media").remove([item.storage_path]).catch(() => {});
      router.refresh();
      onClose();
    } catch {
      setError("Couldn't save. Check your connection and try again.");
      setSaving(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={photo ? "Edit photo" : "Edit video"} className="fixed inset-0 z-[95] flex flex-col bg-brand-purple text-white">
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <button type="button" onClick={onClose} disabled={saving} className="h-11 rounded-full px-3 text-[15px] text-white/80 hover:text-white disabled:opacity-40">
          Cancel
        </button>
        <span className="font-serif text-lg">{photo ? "Edit photo" : "Edit video"}</span>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || (photo && edited && !area)}
          className="flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {saving && <Loader2 size={16} className="animate-spin" aria-hidden />} {saving ? "Saving" : "Done"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="relative mx-auto h-[min(58vh,560px)] w-full max-w-2xl">
          {photo ? (
            src ? (
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={aspect}
                minZoom={1}
                maxZoom={4}
                showGrid
                objectFit="contain"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setArea(pixels)}
                onMediaLoaded={(m) => setNatural({ w: m.naturalWidth, h: m.naturalHeight })}
                style={{ containerStyle: { background: "transparent" } }}
              />
            ) : (
              !error && (
                <div className="flex h-full items-center justify-center">
                  <Loader2 size={28} className="animate-spin text-white/70" aria-label="Loading the photo" />
                </div>
              )
            )
          ) : (
            <video src={item.public_url} controls playsInline className="h-full w-full object-contain" />
          )}
        </div>

        <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
          {photo && src && (
            <>
              <div className="flex items-center gap-2">
                <div className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto" role="group" aria-label="Shape">
                  {SHAPES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      aria-pressed={shape === s.key}
                      onClick={() => {
                        setShape(s.key);
                        setCrop({ x: 0, y: 0 });
                      }}
                      className={cn("h-10 shrink-0 rounded-full px-3.5 text-sm font-medium", shape === s.key ? "bg-white text-brand-purple" : "bg-white/10 text-white hover:bg-white/20")}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRotation((r) => (r + 90) % 360);
                    setCrop({ x: 0, y: 0 });
                  }}
                  aria-label="Turn the photo"
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-sm font-medium hover:bg-white/20"
                >
                  <RotateCw size={16} aria-hidden /> Turn
                </button>
              </div>
              <label className="flex items-center gap-3 text-sm text-white/75">
                Zoom
                <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-[rgb(var(--accent))]" />
              </label>
              <p className="text-xs text-white/60">Drag the photo to choose what&rsquo;s in the frame. Pinch or use the slider to zoom.</p>
            </>
          )}

          {withCaption && <div>
            <label htmlFor="photo-caption" className="text-sm font-medium text-white/85">
              Caption
            </label>
            <textarea
              id="photo-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="What was happening here?"
              className="mt-1.5 w-full resize-none rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-base leading-relaxed text-white placeholder:text-white/45 focus:border-white/40 focus:outline-none"
            />
            <p className="mt-1 text-xs text-white/55">Shows under the photo when it&rsquo;s opened, and in the post.</p>
          </div>}

          {error && (
            <p role="alert" className="rounded-xl bg-white/10 px-3 py-2 text-sm">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

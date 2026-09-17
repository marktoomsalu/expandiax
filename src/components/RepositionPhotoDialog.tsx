"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  table: "country_media" | "event_media";
  mediaId: string;
  initialFocalX: number | null;
  initialFocalY: number | null;
};

// The image is shown at its natural rendered size (no object-fit crop), so
// a pointer position maps 1:1 to a percentage of the image's own bounding
// box — no letterbox math needed. object-position is a focal point, not a
// crop box, so "tap/drag to place a marker" is the whole interaction.
export function RepositionPhotoDialog({ open, onClose, imageUrl, table, mediaId, initialFocalX, initialFocalY }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const router = useRouter();
  const supabase = createClient();
  const [pos, setPos] = useState({ x: initialFocalX ?? 50, y: initialFocalY ?? 0 });
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
    if (open) setPos({ x: initialFocalX ?? 50, y: initialFocalY ?? 0 });
  }, [open, initialFocalX, initialFocalY]);

  function updateFromPointer(e: React.PointerEvent) {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    setPos({ x: Math.round(x), y: Math.round(y) });
  }

  async function save() {
    setSaving(true);
    await supabase.from(table).update({ focal_x: pos.x, focal_y: pos.y }).eq("id", mediaId);
    setSaving(false);
    router.refresh();
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={onClose}
      className="w-full max-w-md rounded-card border border-line bg-surface p-5 text-ink shadow-xl backdrop:bg-black/60"
      aria-labelledby="reposition-title"
    >
      <h2 id="reposition-title" className="font-serif text-lg">Reposition photo</h2>
      <p className="mt-1 text-xs text-muted">Tap or drag to choose what stays in frame when this photo is cropped.</p>

      <div
        className="relative mt-4 touch-none select-none overflow-hidden rounded-lg border border-line bg-black"
        onPointerDown={(e) => {
          setDragging(true);
          updateFromPointer(e);
        }}
        onPointerMove={(e) => dragging && updateFromPointer(e)}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => setDragging(false)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={imageUrl} alt="" className="block h-auto max-h-[55vh] w-full cursor-crosshair" draggable={false} />
        <div
          aria-hidden
          className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.6)]"
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        />
      </div>

      <p className="mt-4 text-xs font-medium text-muted">Preview</p>
      <div className="relative mt-1.5 aspect-[16/8] w-full overflow-hidden rounded-lg border border-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="h-full w-full object-cover" style={{ objectPosition: `${pos.x}% ${pos.y}%` }} />
      </div>

      <div className="mt-5 flex justify-end gap-3">
        <button type="button" className="btn-ghost !py-2 text-sm" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button type="button" className="btn-accent !py-2 text-sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </dialog>
  );
}

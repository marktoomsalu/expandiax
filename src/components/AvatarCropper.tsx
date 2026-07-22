"use client";

import { useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { getCroppedImageBlob } from "@/lib/cropImage";

type Props = {
  open: boolean;
  imageSrc: string | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
};

export function AvatarCropper({ open, imageSrc, busy, onCancel, onConfirm }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedArea(null);
      setError(null);
    }
  }, [open, imageSrc]);

  async function confirm() {
    if (!imageSrc || !croppedArea) return;
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedArea);
      onConfirm(blob);
    } catch {
      setError("Could not crop that image. Try a different photo.");
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      onCancel={onCancel}
      className="w-full max-w-sm rounded-card border border-line bg-surface p-6 text-ink shadow-xl backdrop:bg-black/40"
      aria-labelledby="crop-title"
    >
      <h2 id="crop-title" className="font-serif text-xl">Adjust your photo</h2>
      <p className="mt-1 text-sm text-muted">Drag to reposition, pinch or use the slider to zoom.</p>

      {imageSrc && (
        <div className="relative mt-4 h-64 w-full overflow-hidden rounded-lg bg-raised">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setCroppedArea(pixels)}
          />
        </div>
      )}

      <label htmlFor="avatar-zoom" className="sr-only">Zoom</label>
      <input
        id="avatar-zoom"
        type="range"
        min={1}
        max={3}
        step={0.01}
        value={zoom}
        onChange={(e) => setZoom(Number(e.target.value))}
        className="mt-4 w-full accent-[rgb(var(--accent))]"
      />

      {error && <p role="alert" className="mt-2 text-xs text-red-800 dark:text-red-400">{error}</p>}

      <div className="mt-5 flex justify-end gap-3">
        <button type="button" className="btn-ghost !py-2 text-sm" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn-accent" onClick={confirm} disabled={busy || !croppedArea}>
          {busy ? "Saving…" : "Save photo"}
        </button>
      </div>
    </dialog>
  );
}

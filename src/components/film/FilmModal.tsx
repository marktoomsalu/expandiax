"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** The full launch film, with sound, over everything. Esc or a tap outside closes it. */
export function FilmModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // Opened by a tap, so the browser lets it play with sound.
    video.current?.play().catch(() => {});
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ExpandiaX film"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative aspect-[9/16] h-[min(88dvh,calc((100vw-2rem)*16/9))] overflow-hidden rounded-3xl bg-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <video ref={video} src="/film/expandiax-30s.mp4" poster="/film/poster-30s.jpg" controls playsInline autoPlay className="h-full w-full object-cover" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}

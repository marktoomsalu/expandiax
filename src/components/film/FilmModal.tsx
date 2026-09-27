"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

const WIDE = { src: "/film/expandiax-wide-30s.mp4", poster: "/film/poster-wide-30s.jpg" };
const TALL = { src: "/film/expandiax-30s.mp4", poster: "/film/poster-30s.jpg" };

/**
 * The full launch film, with sound, over everything — the wide cut on
 * computers, the vertical one on a phone held upright. Esc or a tap outside
 * closes it.
 */
export function FilmModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Opened by a tap, so the browser lets it play with sound.
  useEffect(() => {
    if (open) video.current?.play().catch(() => {});
  }, [open]);

  if (!open) return null;
  // Only ever rendered in the browser after a tap, so the screen shape is known.
  const tall = window.matchMedia("(orientation: portrait)").matches;
  const film = tall ? TALL : WIDE;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ExpandiaX film"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={
          tall
            ? "relative aspect-[9/16] h-[min(88dvh,calc((100vw-2rem)*16/9))] overflow-hidden rounded-3xl bg-black shadow-2xl"
            : "relative aspect-video w-[min(92vw,calc((100dvh-2rem)*16/9))] overflow-hidden rounded-2xl bg-black shadow-2xl"
        }
        onClick={(e) => e.stopPropagation()}
      >
        <video key={film.src} ref={video} src={film.src} poster={film.poster} controls playsInline autoPlay className="h-full w-full object-cover" />
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

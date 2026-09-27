"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { useAutoplayOk } from "./useAutoplayOk";
import { FilmModal } from "./FilmModal";

/**
 * The wide film looping silently in a cinematic frame; tapping it plays the
 * full film with sound. Only plays while on screen, and not at all for
 * reduced motion or data saving.
 */
export function WideFilm() {
  const autoplay = useAutoplayOk();
  const video = useRef<HTMLVideoElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const v = video.current;
    if (!v || !autoplay || open) {
      v?.pause();
      return;
    }
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0.3 });
    io.observe(v);
    return () => io.disconnect();
  }, [autoplay, open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Watch the ExpandiaX film with sound"
        className="group relative block aspect-video w-full overflow-hidden rounded-card bg-black text-left shadow-xl ring-1 ring-black/5"
      >
        <video
          ref={video}
          src="/film/expandiax-wide-15s-loop.mp4"
          poster="/film/poster-wide.jpg"
          muted
          loop
          playsInline
          preload={autoplay ? "auto" : "none"}
          aria-hidden
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
        />
        <span className="absolute inset-0 hidden bg-gradient-to-t from-black/60 via-transparent to-transparent sm:block" aria-hidden />
        <span className="absolute bottom-2.5 left-2.5 flex items-center gap-3 sm:bottom-6 sm:left-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-[#14110d] shadow-lg transition-transform group-hover:scale-110 sm:h-14 sm:w-14">
            <Play size={18} className="translate-x-0.5 fill-current" />
          </span>
          {/* On phones the frame is small and the film has its own captions, so the label sits underneath instead. */}
          <span className="hidden text-white drop-shadow sm:block">
            <span className="block font-serif text-2xl leading-tight">ExpandiaX in 30 seconds</span>
            <span className="block text-sm text-white/80">Watch with sound</span>
          </span>
        </span>
      </button>
      <button type="button" onClick={() => setOpen(true)} className="mt-3 block w-full text-left sm:hidden">
        <span className="block font-serif text-lg leading-tight">ExpandiaX in 30 seconds</span>
        <span className="block text-xs text-accent">Watch with sound</span>
      </button>
      <FilmModal open={open} onClose={close} />
    </>
  );
}

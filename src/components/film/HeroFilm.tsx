"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Volume2 } from "lucide-react";
import { useAutoplayOk } from "./useAutoplayOk";
import { FilmModal } from "./FilmModal";

/**
 * Landing page: the 15-second film looping silently in a phone, with a
 * button for the full film with sound. Browsers only autoplay silent video,
 * and it doesn't autoplay at all for reduced motion or data saving.
 */
export function HeroFilm() {
  const autoplay = useAutoplayOk();
  const video = useRef<HTMLVideoElement>(null);
  const [open, setOpen] = useState(false);

  // Only play while it's on screen, and not while the full film is open.
  useEffect(() => {
    const v = video.current;
    if (!v || !autoplay || open) {
      v?.pause();
      return;
    }
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, [autoplay, open]);

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Watch the ExpandiaX film with sound"
        className="relative w-[14.5rem] rounded-[2.6rem] border-[7px] border-[#1c1420] bg-[#1c1420] shadow-2xl shadow-accent/25 ring-1 ring-black/10 transition-transform hover:-translate-y-1 sm:w-[16.5rem]"
      >
        <span className="relative block aspect-[9/16] overflow-hidden rounded-[2.1rem] bg-black">
          <video
            ref={video}
            src="/film/expandiax-15s-loop.mp4"
            poster="/film/poster-15s.jpg"
            muted
            loop
            playsInline
            preload={autoplay ? "auto" : "none"}
            aria-hidden
            className="h-full w-full object-cover"
          />
          {autoplay === false && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/25">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-[#14110d] shadow-lg">
                <Play size={26} className="translate-x-0.5 fill-current" />
              </span>
            </span>
          )}
        </span>
        <span className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-[#1c1420]" aria-hidden />
      </button>
      <button type="button" onClick={() => setOpen(true)} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline">
        <Volume2 size={16} aria-hidden /> Watch with sound
      </button>
      <FilmModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

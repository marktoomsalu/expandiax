"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

// v2: earlier builds wrongly marked the film as seen when a phone blocked autoplay.
const SEEN_KEY = "expandiax:welcome-film-seen-v2";

export function welcomeFilmSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The 15-second film, full screen, as the very first thing on /start —
 * silent to begin with (browsers only autoplay muted), with Sound on and
 * Skip. If the phone won't play it by itself it simply steps aside — and
 * tries again next time, because it only counts as seen once it has ended
 * or been skipped.
 */
export function WelcomeFilm({ onDone }: { onDone: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  // Vertical on a phone held upright, wide on computers. Rendered only in the browser.
  const [tall] = useState(() => window.matchMedia("(orientation: portrait)").matches);
  const [muted, setMuted] = useState(true);
  const [leaving, setLeaving] = useState(false);

  function close(seen: boolean) {
    if (leaving) return;
    if (seen) {
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {}
    }
    setLeaving(true);
    setTimeout(onDone, 450);
  }
  const finish = () => close(true);

  const started = useRef(false);
  useEffect(() => {
    // Blocked, or not started after a moment (some phones neither play nor
    // say no): step aside without counting it as seen.
    video.current?.play().catch(() => close(false));
    const t = setTimeout(() => !started.current && close(false), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 bg-black transition-opacity duration-500 ${leaving ? "opacity-0" : "opacity-100"}`}
      role="dialog"
      aria-label="Welcome to ExpandiaX"
    >
      <video
        ref={video}
        src={tall ? "/film/expandiax-15s.mp4" : "/film/expandiax-wide-15s.mp4"}
        poster={tall ? "/film/poster-15s.jpg" : "/film/poster-wide.jpg"}
        muted={muted}
        playsInline
        autoPlay
        preload="auto"
        onPlaying={() => {
          started.current = true;
        }}
        onEnded={finish}
        onError={() => close(false)}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => {
            const next = !muted;
            setMuted(next);
            if (video.current) video.current.muted = next;
          }}
          className="flex items-center gap-2 rounded-full bg-black/45 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-black/60"
        >
          {muted ? <VolumeX size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}
          {muted ? "Sound on" : "Sound off"}
        </button>
        <button type="button" onClick={finish} className="rounded-full bg-black/45 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-black/60">
          Skip
        </button>
      </div>
    </div>
  );
}

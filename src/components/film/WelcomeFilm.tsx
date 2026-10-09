"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isNativePlatform } from "@/lib/capacitor";

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
 * with Sound on/off and Skip. It starts with sound when someone has just
 * tapped to watch it (falling back to silent where the browser still
 * says no), otherwise silent, since browsers only autoplay muted. If the phone won't play it by itself it simply steps aside — and
 * tries again next time, because it only counts as seen once it has ended
 * or been skipped.
 */
export function WelcomeFilm({ onDone, withSound = false }: { onDone: () => void; withSound?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  // The version that fits the screen: iPhone-shaped (9:19.5) on iPhone X and
  // newer, 9:16 on shorter phones like the SE, wide on computers and sideways
  // tablets — so nothing gets cropped. In the app it's the welcome film
  // (they've already downloaded it — show what they can do); on the website,
  // the launch film. Rendered only in the browser.
  const [film] = useState(() => {
    const shape = window.innerHeight / window.innerWidth;
    const native = isNativePlatform();
    if (shape >= 1.9)
      return native
        ? { src: "/film/expandiax-welcome-tall.mp4", poster: "/film/poster-welcome-tall.jpg" }
        : { src: "/film/expandiax-15s.mp4", poster: "/film/poster-15s.jpg" };
    if (shape >= 1.2)
      return native
        ? { src: "/film/expandiax-welcome.mp4", poster: "/film/poster-welcome.jpg" }
        : { src: "/film/expandiax-15s.mp4", poster: "/film/poster-15s.jpg" };
    return native
      ? { src: "/film/expandiax-welcome-wide.mp4", poster: "/film/poster-welcome-wide.jpg" }
      : { src: "/film/expandiax-wide-15s.mp4", poster: "/film/poster-wide.jpg" };
  });
  const [muted, setMuted] = useState(!withSound);
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
    const v = video.current;
    let cancelled = false;
    const start = (): Promise<void> | undefined =>
      v?.play().catch(() => {
        if (cancelled) return;
        if (!v.muted) {
          // Not allowed with sound here: play it silently instead.
          v.muted = true;
          setMuted(true);
          return start();
        }
        close(false);
      });
    start();
    const t = setTimeout(() => !started.current && close(false), 2500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
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
        src={film.src}
        poster={film.poster}
        muted={muted}
        playsInline
        preload="auto"
        onPlaying={() => {
          started.current = true;
        }}
        onEnded={finish}
        onError={() => close(false)}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* At the bottom, clear of the notch and of every scene's text. */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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

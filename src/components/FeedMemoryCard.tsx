"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Languages, MapPin, Music2, Play, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { focalPosition } from "@/lib/media";
import { eventTypeMeta } from "@/lib/events";
import { feedMusic, useFeedMusic } from "@/lib/feedMusic";
import type { EventType } from "@/lib/types";

type Track = { name: string; artist: string | null; spotifyId: string | null };
type Preview = { previewUrl: string | null; artworkUrl?: string | null };

function EqBars() {
  return (
    <span className="flex h-3.5 items-end gap-[2px]" aria-hidden>
      {[0, 0.2, 0.4].map((delay) => (
        <span key={delay} className="animate-eq-bar h-full w-[3px] rounded-full bg-white" style={{ animationDelay: `${delay}s` }} />
      ))}
    </span>
  );
}

function MusicSticker({ musicKey, track, preview }: { musicKey: string; track: Track; preview: Preview | null }) {
  const { soundOn, playingKey } = useFeedMusic();
  const playing = playingKey === musicKey;
  const url = preview?.previewUrl ?? null;

  const inner = (
    <>
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/15">
        {preview?.artworkUrl ? (
          <Image src={preview.artworkUrl} alt="" fill sizes="32px" className="object-cover" />
        ) : (
          <Music2 size={14} aria-hidden />
        )}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[13px] font-semibold">{track.name}</span>
        {track.artist && <span className="block truncate text-[11px] text-white/65">{track.artist}</span>}
      </span>
      {url && <span className="ml-1 shrink-0">{playing ? <EqBars /> : !soundOn && <VolumeX size={14} className="text-white/70" aria-hidden />}</span>}
    </>
  );

  const className =
    "pointer-events-auto flex max-w-[75%] items-center gap-2 rounded-xl bg-black/35 p-1 pr-2.5 text-left text-white ring-1 ring-white/15 backdrop-blur-md";

  if (url) {
    return (
      <button
        type="button"
        onClick={() => feedMusic.toggle(musicKey, url)}
        aria-pressed={playing}
        aria-label={playing ? `Mute ${track.name}` : `Play ${track.name}`}
        className={cn(className, "transition-transform active:scale-95")}
      >
        {inner}
      </button>
    );
  }
  if (preview && track.spotifyId) {
    return (
      <a href={`https://open.spotify.com/track/${track.spotifyId}`} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    );
  }
  return <div className={className}>{inner}</div>;
}

export type FeedMediaItem = {
  id: string;
  url: string;
  type: "image" | "video";
  alt: string;
  focalX?: number | null;
  focalY?: number | null;
};

type Props = {
  href: string;
  kind: "country" | "event";
  eventType: EventType | null;
  flag?: string;
  countryName: string | null;
  title: string;
  subtitle: string | null;
  body: string | null;
  dateLabel: string | null;
  location: string | null;
  track: Track | null;
  media: FeedMediaItem[];
  gradient: [string, string];
  priority?: boolean;
  actor: { username: string; display_name: string; avatar_url: string | null };
  actionLabel: string;
  when: string;
  /** Left side of the actions row (e.g. Remember). */
  actions?: React.ReactNode;
};

// The photo *is* the card: text sits on a scrim over the cover instead of
// above it, so a post reads like a memory, not a status update. Tapping a
// photo opens the post; swiping pages through the set; tapping a video
// plays it and fades the text away so nothing covers it.
export function FeedMemoryCard(p: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const previewRef = useRef<Preview | null>(null);
  const ratioRef = useRef(0);
  const musicKey = p.href;
  const trackName = p.track?.name;
  const trackArtist = p.track?.artist;

  // Look the clip up a screen or so before the post arrives, so it's ready
  // to play the moment it scrolls in.
  useEffect(() => {
    const node = cardRef.current;
    if (!node || !trackName) return;
    let cancelled = false;
    const prefetch = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        prefetch.disconnect();
        const qs = new URLSearchParams({
          name: trackName,
          artist: trackArtist ?? "",
        });
        fetch(`/api/music/preview?${qs}`)
          .then((r) => r.json())
          .catch(() => ({ previewUrl: null }))
          .then((data: Preview) => {
            if (cancelled) return;
            previewRef.current = data;
            setPreview(data);
            feedMusic.report(musicKey, ratioRef.current, data.previewUrl ?? null);
          });
      },
      { rootMargin: "800px 0px" }
    );
    prefetch.observe(node);
    return () => {
      cancelled = true;
      prefetch.disconnect();
    };
  }, [musicKey, trackName, trackArtist]);

  useEffect(() => {
    const node = cardRef.current;
    if (!node || !trackName) return;
    const seen = new IntersectionObserver(
      ([entry]) => {
        ratioRef.current = entry.intersectionRatio;
        feedMusic.report(musicKey, entry.intersectionRatio, previewRef.current?.previewUrl ?? null);
      },
      { threshold: [0, 0.25, 0.5, 0.6, 0.75, 0.9, 1] }
    );
    seen.observe(node);
    return () => {
      seen.disconnect();
      feedMusic.forget(musicKey);
    };
  }, [musicKey, trackName]);
  const [active, setActive] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [translated, setTranslated] = useState<{
    title: string;
    subtitle: string | null;
    body: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMedia = p.media.length > 0;
  const typeMeta = p.kind === "event" ? eventTypeMeta(p.eventType ?? "concert") : null;
  const TypeIcon = typeMeta?.icon;

  const shownTitle = translated?.title ?? p.title;
  const shownSubtitle = translated?.subtitle ?? p.subtitle;
  const shownBody = translated?.body ?? p.body;

  function scrollToIndex(i: number) {
    const track = trackRef.current;
    if (track) track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
  }

  function onScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== active) {
      setActive(i);
      setPlayingId(null);
    }
  }

  function playVideo(id: string, e: React.MouseEvent<HTMLButtonElement>) {
    const video = e.currentTarget.parentElement?.querySelector("video");
    if (!video) return;
    setPlayingId(id);
    feedMusic.yield(musicKey);
    void video.play();
  }

  async function toggleTranslate() {
    if (translated) {
      setTranslated(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texts: [p.title, p.subtitle ?? "", p.body ?? ""],
          targetLang: navigator.language,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed");
      setTranslated({
        title: data.translations[0] ?? p.title,
        subtitle: p.subtitle ? data.translations[1] ?? p.subtitle : null,
        body: p.body ? data.translations[2] ?? p.body : null,
      });
    } catch (e) {
      setError(e instanceof Error && e.message !== "failed" ? e.message : "Couldn't translate this post.");
    }
    setBusy(false);
  }

  const textHidden = playingId !== null;

  return (
    <div>
      <div
        ref={cardRef}
        className={cn(
          "group relative w-full overflow-hidden bg-[#14110d]",
          hasMedia ? "aspect-[4/5] sm:aspect-[4/3]" : "aspect-[5/4] sm:aspect-[16/10]"
        )}
      >
        {hasMedia ? (
          <div ref={trackRef} onScroll={onScroll} className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto">
            {p.media.map((m, i) => (
              <div key={m.id} className="relative h-full w-full shrink-0 snap-center overflow-hidden">
                {m.type === "video" ? (
                  <>
                    <video
                      src={`${m.url}#t=0.1`}
                      preload="metadata"
                      playsInline
                      controls={playingId === m.id}
                      onPause={() => setPlayingId(null)}
                      onEnded={() => setPlayingId(null)}
                      className="h-full w-full bg-black object-cover"
                    />
                    {playingId !== m.id && (
                      <button
                        type="button"
                        aria-label="Play video"
                        onClick={(e) => playVideo(m.id, e)}
                        className="absolute left-1/2 top-1/2 z-20 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white ring-1 ring-white/40 backdrop-blur-md transition-transform hover:scale-105"
                      >
                        <Play size={26} className="translate-x-0.5 fill-white" />
                      </button>
                    )}
                  </>
                ) : (
                  <Link href={p.href} aria-label={p.title} className="block h-full w-full">
                    <Image
                      src={m.url}
                      alt={m.alt}
                      fill
                      priority={p.priority && i === 0}
                      sizes="(min-width: 640px) 672px, 100vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                      style={{
                        objectPosition: focalPosition({
                          focal_x: m.focalX ?? null,
                          focal_y: m.focalY ?? null,
                        }),
                      }}
                    />
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Link
            href={p.href}
            aria-label={p.title}
            className="absolute inset-0 block"
            style={{
              backgroundImage: `linear-gradient(135deg, ${p.gradient[0]} 0%, ${p.gradient[1]} 100%)`,
            }}
          >
            <span className="absolute inset-0 bg-black/25" aria-hidden />
            <span className="absolute -right-6 -top-4 select-none text-[10rem] leading-none opacity-30 sm:text-[13rem]" aria-hidden>
              {p.kind === "country" ? p.flag : TypeIcon ? <TypeIcon size={200} strokeWidth={1.25} className="text-white" /> : null}
            </span>
          </Link>
        )}

        {/* Scrims — top for the poster row, bottom for the story */}
        <div
          className={cn("pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 to-transparent", p.track ? "h-40" : "h-28")}
          aria-hidden
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300",
            textHidden && "opacity-0"
          )}
          aria-hidden
        />

        {/* Poster */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-4">
          <div className="flex items-center gap-2.5">
            <Link
              href={`/u/${p.actor.username}`}
              aria-label={p.actor.display_name}
              className="pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 font-serif text-sm text-white ring-2 ring-white/70"
            >
              {p.actor.avatar_url ? (
                <Image src={p.actor.avatar_url} alt="" width={36} height={36} className="h-full w-full object-cover" />
              ) : (
                p.actor.display_name.charAt(0)
              )}
            </Link>
            <div className="min-w-0 leading-tight text-white drop-shadow">
              <Link href={`/u/${p.actor.username}`} className="pointer-events-auto text-sm font-semibold hover:underline">
                {p.actor.display_name}
              </Link>
              <p className="text-xs text-white/75">
                {p.actionLabel} · {p.when}
              </p>
            </div>
            {p.media.length > 1 && (
              <span className="ml-auto rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                {active + 1}/{p.media.length}
              </span>
            )}
          </div>
          {p.track && (
            <div className="mt-3 flex">
              <MusicSticker musicKey={musicKey} track={p.track} preview={preview} />
            </div>
          )}
        </div>

        {/* The memory itself */}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 z-10 p-5 text-white transition-opacity duration-300 sm:p-6",
            textHidden && "opacity-0"
          )}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium ring-1 ring-white/25 backdrop-blur-md">
            {p.kind === "country" ? (
              <>
                <span aria-hidden>{p.flag}</span> {p.countryName ?? "Country"}
              </>
            ) : (
              <>
                {TypeIcon && <TypeIcon size={13} aria-hidden />} {typeMeta?.label}
              </>
            )}
          </span>
          <h3 className="mt-3 font-serif text-3xl leading-[1.08] drop-shadow-md sm:text-4xl">{shownTitle}</h3>
          {shownSubtitle && <p className="mt-1 font-serif text-lg italic text-white/85">{shownSubtitle}</p>}
          {shownBody && <p className="mt-2 line-clamp-2 max-w-md text-sm leading-relaxed text-white/85">{shownBody}</p>}
          {(p.dateLabel || p.location) && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/80">
              {p.dateLabel && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={14} aria-hidden /> {p.dateLabel}
                </span>
              )}
              {p.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} aria-hidden /> {p.location}
                </span>
              )}
            </div>
          )}
          {p.media.length > 1 && (
            <div className="mt-4 flex gap-1.5" aria-hidden>
              {p.media.map((m, i) => (
                <span key={m.id} className={cn("h-1 rounded-full transition-all", i === active ? "w-5 bg-white" : "w-1.5 bg-white/45")} />
              ))}
            </div>
          )}
        </div>

        {p.media.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => scrollToIndex(Math.max(0, active - 1))}
              disabled={active === 0}
              className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-black/35 p-2 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/55 group-hover:opacity-100 disabled:!opacity-0 sm:block"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => scrollToIndex(Math.min(p.media.length - 1, active + 1))}
              disabled={active === p.media.length - 1}
              className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-black/35 p-2 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/55 group-hover:opacity-100 disabled:!opacity-0 sm:block"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-5">{p.actions}</div>
        <button
          type="button"
          onClick={toggleTranslate}
          disabled={busy}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-accent disabled:opacity-50"
        >
          <Languages size={12} aria-hidden />
          {busy ? "Translating…" : translated ? "Show original" : "Translate"}
        </button>
      </div>
      {error && (
        <p role="alert" className="px-4 pb-2 text-xs text-red-800 dark:text-red-400 sm:px-5">
          {error}
        </p>
      )}
    </div>
  );
}

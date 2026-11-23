"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Images, MapPin, Sparkles } from "lucide-react";
import { StoryShareButton } from "./StoryShareButton";
import { focalPosition } from "@/lib/media";
import { eventTypeMeta } from "@/lib/events";
import type { StockPhoto } from "@/lib/stockPhotos";
import { StockImage } from "./StockImage";
import { StockCredit } from "./StockCredit";
import type { EventType } from "@/lib/types";

export type ThenPhoto = { id: string; url: string; focalX: number | null; focalY: number | null };

export type ThenMemory = {
  /** The event's or country's own id (what the Story image is made from). */
  id: string;
  /** For a country: which of its trips this memory is (its photos are only that trip's). */
  visitId?: string | null;
  href: string;
  eyebrow: string;
  kind: "event" | "country";
  eventType: EventType | null;
  flag?: string;
  title: string;
  dateLabel: string | null;
  place: string | null;
  /** The viewer's own words about it — review, highlight or trip memory. */
  words: string | null;
  /** Images only, cover first. */
  photos: ThenPhoto[];
  /** Used when there are no photos (e.g. a concert's Spotify artist image). */
  fallbackImage: string | null;
  /** A country with no photos yet: an Unsplash photo of it, credited. */
  stock?: StockPhoto | null;
  gradient: [string, string];
};

const MAX_PHOTOS = 20;
const MAX_DOTS = 9;

// Your own memory, brought back, as a small celebration: that trip's (or
// that event's) photos to swipe through, each drifting slowly (nothing laid
// over them, so no face is hidden); a glowing "when" above your words, the
// dates, place and how many photos; and Share to Story, which shares the
// photo you're on (see StoryShareButton).
export function ThenCard({ m, shareable = false }: { m: ThenMemory; shareable?: boolean }) {
  const photos = m.photos.slice(0, MAX_PHOTOS);
  const [index, setIndex] = useState(0);
  const strip = useRef<HTMLDivElement>(null);
  const TypeIcon = m.kind === "event" ? eventTypeMeta(m.eventType ?? "concert").icon : null;
  const current = photos[index] ?? null;

  function go(to: number) {
    const el = strip.current;
    if (!el) return;
    el.scrollTo({ left: Math.max(0, Math.min(photos.length - 1, to)) * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="card group mt-4 overflow-hidden shadow-[0_24px_50px_-30px_rgba(43,11,46,0.55)] transition-shadow hover:shadow-lg">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#14110d] sm:aspect-[16/9]">
        {photos.length > 0 ? (
          <>
            {/* That trip's photos: swipe through, each drifting slowly */}
            <div
              ref={strip}
              onScroll={(e) => {
                const el = e.currentTarget;
                const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
                if (i !== index) setIndex(i);
              }}
              className="no-scrollbar absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
              aria-label={`${m.title}: ${photos.length} ${photos.length === 1 ? "photo" : "photos"}`}
            >
              {photos.map((p, i) => (
                <div key={p.id} className="relative h-full w-full shrink-0 snap-center overflow-hidden" aria-hidden={i !== index}>
                  <div className={`absolute inset-0 ${i === index ? "animate-ken-burns" : ""}`}>
                    <Image
                      src={p.url}
                      alt=""
                      fill
                      sizes="(min-width: 640px) 672px, 100vw"
                      className="object-cover"
                      style={{ objectPosition: focalPosition({ focal_x: p.focalX, focal_y: p.focalY }) }}
                      priority={i === 0}
                      loading={i < 2 ? "eager" : "lazy"}
                    />
                  </div>
                </div>
              ))}
            </div>
            {photos.length > 1 && (
              <>
                <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-xs font-semibold tabular-nums text-white backdrop-blur-sm">
                  {index + 1} / {photos.length}
                </span>
                {/* Where you are: dots (a few, then just the counter) */}
                {photos.length <= MAX_DOTS && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden>
                    {photos.map((p, i) => (
                      <span key={p.id} className={`h-1.5 rounded-full bg-white shadow transition-all duration-300 ${i === index ? "w-5 opacity-100" : "w-1.5 opacity-60"}`} />
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => go(index - 1)}
                  disabled={index === 0}
                  aria-label="Previous photo"
                  className="absolute left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 disabled:hidden sm:flex"
                >
                  <ChevronLeft size={18} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => go(index + 1)}
                  disabled={index === photos.length - 1}
                  aria-label="Next photo"
                  className="absolute right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 disabled:hidden sm:flex"
                >
                  <ChevronRight size={18} aria-hidden />
                </button>
              </>
            )}
          </>
        ) : m.fallbackImage ? (
          <div className="absolute inset-0 animate-ken-burns">
            <Image src={m.fallbackImage} alt="" fill sizes="(min-width: 640px) 672px, 100vw" className="object-cover" />
          </div>
        ) : m.stock ? (
          <>
            <div className="absolute inset-0 animate-ken-burns" style={{ backgroundColor: m.stock.color }}>
              <StockImage photo={m.stock} aspect="4:3" sizes="(min-width: 640px) 672px, 100vw" />
            </div>
            <StockCredit photo={m.stock} linked={false} corner className="absolute bottom-2.5 right-3" />
          </>
        ) : (
          <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(135deg, ${m.gradient[0]} 0%, ${m.gradient[1]} 100%)` }}>
            <span className="absolute inset-0 bg-black/25" aria-hidden />
            <span className="absolute -right-4 -top-6 select-none text-[9rem] leading-none opacity-30" aria-hidden>
              {m.kind === "country" ? m.flag : TypeIcon && <TypeIcon size={170} strokeWidth={1.25} className="text-white" />}
            </span>
          </div>
        )}
      </div>

      <Link href={m.href} className="block px-5 pb-1 pt-4 sm:px-6">
        {m.eyebrow && (
          <p className="relative inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-gradient-to-r from-[#fa51a2] to-[#fb7822] px-3 py-1 text-xs font-semibold text-white shadow-[0_6px_16px_-8px_rgba(250,81,162,0.9)]">
            <span aria-hidden className="animate-badge-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent" />
            <Sparkles size={12} aria-hidden /> {m.eyebrow}
          </p>
        )}
        <h3 className="mt-2 font-serif text-3xl leading-tight transition-colors group-hover:text-accent sm:text-4xl">
          {m.flag && (
            <span className="mr-2 text-[0.8em]" aria-hidden>
              {m.flag}
            </span>
          )}
          {m.title}
        </h3>
        {photos.length === 0 && !m.fallbackImage && <p className="mt-1.5 text-sm font-medium text-accent">No photos yet. Add a few so it&rsquo;s never forgotten →</p>}
        {m.words && <p className="mt-1.5 line-clamp-2 max-w-lg font-serif text-base italic leading-snug text-muted">&ldquo;{m.words}&rdquo;</p>}
        {(m.dateLabel || m.place || m.photos.length > 1) && (
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            {m.dateLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-raised px-2.5 py-1 text-ink/80">
                <CalendarDays size={13} className="text-accent" aria-hidden /> {m.dateLabel}
              </span>
            )}
            {m.place && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-raised px-2.5 py-1 text-ink/80">
                <MapPin size={13} className="text-accent" aria-hidden /> {m.place}
              </span>
            )}
            {m.photos.length > 1 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-raised px-2.5 py-1 text-ink/80">
                <Images size={13} className="text-accent" aria-hidden /> {m.photos.length} photos
              </span>
            )}
          </div>
        )}
      </Link>

      <div className="flex items-start gap-2 px-5 pb-5 pt-4 sm:px-6">
        {shareable && <StoryShareButton kind={m.kind} id={m.id} visitId={m.visitId ?? null} photoId={current?.id ?? null} eyebrow={m.eyebrow} title={m.title} />}
        <Link
          href={m.href}
          className={`inline-flex items-center justify-center gap-1.5 rounded-full border border-line px-4 py-3 text-sm font-semibold transition-colors hover:border-accent hover:text-accent ${shareable ? "" : "w-full"}`}
        >
          Relive it <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

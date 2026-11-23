import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Images, MapPin, Sparkles } from "lucide-react";
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

const EXTRA_THUMBS = 3;

// Your own memory, brought back, as a small celebration: the photo carries
// it (nothing laid over it, so no one's face is hidden), drifting slowly;
// a glowing "when" above your words, the places and how many photos; and a
// way to share it to your Story (see StoryShareButton).
export function ThenCard({ m, shareable = false }: { m: ThenMemory; shareable?: boolean }) {
  const hero = m.photos[0] ?? null;
  const extras = m.photos.slice(1, 1 + EXTRA_THUMBS);
  const more = m.photos.length - 1 - extras.length;
  const TypeIcon = m.kind === "event" ? eventTypeMeta(m.eventType ?? "concert").icon : null;
  const hasPicture = !!(hero || m.fallbackImage);

  return (
    <div className="card group mt-4 overflow-hidden shadow-[0_24px_50px_-30px_rgba(43,11,46,0.55)] transition-shadow hover:shadow-lg">
      <Link href={m.href} className="block">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#14110d] sm:aspect-[16/9]">
          {/* The photo, drifting slowly closer and back */}
          <div className={`absolute inset-0 ${hasPicture ? "animate-ken-burns" : ""}`}>
            {hero ? (
              <Image
                src={hero.url}
                alt=""
                fill
                sizes="(min-width: 640px) 672px, 100vw"
                className="object-cover"
                style={{ objectPosition: focalPosition({ focal_x: hero.focalX, focal_y: hero.focalY }) }}
              />
            ) : m.fallbackImage ? (
              <Image src={m.fallbackImage} alt="" fill sizes="(min-width: 640px) 672px, 100vw" className="object-cover" />
            ) : m.stock ? (
              <div className="absolute inset-0" style={{ backgroundColor: m.stock.color }}>
                <StockImage photo={m.stock} aspect="4:3" sizes="(min-width: 640px) 672px, 100vw" />
              </div>
            ) : (
              <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(135deg, ${m.gradient[0]} 0%, ${m.gradient[1]} 100%)` }}>
                <span className="absolute inset-0 bg-black/25" aria-hidden />
                <span className="absolute -right-4 -top-6 select-none text-[9rem] leading-none opacity-30" aria-hidden>
                  {m.kind === "country" ? m.flag : TypeIcon && <TypeIcon size={170} strokeWidth={1.25} className="text-white" />}
                </span>
              </div>
            )}
          </div>
          {!hero && !m.fallbackImage && m.stock && <StockCredit photo={m.stock} linked={false} corner className="absolute bottom-2.5 right-3" />}

          {extras.length > 0 && <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent" aria-hidden />}
          {extras.length > 0 && (
            <div className="absolute right-4 top-4 flex -space-x-3" aria-hidden>
              {extras.map((p, i) => (
                <span
                  key={p.id}
                  className="relative h-11 w-11 overflow-hidden rounded-lg shadow-md ring-2 ring-white/90 transition-transform duration-300 group-hover:-translate-y-0.5"
                  style={{ transform: `rotate(${(i - (extras.length - 1) / 2) * 7}deg)` }}
                >
                  <Image src={p.url} alt="" fill sizes="44px" className="object-cover" />
                </span>
              ))}
              {more > 0 && (
                <span className="relative flex h-11 w-11 items-center justify-center rounded-lg bg-black/55 text-xs font-semibold text-white ring-2 ring-white/90 backdrop-blur-sm">
                  +{more}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="px-5 pb-1 pt-4 sm:px-6">
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
          {m.photos.length === 0 && !m.fallbackImage && <p className="mt-1.5 text-sm font-medium text-accent">No photos yet. Add a few so it&rsquo;s never forgotten →</p>}
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
        </div>
      </Link>

      <div className="flex items-start gap-2 px-5 pb-5 pt-4 sm:px-6">
        {shareable && <StoryShareButton kind={m.kind} id={m.id} eyebrow={m.eyebrow} title={m.title} />}
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

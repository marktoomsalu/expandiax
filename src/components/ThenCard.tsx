import Image from "next/image";
import Link from "next/link";
import { CalendarDays, History, MapPin } from "lucide-react";
import { focalPosition } from "@/lib/media";
import { eventTypeMeta } from "@/lib/events";
import type { EventType } from "@/lib/types";

export type ThenPhoto = { id: string; url: string; focalX: number | null; focalY: number | null };

export type ThenMemory = {
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
  gradient: [string, string];
};

const EXTRA_THUMBS = 3;

// Your own memory, brought back: the photo carries it, your words sit on
// top, and a small fan of the other photos hints there's more inside.
export function ThenCard({ m }: { m: ThenMemory }) {
  const hero = m.photos[0] ?? null;
  const extras = m.photos.slice(1, 1 + EXTRA_THUMBS);
  const more = m.photos.length - 1 - extras.length;
  const TypeIcon = m.kind === "event" ? eventTypeMeta(m.eventType ?? "concert").icon : null;

  return (
    <Link href={m.href} className="card group mt-4 block overflow-hidden transition-shadow hover:shadow-lg">
      <div className="relative aspect-[4/3] w-full bg-[#14110d] sm:aspect-[16/9]">
        {hero ? (
          <Image
            src={hero.url}
            alt=""
            fill
            sizes="(min-width: 640px) 672px, 100vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            style={{ objectPosition: focalPosition({ focal_x: hero.focalX, focal_y: hero.focalY }) }}
          />
        ) : m.fallbackImage ? (
          <Image
            src={m.fallbackImage}
            alt=""
            fill
            sizes="(min-width: 640px) 672px, 100vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(135deg, ${m.gradient[0]} 0%, ${m.gradient[1]} 100%)` }}>
            <span className="absolute inset-0 bg-black/25" aria-hidden />
            <span className="absolute -right-4 -top-6 select-none text-[9rem] leading-none opacity-30" aria-hidden>
              {m.kind === "country" ? m.flag : TypeIcon && <TypeIcon size={170} strokeWidth={1.25} className="text-white" />}
            </span>
          </div>
        )}

        {extras.length > 0 && <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent" aria-hidden />}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" aria-hidden />

        {extras.length > 0 && (
          <div className="absolute right-4 top-4 flex -space-x-3" aria-hidden>
            {extras.map((p, i) => (
              <span
                key={p.id}
                className="relative h-11 w-11 overflow-hidden rounded-lg ring-2 ring-white/85 shadow-md"
                style={{ transform: `rotate(${(i - (extras.length - 1) / 2) * 6}deg)` }}
              >
                <Image src={p.url} alt="" fill sizes="44px" className="object-cover" />
              </span>
            ))}
            {more > 0 && (
              <span className="relative flex h-11 w-11 items-center justify-center rounded-lg bg-black/55 text-xs font-semibold text-white ring-2 ring-white/85 backdrop-blur-sm">
                +{more}
              </span>
            )}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium ring-1 ring-white/25 backdrop-blur-md">
            <History size={13} aria-hidden /> {m.eyebrow}
          </span>
          <h3 className="font-serif text-2xl leading-tight drop-shadow-md sm:text-3xl">
            {m.flag && (
              <span className="mr-2 text-[0.8em]" aria-hidden>
                {m.flag}
              </span>
            )}
            {m.title}
          </h3>
          {m.words && <p className="mt-2 line-clamp-2 max-w-lg font-serif text-base italic leading-snug text-white/90">&ldquo;{m.words}&rdquo;</p>}
          {(m.dateLabel || m.place) && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/80">
              {m.dateLabel && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={14} aria-hidden /> {m.dateLabel}
                </span>
              )}
              {m.place && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} aria-hidden /> {m.place}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

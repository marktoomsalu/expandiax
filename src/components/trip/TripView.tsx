import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CalendarDays, ChevronRight, Home, MapPin, MessageSquareText, Pencil, Plus } from "lucide-react";
import type { Country } from "@/lib/countries";
import { stockPhotoFor } from "@/lib/stockPhotos";
import { describeDays } from "@/lib/photoDates";
import { tripTitle } from "@/lib/tripTitle";
import { daysBetween, mediaByPlace, orderStops, shortDays, tripName } from "@/lib/tripPlaces";
import { QueuedMedia } from "@/components/UploadQueue";
import { PlacesMap } from "@/components/PlacesMap";
import { PhotoGallery } from "@/components/PhotoGallery";
import { SpotifyEmbed } from "@/components/SpotifyEmbed";
import { StockCredit } from "@/components/StockCredit";
import { StockImage } from "@/components/StockImage";
import { LikeButton } from "@/components/LikeButton";
import { CommentSection } from "@/components/CommentSection";
import { TripPlaceCards } from "./TripPlaceCards";
import type { CommentWithAuthor, CountryCity, CountryMedia, CountryVisit } from "@/lib/types";

export type TripVisit = CountryVisit & {
  visited_countries: { id: string; user_id: string; country_code: string };
  country_media: CountryMedia[];
  country_cities: CountryCity[];
};

/**
 * One trip (or stay), top to bottom: the cover and when; the words and the
 * song; every photo and video in the order they were arranged (tap for full
 * screen); the cities and regions (tap one for its own photos); the map;
 * likes and comments; and the way to all their trips in that country.
 * Its owner also gets a floating Edit, and while the trip is still empty a
 * big "Add memory to this trip". Used by the owner's My World and by
 * anyone's /u/<name>/trips/<id>.
 */
export function TripView({
  visit,
  meta,
  owner,
  country,
  created = false,
  social = null,
}: {
  visit: TripVisit;
  meta: Country;
  owner: boolean;
  /** Where all their trips in this country are: the back pill ("All trips to Italy") and the closing button. */
  country: { href: string; label: string; allTrips: string };
  created?: boolean;
  social?: { liked: boolean; comments: CommentWithAuthor[] } | null;
}) {
  const base = `/my-world/${meta.code.toLowerCase()}/visits/${visit.id}`;
  const stops = orderStops(visit.country_cities);
  const coverId = visit.cover_media_id ?? null;
  // In the order they were arranged in, the cover first (as when editing).
  const media = [...visit.country_media].sort((a, b) => (a.id === coverId ? -1 : b.id === coverId ? 1 : a.display_order - b.display_order));
  const images = media.filter((m) => m.media_type === "image");
  const photos = images.length;
  const perPlace = mediaByPlace(stops, media);
  const cover = images.find((m) => m.id === coverId) ?? images[0];
  const stock = cover ? null : stockPhotoFor(meta.code, visit.id);
  const name = tripName(visit, meta.name, stops.map((s) => s.city_name));
  const when = visit.date_precision === "day" && visit.visited_from ? describeDays(visit.visited_from, visit.visited_to ?? visit.visited_from) : tripTitle(visit).headline;
  const days = visit.date_precision === "day" && visit.visited_from ? daysBetween(visit.visited_from, visit.visited_to ?? visit.visited_from) : null;
  const mapped = stops.filter((s) => s.lat != null && s.lng != null);
  const lived = visit.kind === "lived";
  const noun = lived ? "stay" : "trip";
  const words = visit.highlight.trim();
  const empty = !words && media.length === 0;
  const viewerItem = (m: CountryMedia) => ({ id: m.id, url: m.public_url, alt: m.caption || "", type: m.media_type === "video" ? ("video" as const) : ("image" as const) });

  return (
    <div>
      {/* Edit, always in reach: it floats just under the header while you scroll. */}
      {owner && (
        <div className="pointer-events-none fixed inset-x-0 z-30 mx-auto flex max-w-3xl justify-end px-5" style={{ top: "calc(env(safe-area-inset-top) + 57px + 20px)" }}>
          <Link
            href={`${base}/edit`}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-sm text-white shadow-md shadow-black/20 ring-1 ring-white/15 backdrop-blur-md hover:bg-black/55"
          >
            <Pencil size={14} /> Edit
          </Link>
        </div>
      )}

      {/* Hero */}
      <div className="relative -mt-px h-[56vh] max-h-[520px] min-h-[360px] w-full overflow-hidden bg-[#14110d]">
        {cover ? (
          <Image src={cover.public_url} alt="" fill priority sizes="100vw" className="object-cover" />
        ) : stock ? (
          <StockImage photo={stock} alt={stock.alt} priority sizes="100vw" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/25" aria-hidden />
        <div className="absolute inset-x-0 top-0 mx-auto flex max-w-3xl items-center px-5 pt-5">
          <Link href={country.href} className="inline-flex max-w-[70%] items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-sm text-white backdrop-blur hover:bg-black/50">
            <ArrowLeft size={15} className="shrink-0" /> <span className="truncate">{country.label}</span>
          </Link>
        </div>
        {stock && (
          <span className="absolute bottom-3 right-4 max-w-[62%] rounded-2xl bg-black/35 px-2.5 py-1 text-right backdrop-blur-sm">
            <StockCredit photo={stock} />
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-3xl px-5 pb-6 text-white">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/75">
            {lived ? <Home size={13} aria-hidden /> : <span aria-hidden>{meta.flag}</span>} {lived ? "Lived here" : `${meta.name} trip`}
          </p>
          <h1 className="mt-2 font-serif text-4xl leading-tight drop-shadow-md sm:text-5xl">{name}</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-white/85">
            <CalendarDays size={15} aria-hidden /> {when}
          </p>
          <p className="mt-1 text-sm text-white/75">
            {[stops.length ? `${stops.length} ${stops.length === 1 ? "place" : "places"}` : null, days ? `${days} ${days === 1 ? "day" : "days"}` : null, photos ? `${photos} ${photos === 1 ? "photo" : "photos"}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 pb-16 pt-6">
        {owner && created && (
          <p role="status" className="mb-5 rounded-2xl border border-accent/40 bg-accent-soft/50 px-4 py-3 text-sm">
            Added to your map. Add places, photos and the story whenever you like -{" "}
            <Link href={`${base}/edit`} className="font-medium text-accent hover:underline">
              edit the {noun}
            </Link>
            .
          </p>
        )}

        {owner && <QueuedMedia parentId={visit.id} />}

        {/* Nothing written and no photos yet: one clear way to start. */}
        {owner && empty && (
          <Link href={`${base}/edit`} className="mt-2 flex items-center gap-4 rounded-2xl bg-accent px-5 py-5 text-white shadow-lg shadow-accent/25 transition-transform active:scale-[0.99]">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20">
              <Plus size={24} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-serif text-xl">Add memory to this {noun}</span>
              <span className="block text-sm text-white/85">Photos, videos, the story and the song.</span>
            </span>
            <ChevronRight size={20} className="shrink-0 text-white/80" aria-hidden />
          </Link>
        )}

        {/* The trip's own words and song */}
        {(words || visit.spotify_track_id) && (
          <section className="mt-6 space-y-3" aria-label="Memory">
            {words && (
              <blockquote className="flex gap-3 rounded-2xl border border-line bg-surface p-4 font-serif text-lg italic leading-relaxed">
                <MessageSquareText size={20} className="mt-1 shrink-0 text-accent" aria-hidden />
                <span className="whitespace-pre-line">&ldquo;{words}&rdquo;</span>
              </blockquote>
            )}
            {visit.spotify_track_id && <SpotifyEmbed trackId={visit.spotify_track_id} compact />}
          </section>
        )}

        {/* Every photo and video, in the order they were arranged */}
        {media.length > 0 && (
          <section className="mt-8" aria-labelledby="media-h">
            <h2 id="media-h" className="font-serif text-2xl">
              Photos &amp; videos
            </h2>
            <PhotoGallery
              photos={media.map(viewerItem)}
              gridClassName="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4"
              itemClassName="relative aspect-square overflow-hidden rounded-lg bg-raised"
              sizes="(min-width: 640px) 180px, 33vw"
            />
          </section>
        )}

        {/* Cities, towns and regions */}
        {(stops.length > 0 || owner) && (
          <section className="mt-8" aria-labelledby="places-h">
            <div className="flex items-center justify-between gap-3">
              <h2 id="places-h" className="font-serif text-2xl">
                Cities &amp; regions visited
              </h2>
              {owner && (
                <Link href={`${base}/edit#places`} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent hover:underline">
                  <Plus size={16} aria-hidden /> Add place
                </Link>
              )}
            </div>
            {stops.length === 0 ? (
              <Link href={`${base}/edit#places`} className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-4 text-sm text-muted hover:border-accent">
                <MapPin size={18} className="shrink-0 text-accent" aria-hidden /> Add the cities, towns and regions you went to - they&rsquo;ll show up here, in order and on a map.
              </Link>
            ) : (
              <>
                <p className="mt-0.5 text-sm text-muted">The cities, towns and regions of this {noun}, in order. Tap one to see its photos.</p>
                <TripPlaceCards
                  places={stops.map((s) => {
                    const own = perPlace.get(s.id) ?? [];
                    return {
                      id: s.id,
                      name: s.city_name,
                      range: shortDays(s.arrived, s.departed),
                      items: own.map(viewerItem),
                      stock: own.some((m) => m.media_type === "image") ? null : stockPhotoFor(meta.code, s.id),
                    };
                  })}
                />
              </>
            )}
          </section>
        )}

        {mapped.length > 0 && (
          <section id="map" className="mt-8 scroll-mt-24" aria-labelledby="map-h">
            <h2 id="map-h" className="mb-3 font-serif text-2xl">
              On the map
            </h2>
            <PlacesMap
              route={mapped.length > 1}
              points={mapped.map((s) => ({ id: s.id, name: s.city_name, lat: s.lat!, lng: s.lng!, label: shortDays(s.arrived, s.departed) ?? undefined }))}
            />
          </section>
        )}

        {/* Likes and comments (kept for the country, shown on each of its trips). */}
        {social && (
          <section className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface" aria-label="Likes and comments">
            <div className="px-4 py-3 sm:px-5">
              <LikeButton kind="country" targetId={visit.visited_countries.id} initialLiked={social.liked} />
            </div>
            <div className="border-t border-line px-4 py-3 sm:px-5">
              <CommentSection kind="country" targetId={visit.visited_countries.id} posterId={visit.visited_countries.user_id} initialComments={social.comments} />
            </div>
          </section>
        )}

        {/* Everything else of theirs in this country. */}
        <Link href={country.href} className="mt-8 flex items-center gap-4 rounded-2xl border border-line bg-surface px-5 py-4 transition-colors hover:border-accent">
          <span className="text-3xl" aria-hidden>
            {meta.flag}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-serif text-lg">{country.allTrips}</span>
            <span className="block text-xs text-muted">Every trip and stay there, with places and photos</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

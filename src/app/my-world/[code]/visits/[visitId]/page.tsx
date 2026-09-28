import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Car, ChevronRight, Home, Image as ImageIcon, MapPin, MessageSquareText, Pencil, Plus, Video } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { signMedia } from "@/lib/signedMedia";
import { stockPhotoFor } from "@/lib/stockPhotos";
import { describeDays } from "@/lib/photoDates";
import { tripTitle } from "@/lib/tripTitle";
import { dayLabel, daysBetween, formatKm, journeyLegs, mediaByPlace, orderStops, shortDays, tripName } from "@/lib/tripPlaces";
import { QueuedMedia } from "@/components/UploadQueue";
import { PlacesMap } from "@/components/PlacesMap";
import { SpotifyEmbed } from "@/components/SpotifyEmbed";
import { StockCredit } from "@/components/StockCredit";
import { StockImage } from "@/components/StockImage";
import type { CountryCity, CountryMedia, CountryVisit } from "@/lib/types";

type VisitRow = CountryVisit & {
  visited_countries: { id: string; user_id: string; country_code: string };
  country_media: CountryMedia[];
  country_cities: CountryCity[];
};

export const metadata = { title: "Trip" };

const chip = "inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm shadow-sm";

/** One trip (or stay): where you went, in order, with its photos and a map. */
export default async function VisitPage({ params, searchParams }: { params: { code: string; visitId: string }; searchParams: { created?: string } }) {
  const meta = countryByCode(params.code);
  if (!meta) notFound();
  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");

  const { data } = await signMedia(
    await supabase
      .from("country_visits")
      .select("*, visited_countries!inner(id, user_id, country_code), country_media!country_media_country_visit_id_fkey(*), country_cities(*)")
      .eq("id", params.visitId)
      .eq("visited_countries.user_id", user.id)
      .eq("visited_countries.country_code", meta.code)
      .maybeSingle()
  );
  if (!data) notFound();
  const visit = data as VisitRow;

  const base = `/my-world/${meta.code.toLowerCase()}/visits/${visit.id}`;
  const stops = orderStops(visit.country_cities);
  const media = [...visit.country_media].sort((a, b) => a.display_order - b.display_order);
  const images = media.filter((m) => m.media_type === "image");
  const photos = images.length;
  const videos = media.length - photos;
  const perPlace = mediaByPlace(stops, media);
  const cover = images.find((m) => m.id === visit.cover_media_id) ?? images[0];
  const stock = cover ? null : stockPhotoFor(meta.code, visit.id);
  const name = tripName(visit, meta.name, stops.map((s) => s.city_name));
  const when = visit.date_precision === "day" && visit.visited_from ? describeDays(visit.visited_from, visit.visited_to ?? visit.visited_from) : tripTitle(visit).headline;
  const days = visit.date_precision === "day" && visit.visited_from ? daysBetween(visit.visited_from, visit.visited_to ?? visit.visited_from) : null;
  const legs = journeyLegs(stops);
  const mapped = stops.filter((s) => s.lat != null && s.lng != null);
  const lived = visit.kind === "lived";

  return (
    <div>
      {/* Hero */}
      <div className="relative -mt-px h-[56vh] max-h-[520px] min-h-[360px] w-full overflow-hidden bg-[#14110d]">
        {cover ? (
          <Image src={cover.public_url} alt="" fill priority sizes="100vw" className="object-cover" />
        ) : stock ? (
          <StockImage photo={stock} alt={stock.alt} priority sizes="100vw" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/25" aria-hidden />
        <div className="absolute inset-x-0 top-0 mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 pt-5">
          <Link href={`/my-world/${meta.code.toLowerCase()}`} className="inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-sm text-white backdrop-blur hover:bg-black/50">
            <ArrowLeft size={15} /> {meta.flag} {meta.name}
          </Link>
          <Link href={`${base}/edit`} className="inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-sm text-white backdrop-blur hover:bg-black/50">
            <Pencil size={14} /> Edit
          </Link>
        </div>
        {stock && (
          <span className="absolute bottom-3 right-4 rounded-full bg-black/35 px-2.5 py-1 backdrop-blur-sm">
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
            {[stops.length ? `${stops.length} ${stops.length === 1 ? "place" : "places"}` : null, days ? `${days} ${days === 1 ? "day" : "days"}` : null, `${photos} ${photos === 1 ? "photo" : "photos"}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 pb-16 pt-6">
        {searchParams.created && (
          <p role="status" className="mb-5 rounded-2xl border border-accent/40 bg-accent-soft/50 px-4 py-3 text-sm">
            Added to your map. Add places, photos and the story whenever you like -{" "}
            <Link href={`${base}/edit`} className="font-medium text-accent hover:underline">
              edit the trip
            </Link>
            .
          </p>
        )}

        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          <span className={chip}>
            <ImageIcon size={16} className="text-accent" aria-hidden /> {photos} photos
          </span>
          <span className={chip}>
            <Video size={16} className="text-accent" aria-hidden /> {videos} videos
          </span>
          <span className={chip}>
            <MapPin size={16} className="text-accent" aria-hidden /> {stops.length} places
          </span>
          {days && (
            <span className={chip}>
              <CalendarDays size={16} className="text-accent" aria-hidden /> {days} days
            </span>
          )}
        </div>

        <QueuedMedia parentId={visit.id} className="mt-6" />

        {/* Places */}
        <section className="mt-8" aria-labelledby="places-h">
          <div className="flex items-center justify-between gap-3">
            <h2 id="places-h" className="font-serif text-2xl">
              Places in this {lived ? "stay" : "trip"}
            </h2>
            <Link href={`${base}/edit#places`} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
              <Plus size={16} aria-hidden /> Add place
            </Link>
          </div>
          {stops.length === 0 ? (
            <Link href={`${base}/edit#places`} className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-4 text-sm text-muted hover:border-accent">
              <MapPin size={18} className="text-accent" aria-hidden /> Add the places you went - they&rsquo;ll show up here, in order and on a map.
            </Link>
          ) : (
            <ul className="no-scrollbar -mx-5 mt-3 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
              {stops.map((s) => {
                const own = perPlace.get(s.id) ?? [];
                const pic = own.find((m) => m.media_type === "image");
                const placeStock = pic ? null : stockPhotoFor(meta.code, s.id);
                const range = shortDays(s.arrived, s.departed);
                return (
                  <li key={s.id} className="w-44 shrink-0 snap-start sm:w-52">
                    <a href={`#place-${s.id}`} className="group relative block h-44 overflow-hidden rounded-2xl bg-[#14110d] shadow-sm ring-1 ring-black/5">
                      {pic ? (
                        <Image src={pic.public_url} alt="" fill sizes="208px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : placeStock ? (
                        <StockImage photo={placeStock} aspect="1:1" sizes="208px" className="opacity-80" />
                      ) : null}
                      <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" aria-hidden />
                      <span className="absolute inset-x-0 bottom-0 p-3 text-white">
                        <span className="block truncate font-serif text-lg leading-tight">{s.city_name}</span>
                        {range && <span className="block text-xs text-white/80">{range}</span>}
                        <span className="mt-1 flex items-center gap-1 text-xs text-white/80">
                          <ImageIcon size={12} aria-hidden /> {own.length}
                        </span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Journey */}
        {stops.length >= 2 && (
          <section className="mt-8" aria-labelledby="journey-h">
            <div className="flex items-center justify-between gap-3">
              <h2 id="journey-h" className="font-serif text-2xl">
                Journey
              </h2>
              {mapped.length > 0 && (
                <a href="#map" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                  <MapPin size={16} aria-hidden /> View on map
                </a>
              )}
            </div>
            <ol className="no-scrollbar -mx-5 mt-4 flex items-start overflow-x-auto px-5 pb-2">
              {stops.map((s, i) => {
                const pic = (perPlace.get(s.id) ?? []).find((m) => m.media_type === "image");
                const label = dayLabel(visit.visited_from, s.arrived, s.departed) ?? shortDays(s.arrived, s.departed);
                const leg = legs[i];
                return (
                  <li key={s.id} className="flex shrink-0 items-start">
                    <div className="flex w-24 flex-col items-center text-center">
                      <span className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-accent-soft ring-2 ring-accent">
                        {pic ? (
                          <Image src={pic.public_url} alt="" fill sizes="64px" className="object-cover" />
                        ) : (
                          <span className="font-serif text-lg text-accent">{i + 1}</span>
                        )}
                      </span>
                      {label && <span className="mt-2 text-[11px] text-muted">{label}</span>}
                      <span className="mt-0.5 line-clamp-2 text-sm font-medium leading-tight">{s.city_name}</span>
                    </div>
                    {leg && (
                      <div className="mt-6 flex w-16 flex-col items-center sm:w-24">
                        <span className="flex items-center gap-1 text-[11px] text-muted">
                          <Car size={12} aria-hidden /> {leg.km != null ? formatKm(leg.km) : ""}
                        </span>
                        <span className="mt-1 h-0 w-full border-t-2 border-dashed border-accent/60" aria-hidden />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {mapped.length > 0 && (
          <section id="map" className="mt-6 scroll-mt-24" aria-label="Map">
            <PlacesMap
              route={mapped.length > 1}
              points={mapped.map((s) => ({ id: s.id, name: s.city_name, lat: s.lat!, lng: s.lng!, label: shortDays(s.arrived, s.departed) ?? undefined }))}
            />
          </section>
        )}

        {/* The trip's own words and song */}
        {(visit.highlight.trim() || visit.spotify_track_id) && (
          <section className="mt-8 space-y-3" aria-label="Memory">
            {visit.highlight.trim() && (
              <blockquote className="flex gap-3 rounded-2xl border border-line bg-surface p-4 font-serif text-lg italic leading-relaxed">
                <MessageSquareText size={20} className="mt-1 shrink-0 text-accent" aria-hidden />
                <span>&ldquo;{visit.highlight.trim()}&rdquo;</span>
              </blockquote>
            )}
            {visit.spotify_track_id && <SpotifyEmbed trackId={visit.spotify_track_id} compact />}
          </section>
        )}

        {/* Memories by place */}
        {media.length > 0 && (
          <section className="mt-8" aria-labelledby="memories-h">
            <h2 id="memories-h" className="font-serif text-2xl">
              {stops.length ? "Memories by place" : "Memories"}
            </h2>
            <div className="mt-3 space-y-5">
              {(stops.length ? stops.map((s) => ({ id: s.id, name: s.city_name, items: perPlace.get(s.id) ?? [] })) : [{ id: "all", name: "", items: media }])
                .concat(
                  stops.length > 1
                    ? [{ id: "other", name: "Other photos", items: media.filter((m) => !m.city_id || !stops.some((s) => s.id === m.city_id)) }]
                    : []
                )
                .filter((g) => g.items.length > 0)
                .map((g) => (
                  <div key={g.id} id={`place-${g.id}`} className="scroll-mt-24">
                    {g.name && (
                      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                        <MapPin size={15} className="text-accent" aria-hidden /> {g.name}
                        <span className="text-xs font-normal text-muted">· {g.items.length}</span>
                      </p>
                    )}
                    <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                      {g.items.map((m) => (
                        <li key={m.id} className="relative aspect-square overflow-hidden rounded-lg bg-raised">
                          {m.media_type === "image" ? (
                            <Image src={m.public_url} alt={m.caption || ""} fill sizes="(min-width: 640px) 180px, 33vw" className="object-cover" />
                          ) : (
                            <video src={`${m.public_url}#t=0.1`} preload="metadata" controls playsInline className="h-full w-full bg-black object-cover" />
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          </section>
        )}

        <Link
          href={`${base}/edit#photos`}
          className="mt-8 flex items-center gap-4 rounded-2xl border border-dashed border-accent/60 bg-accent-soft/30 px-5 py-4 transition-colors hover:border-accent"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent/60 text-accent">
            <Plus size={20} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-serif text-lg">Add memory to this {lived ? "stay" : "trip"}</span>
            <span className="block text-xs text-muted">Photos, videos, places, the story and the song.</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

import type { createClient } from "@/lib/supabase/server";
import { signMedia } from "@/lib/signedMedia";
import { formatVisitRange, visitSortKey } from "@/lib/utils";
import type { CountryMedia, CountryVisit, FeedEvent } from "@/lib/types";
import type { FeedMediaItem } from "@/components/FeedMemoryCard";

// Trips one at a time: each trip (or stay) with its own dates, photos and
// words, newest first by when it happened. A country you've been to three
// times is three trips, not one post mixing them. Likes and comments are the
// country's (that's where they're kept), shown on each of its trips.

type Supabase = ReturnType<typeof createClient>;

export type TripCountry = { id: string; user_id: string; country_code: string; country_name: string; created_at: string; cover_media_id: string | null };
export type Trip = { visit: CountryVisit; country: TripCountry; media: CountryMedia[] };

/** This trip's photos and videos, its cover first, then in order. */
function tripMedia(visit: CountryVisit, country: TripCountry, all: CountryMedia[]) {
  const own = all.filter((m) => m.country_visit_id === visit.id);
  const coverId = visit.cover_media_id ?? (own.some((m) => m.id === country.cover_media_id) ? country.cover_media_id : null);
  return [...own].sort((a, b) => (a.id === coverId ? -1 : b.id === coverId ? 1 : a.display_order - b.display_order));
}

/** Every trip in these countries (as the profile loads them), newest first. */
export function tripsOf(countries: (TripCountry & { country_visits: CountryVisit[]; country_media: CountryMedia[] })[]): Trip[] {
  return countries
    .flatMap((c) => c.country_visits.map((visit) => ({ visit, country: c, media: tripMedia(visit, c, c.country_media) })))
    .sort((a, b) => visitSortKey(b.visit).localeCompare(visitSortKey(a.visit)));
}

/** One trip, if the viewer may see it. */
export async function loadTrip(supabase: Supabase, visitId: string): Promise<Trip | null> {
  const { data } = await signMedia(
    await supabase
      .from("country_visits")
      .select("*, visited_countries!inner(id, user_id, country_code, country_name, created_at, cover_media_id, country_media!country_media_visited_country_id_fkey(*))")
      .eq("id", visitId)
      .maybeSingle()
  );
  if (!data) return null;
  const { visited_countries: vc, ...visit } = data as CountryVisit & { visited_countries: TripCountry & { country_media: CountryMedia[] } };
  if (!vc) return null;
  const { country_media, ...country } = vc;
  return { visit: visit as CountryVisit, country, media: tripMedia(visit as CountryVisit, country, country_media ?? []) };
}

/** A trip as a post card: the country's post (for likes and comments), with this trip's own dates, words and photos. */
export function tripAsPost(t: Trip): { item: FeedEvent; media: FeedMediaItem[]; dateLabel: string; actionLabel: string } {
  const photos = t.media.filter((m) => m.public_url);
  const cover = photos[0] ?? null;
  return {
    item: {
      kind: "country",
      event_type: null,
      ref_id: t.country.id,
      actor_id: t.country.user_id,
      country_code: t.country.country_code,
      country_name: t.country.country_name,
      title: t.visit.title?.trim() || t.country.country_name,
      subtitle: null,
      body: t.visit.highlight?.trim() || null,
      venue: null,
      city: null,
      cover_url: cover?.public_url ?? null,
      cover_media_type: cover?.media_type ?? null,
      visit_year: t.visit.year,
      visit_date: t.visit.visited_to ?? t.visit.visited_from,
      visit_date_precision: t.visit.date_precision,
      spotify_track_id: t.visit.spotify_track_id,
      spotify_track_name: t.visit.spotify_track_name,
      spotify_track_artist: t.visit.spotify_track_artist,
      created_at: t.country.created_at,
    },
    media: photos.map((m) => ({ id: m.id, url: m.public_url, type: m.media_type, alt: m.caption || "", focalX: m.focal_x, focalY: m.focal_y })),
    dateLabel: formatVisitRange(t.visit),
    actionLabel: t.visit.kind === "lived" ? "shared a stay" : "shared a trip",
  };
}

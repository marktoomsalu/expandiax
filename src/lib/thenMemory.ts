import type { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { flagGradientColors } from "@/lib/flagColors";
import { formatDate, formatVisitRange } from "@/lib/utils";
import type { ResurfacedMemory } from "@/lib/feedSections";
import type { ThenMemory, ThenPhoto } from "@/components/ThenCard";
import type { DatePrecision, EventType } from "@/lib/types";
import { signMedia } from "@/lib/signedMedia";
import { stockPhotoFor } from "@/lib/stockPhotos";

type MediaRow = { id: string; public_url: string; media_type: "image" | "video"; display_order: number; focal_x: number | null; focal_y: number | null; country_visit_id?: string | null };

function photosCoverFirst(media: MediaRow[], coverId: string | null): ThenPhoto[] {
  return media
    .filter((m) => m.media_type === "image")
    .sort((a, b) => (a.id === coverId ? -1 : b.id === coverId ? 1 : a.display_order - b.display_order))
    .map((m) => ({ id: m.id, url: m.public_url, focalX: m.focal_x, focalY: m.focal_y }));
}

function agoLabel(date: Date, now: Date): string {
  const months = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  if (months >= 12) {
    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? "" : "s"} ago`;
  }
  return months <= 1 ? "Last month" : `${months} months ago`;
}

/** Everything the THEN card shows, for the one memory pickResurfacedMemory chose. */
export async function loadThenMemory(
  supabase: ReturnType<typeof createClient>,
  picked: ResurfacedMemory,
  now: Date,
  userId = "",
  /** A country's trip to show, when it's already known (the Story picture: the same trip as the card). */
  visitId?: string | null
): Promise<ThenMemory | null> {
  // The section is already called "One to remember" — the card just says when.
  const eyebrow = (date: Date | null) => (picked.isAnniversary ? picked.subtitle : date ? agoLabel(date, now) : "");

  if (picked.kind === "event") {
    const { data } = await signMedia(await supabase
      .from("events")
      .select(
        "title, event_type, event_date, venue, city, country_code, country_name, review, highlight, spotify_artist_image, cover_media_id, event_media!event_media_event_id_fkey(id, public_url, media_type, display_order, focal_x, focal_y)"
      )
      .eq("id", picked.id)
      .maybeSingle());
    if (!data) return null;
    const e = data as unknown as {
      title: string;
      event_type: EventType;
      event_date: string;
      venue: string;
      city: string;
      country_code: string;
      country_name: string;
      review: string;
      highlight: string;
      spotify_artist_image: string | null;
      cover_media_id: string | null;
      event_media: MediaRow[];
    };
    return {
      id: picked.id,
      href: picked.href,
      eyebrow: eyebrow(new Date(`${e.event_date}T00:00:00`)),
      kind: "event",
      eventType: e.event_type,
      flag: countryByCode(e.country_code)?.flag,
      title: e.title,
      dateLabel: formatDate(e.event_date),
      place: [e.venue, e.city].filter(Boolean).join(", ") || e.country_name || null,
      words: e.review?.trim() || e.highlight?.trim() || null,
      photos: photosCoverFirst(e.event_media, e.cover_media_id),
      fallbackImage: e.spotify_artist_image,
      gradient: flagGradientColors(e.country_code),
    };
  }

  const { data } = await signMedia(await supabase
    .from("visited_countries")
    .select(
      "country_code, country_name, cover_media_id, country_media!country_media_visited_country_id_fkey(id, public_url, media_type, display_order, focal_x, focal_y, country_visit_id), country_visits(id, year, visited_from, visited_to, date_precision, highlight)"
    )
    .eq("id", picked.id)
    .maybeSingle());
  if (!data) return null;
  const c = data as unknown as {
    country_code: string;
    country_name: string;
    cover_media_id: string | null;
    country_media: MediaRow[];
    country_visits: { id: string; year: number; visited_from: string | null; visited_to: string | null; date_precision: DatePrecision; highlight: string }[];
  };
  const sortKey = (v: (typeof c.country_visits)[number]) => v.visited_to ?? v.visited_from ?? `${v.year}-07-01`;
  const visits = [...c.country_visits].sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  const photosOf = (v: (typeof visits)[number]) => c.country_media.filter((m) => m.country_visit_id === v.id && m.media_type === "image").length;
  // Which trip this memory is: the one whose day it is (an anniversary), or the latest with photos, or the latest.
  const sameDay = (v: (typeof visits)[number]) => {
    if (v.date_precision !== "day" || !(v.visited_to ?? v.visited_from)) return false;
    const d = new Date(`${v.visited_to ?? v.visited_from}T00:00:00`);
    return d.getDate() === now.getDate() && (/year/.test(picked.subtitle) && !/month/.test(picked.subtitle) ? d.getMonth() === now.getMonth() : true);
  };
  const latest =
    (visitId && visits.find((v) => v.id === visitId)) ||
    (picked.isAnniversary && visits.find(sameDay)) ||
    visits.find((v) => photosOf(v) > 0) ||
    visits[0];
  // Only that trip's photos: never another trip to the same country.
  const tripMedia = latest ? c.country_media.filter((m) => m.country_visit_id === latest.id) : c.country_media;
  const meta = countryByCode(c.country_code);
  return {
    visitId: latest?.id ?? null,
    id: picked.id,
    href: picked.href,
    eyebrow: eyebrow(latest ? new Date(`${sortKey(latest)}T00:00:00`) : null),
    kind: "country",
    eventType: null,
    flag: meta?.flag,
    title: c.country_name,
    // About this one trip (not how many there were).
    dateLabel: latest ? formatVisitRange(latest) : null,
    place: null,
    words: latest?.highlight?.trim() || null,
    photos: photosCoverFirst(tripMedia, c.cover_media_id),
    fallbackImage: null,
    // No photos of this trip yet: the same Unsplash photo of the country as its posts show.
    stock: tripMedia.some((m) => m.media_type === "image") ? null : stockPhotoFor(c.country_code, userId),
    gradient: flagGradientColors(c.country_code),
  };
}

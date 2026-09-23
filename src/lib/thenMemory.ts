import type { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { flagGradientColors } from "@/lib/flagColors";
import { formatDate, formatVisitRange } from "@/lib/utils";
import type { ResurfacedMemory } from "@/lib/feedSections";
import type { ThenMemory, ThenPhoto } from "@/components/ThenCard";
import type { DatePrecision, EventType } from "@/lib/types";

type MediaRow = { id: string; public_url: string; media_type: "image" | "video"; display_order: number; focal_x: number | null; focal_y: number | null };

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
export async function loadThenMemory(supabase: ReturnType<typeof createClient>, picked: ResurfacedMemory, now: Date): Promise<ThenMemory | null> {
  const eyebrow = (date: Date | null) => (picked.isAnniversary ? picked.subtitle : date ? `One to remember · ${agoLabel(date, now)}` : "One to remember");

  if (picked.kind === "event") {
    const { data } = await supabase
      .from("events")
      .select(
        "title, event_type, event_date, venue, city, country_code, country_name, review, highlight, spotify_artist_image, cover_media_id, event_media!event_media_event_id_fkey(id, public_url, media_type, display_order, focal_x, focal_y)"
      )
      .eq("id", picked.id)
      .maybeSingle();
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

  const { data } = await supabase
    .from("visited_countries")
    .select(
      "country_code, country_name, cover_media_id, country_media!country_media_visited_country_id_fkey(id, public_url, media_type, display_order, focal_x, focal_y), country_visits(year, visited_from, visited_to, date_precision, highlight)"
    )
    .eq("id", picked.id)
    .maybeSingle();
  if (!data) return null;
  const c = data as unknown as {
    country_code: string;
    country_name: string;
    cover_media_id: string | null;
    country_media: MediaRow[];
    country_visits: { year: number; visited_from: string | null; visited_to: string | null; date_precision: DatePrecision; highlight: string }[];
  };
  const sortKey = (v: (typeof c.country_visits)[number]) => v.visited_to ?? v.visited_from ?? `${v.year}-07-01`;
  const visits = [...c.country_visits].sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  const latest = visits[0];
  const meta = countryByCode(c.country_code);
  return {
    href: picked.href,
    eyebrow: eyebrow(latest ? new Date(`${sortKey(latest)}T00:00:00`) : null),
    kind: "country",
    eventType: null,
    flag: meta?.flag,
    title: c.country_name,
    dateLabel: latest ? `${formatVisitRange(latest)}${visits.length > 1 ? ` · ${visits.length} trips` : ""}` : null,
    place: null,
    words: visits.find((v) => v.highlight?.trim())?.highlight.trim() ?? null,
    photos: photosCoverFirst(c.country_media, c.cover_media_id),
    fallbackImage: null,
    gradient: flagGradientColors(c.country_code),
  };
}

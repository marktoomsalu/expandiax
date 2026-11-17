import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signMedia } from "@/lib/signedMedia";
import { countryByCode } from "@/lib/countries";
import { tripTitle } from "@/lib/tripTitle";
import { formatDate } from "@/lib/utils";
import type { CountryVisit } from "@/lib/types";

/** What an invitation shows: the trip's or event's cover (blurred where it's shown), name, when and where. */
export type InvitePreview = { cover: string | null; title: string; when: string; place: string; photos: number; flag: string };

type Media = { id: string; public_url: string; media_type: "image" | "video"; display_order: number };

/**
 * The preview of a trip or event someone was added to, read with `supabase`
 * (the invited person's own session, or the service role for a link opened
 * by someone not signed in). `lifetimeDays`: how long the cover's link lasts
 * (link previews in other apps are fetched later).
 */
export async function invitePreview(supabase: SupabaseClient, kind: "trip" | "event", id: string, lifetimeDays?: number): Promise<InvitePreview | null> {
  if (kind === "trip") {
    const { data: v } = await supabase
      .from("country_visits")
      .select("*, visited_countries!inner(country_code, country_name), country_media!country_media_country_visit_id_fkey(id, public_url, media_type, display_order)")
      .eq("id", id)
      .maybeSingle();
    if (!v) return null;
    const vc = (Array.isArray(v.visited_countries) ? v.visited_countries[0] : v.visited_countries) as { country_code: string; country_name: string };
    const images = ((v.country_media ?? []) as Media[]).filter((m) => m.media_type === "image").sort((a, b) => a.display_order - b.display_order);
    const cover = images.find((m) => m.id === v.cover_media_id) ?? images[0];
    return {
      cover: cover ? await signMedia(cover.public_url, { lifetimeDays }) : null,
      title: (v.title as string)?.trim() || `${vc.country_name} ${v.year}`,
      when: tripTitle(v as CountryVisit).headline,
      place: vc.country_name,
      photos: images.length,
      flag: countryByCode(vc.country_code)?.flag ?? "",
    };
  }
  const { data: e } = await supabase
    .from("events")
    .select("title, event_date, venue, city, country_code, country_name, cover_media_id, spotify_artist_image, event_media!event_media_event_id_fkey(id, public_url, media_type, display_order)")
    .eq("id", id)
    .maybeSingle();
  if (!e) return null;
  const images = ((e.event_media ?? []) as Media[]).filter((m) => m.media_type === "image").sort((a, b) => a.display_order - b.display_order);
  const cover = images.find((m) => m.id === e.cover_media_id) ?? images[0];
  return {
    cover: cover ? await signMedia(cover.public_url, { lifetimeDays }) : ((e.spotify_artist_image as string | null) ?? null),
    title: e.title as string,
    when: formatDate(e.event_date as string),
    place: [e.venue, e.city || e.country_name].filter(Boolean).join(", "),
    photos: images.length,
    flag: countryByCode(e.country_code as string)?.flag ?? "",
  };
}

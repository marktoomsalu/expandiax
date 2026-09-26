import { artistKey, type NearbyEvent, type SeenArtist } from "@/lib/concerts";
import type { CarouselCard } from "@/components/EventCarousel";

/** Nearby events as cards: artists you've seen live first (and marked), otherwise soonest first. */
export function nearbyCards(events: NearbyEvent[], seenArtists: SeenArtist[]): CarouselCard[] {
  const seen = new Set(seenArtists.map((a) => artistKey(a.name)));
  const seenLive = (e: NearbyEvent) => e.performers.some((p) => seen.has(artistKey(p)));
  const ordered = [...events.filter(seenLive), ...events.filter((e) => !seenLive(e))];
  return ordered.map((e) => ({
    id: e.id,
    title: e.name,
    date: e.date,
    time: e.time,
    venue: e.venue,
    city: e.city,
    countryCode: e.countryCode,
    url: e.url,
    image: e.image,
    category: e.category,
    priceFrom: e.priceFrom,
    moreDates: e.moreDates,
    badge: seenLive(e) ? "You’ve seen them live" : null,
  }));
}

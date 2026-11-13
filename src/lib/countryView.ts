import { orderCountryMedia } from "./mediaOrder";
import { audienceOf } from "./audience";
import { stockPhotoFor } from "./stockPhotos";
import { visitSortKey } from "./utils";
import { orderStops, placesInCountry, stayLength, stayMonth, stayWhen, tripName } from "./tripPlaces";
import type { StayView } from "@/components/StayRow";
import type { VisitedCountryFull } from "./types";

/** "Kotor", "Kotor & Budva", "Kotor, Budva & Perast", "Kotor, Budva & 3 more". */
export function listCities(cities: string[]): string {
  if (cities.length <= 1) return cities[0] ?? "";
  if (cities.length <= 3) return `${cities.slice(0, -1).join(", ")} & ${cities[cities.length - 1]}`;
  return `${cities.slice(0, 2).join(", ")} & ${cities.length - 2} more`;
}

/**
 * Everything a country page shows about someone's time there: their stays
 * and trips for the timeline (newest first), the places they've been, and
 * the country's picture. Used for your own country page and for the same
 * page as others see it.
 */
export function buildCountryView(visited: VisitedCountryFull, meta: { code: string; name: string }) {
  const visits = [...visited.country_visits].sort((a, b) => visitSortKey(b).localeCompare(visitSortKey(a)));
  const images = visited.country_media.filter((m) => m.media_type === "image").sort((a, b) => a.display_order - b.display_order);
  const tripCover = (visitId: string, coverId: string | null) => {
    const own = images.filter((m) => m.country_visit_id === visitId);
    return own.find((m) => m.id === coverId) ?? own[0];
  };
  // The country's picture: the one chosen, else the latest trip's (the same order as the My World card).
  const heroPhoto = orderCountryMedia(images, visits, visited.cover_media_id)[0];
  const cities = visited.country_cities ?? [];
  const trips: StayView[] = visits.map((v) => {
    const media = visited.country_media.filter((m) => m.country_visit_id === v.id);
    const cover = tripCover(v.id, v.cover_media_id);
    const stops = orderStops(cities.filter((c) => c.country_visit_id === v.id)).map((c) => c.city_name);
    return {
      id: v.id,
      name: tripName(v, meta.name, stops),
      kind: v.kind,
      places: stops.length ? listCities(stops) : v.highlight.trim() || null,
      when: stayWhen(v),
      length: stayLength(v),
      // Every row says when: the month (when known) over the year, "Jul / 2024".
      railTop: stayMonth(v),
      railBottom: String(v.year),
      photos: media.filter((m) => m.media_type === "image").length,
      audience: audienceOf(v.audience ?? (v.is_public === false ? "only_me" : "everyone")),
      photo: cover?.public_url ?? null,
      // Different stock photo per trip, so an empty country doesn't repeat one picture.
      stock: cover ? null : stockPhotoFor(meta.code, v.id),
      mediaPaths: media.map((m) => m.storage_path),
    };
  });
  const places = placesInCountry(visits, cities, visited.country_media);
  return { visits, cities, heroPhoto, trips, places };
}

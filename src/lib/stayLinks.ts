import type { SupabaseClient } from "@supabase/supabase-js";
import { stayDuring, tripsDuring } from "./stays";
import { tripName } from "./tripPlaces";
import { tripTitle } from "./tripTitle";
import type { CountryVisit } from "./types";

export type StayLink = { id: string; href: string; name: string; when: string };

type Sibling = Pick<CountryVisit, "id" | "kind" | "title" | "year" | "visited_from" | "visited_to" | "date_precision" | "is_current">;

/**
 * For one trip or stay: the time living there it belongs to (a trip), or
 * the trips taken while living there (a stay). Read as the viewer, so only
 * what they may see is linked.
 */
export async function stayLinks(
  supabase: SupabaseClient,
  visit: { id: string; kind: string | null; visited_from: string | null; visited_country_id: string },
  country: string,
  hrefFor: (id: string) => string
): Promise<{ duringStay: StayLink | null; tripsDuring: StayLink[] }> {
  const { data } = await supabase
    .from("country_visits")
    .select("id, kind, title, year, visited_from, visited_to, date_precision, is_current")
    .eq("visited_country_id", visit.visited_country_id);
  const all = (data ?? []) as Sibling[];
  const link = (v: Sibling): StayLink => ({ id: v.id, href: hrefFor(v.id), name: tripName(v, country), when: tripTitle(v).headline });
  const self = all.find((v) => v.id === visit.id);
  if (!self) return { duringStay: null, tripsDuring: [] };
  const stay = stayDuring(self, all);
  const trips = tripsDuring(self, all).sort((a, b) => (a.visited_from ?? "").localeCompare(b.visited_from ?? ""));
  return { duringStay: stay ? link(stay) : null, tripsDuring: trips.map(link) };
}

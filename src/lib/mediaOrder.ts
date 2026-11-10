import { visitSortKey } from "./utils";

type Media = { id: string; country_visit_id: string | null; display_order: number };
type Visit = { id: string; year: number; visited_from: string | null; visited_to: string | null; cover_media_id?: string | null };

/**
 * A country's photos in the order they're shown (the My World card swipes
 * through them; the first is the country's picture everywhere):
 *  1. the cover you chose for the country, if you did;
 *  2. then trip by trip, newest first (a stay where you lived counts the
 *     same), each starting with that trip's cover;
 *  3. then anything not tied to a trip.
 * Within each group, the order you put them in.
 */
export function orderCountryMedia<T extends Media>(media: T[], visits: Visit[], countryCoverId: string | null | undefined): T[] {
  const byOrder = [...media].sort((a, b) => a.display_order - b.display_order);
  const out: T[] = [];
  const seen = new Set<string>();
  const add = (m: T | undefined) => {
    if (m && !seen.has(m.id)) {
      seen.add(m.id);
      out.push(m);
    }
  };

  add(byOrder.find((m) => m.id === countryCoverId));
  const newestFirst = [...visits].sort((a, b) => visitSortKey(b).localeCompare(visitSortKey(a)));
  for (const v of newestFirst) {
    const own = byOrder.filter((m) => m.country_visit_id === v.id);
    add(own.find((m) => m.id === v.cover_media_id));
    own.forEach(add);
  }
  byOrder.forEach(add);
  return out;
}

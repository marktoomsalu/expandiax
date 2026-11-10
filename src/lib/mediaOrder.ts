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

type Placed = { id: string; order: number; takenAt: string | null };
type Incoming = { key: string; takenAt: string | null };

/**
 * Where new photos go among the ones already there: by when they were
 * taken. The ones already there keep the order they're in (it may be one
 * you arranged by hand); each new photo slots in before the first one
 * taken after it, and new photos without a date go at the end. Returns the
 * whole list in its new order.
 */
export function placeByTime(existing: Placed[], incoming: Incoming[]): { id: string; isNew: boolean }[] {
  const list: { id: string; isNew: boolean; takenAt: string | null }[] = [...existing]
    .sort((a, b) => a.order - b.order)
    .map((e) => ({ id: e.id, isNew: false, takenAt: e.takenAt }));
  const dated = incoming.filter((i) => i.takenAt).sort((a, b) => a.takenAt!.localeCompare(b.takenAt!));
  for (const n of dated) {
    const at = list.findIndex((x) => x.takenAt && x.takenAt > n.takenAt!);
    const item = { id: n.key, isNew: true, takenAt: n.takenAt };
    if (at === -1) list.push(item);
    else list.splice(at, 0, item);
  }
  for (const n of incoming.filter((i) => !i.takenAt)) list.push({ id: n.key, isNew: true, takenAt: null });
  return list.map(({ id, isNew }) => ({ id, isNew }));
}

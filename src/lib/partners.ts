// Booking a place you dream of, through partners who pay ExpandiaX a small
// commission — plain links, nothing loaded into the app, nothing about the
// person shared. Each partner switches on when its ID is set:
//   GETYOURGUIDE_PARTNER_ID                 — tours, tickets, things to do
//   BOOKING_AID                             — Booking.com's own affiliate programme
//   AWIN_AFFILIATE_ID + BOOKING_AWIN_MID    — or Booking.com through Awin

const enc = encodeURIComponent;

/** "Things to do in Barcelona" on GetYourGuide, credited to our partner ID. */
export function thingsToDoUrl(place: string, env = process.env): string | null {
  const id = env.GETYOURGUIDE_PARTNER_ID?.trim();
  if (!id || !place.trim()) return null;
  return `https://www.getyourguide.com/s/?q=${enc(place.trim())}&partner_id=${enc(id)}&cmp=expandiax`;
}

/** Places to stay in Barcelona on Booking.com — directly, or through Awin. */
export function staysUrl(place: string, env = process.env): string | null {
  if (!place.trim()) return null;
  const aid = env.BOOKING_AID?.trim();
  const search = (extra = "") => `https://www.booking.com/searchresults.html?ss=${enc(place.trim())}${extra}`;
  if (aid) return search(`&aid=${enc(aid)}`);
  const affid = env.AWIN_AFFILIATE_ID?.trim();
  const mid = env.BOOKING_AWIN_MID?.trim();
  if (affid && mid) return `https://www.awin1.com/cread.php?awinmid=${enc(mid)}&awinaffid=${enc(affid)}&ued=${enc(search())}`;
  return null;
}

export type TripLink = { kind: "stays" | "things"; label: string; url: string };

/** The partner links for a place, in the order they're shown. */
export function tripLinks(place: string, env = process.env): TripLink[] {
  const out: TripLink[] = [];
  const stays = staysUrl(place, env);
  if (stays) out.push({ kind: "stays", label: "Stays", url: stays });
  const things = thingsToDoUrl(place, env);
  if (things) out.push({ kind: "things", label: "Things to do", url: things });
  return out;
}

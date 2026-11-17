import type { SupabaseClient } from "@supabase/supabase-js";
import { sameEvent, tripOverlap, tripRange, type TogetherEvent } from "./together";
import { formatDate } from "./utils";
import type { DatePrecision } from "./types";

// "Anna was also in Portugal 13 – 15 Aug. Were you together?" — who to
// suggest in "Who was with you?": people you follow who logged the same
// country at overlapping dates (a trip), or the same concert or game (an
// event). Only what they chose to log, and only what you may see.

export type Companion = { id: string; username: string; display_name: string; avatar_url: string | null; reason: string };

const EVENT_FIELDS = "id, user_id, title, event_type, event_date, venue, city, country_code, country_name, spotify_artist_id, spotify_artist_name";
const span = (from: string, to: string) =>
  from === to ? formatDate(from) : from.slice(0, 7) === to.slice(0, 7) ? `${Number(from.slice(8))}–${formatDate(to)}` : `${formatDate(from)} – ${formatDate(to)}`;

async function followees(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await supabase.from("follows").select("followee_id").eq("follower_id", userId);
  return (data ?? []).map((f) => f.followee_id as string);
}

async function people(supabase: SupabaseClient, reasons: Map<string, string>): Promise<Companion[]> {
  if (!reasons.size) return [];
  const { data } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", [...reasons.keys()]);
  return (data ?? []).map((p) => ({ ...(p as Omit<Companion, "reason">), reason: reasons.get(p.id as string)! }));
}

/** People you follow who were in the same country at the same time as this trip. */
export async function tripCompanions(
  supabase: SupabaseClient,
  userId: string,
  trip: { visited_from: string | null; visited_to: string | null; date_precision: DatePrecision },
  country: { code: string; name: string },
  exclude: string[]
): Promise<Companion[]> {
  const range = tripRange(trip);
  if (!range) return [];
  const ids = (await followees(supabase, userId)).filter((id) => !exclude.includes(id));
  if (!ids.length) return [];
  const { data } = await supabase
    .from("visited_countries")
    .select("user_id, country_code, country_visits(visited_from, visited_to, date_precision)")
    .eq("country_code", country.code)
    .in("user_id", ids.slice(0, 500));
  const mine = { user_id: userId, country_code: country.code, ...range };
  const reasons = new Map<string, string>();
  for (const row of (data ?? []) as { user_id: string; country_code: string; country_visits: { visited_from: string | null; visited_to: string | null; date_precision: DatePrecision }[] }[]) {
    for (const v of row.country_visits ?? []) {
      const r = tripRange(v);
      const overlap = r && tripOverlap(mine, { user_id: row.user_id, country_code: row.country_code, ...r });
      if (overlap && !reasons.has(row.user_id)) reasons.set(row.user_id, `was also in ${country.name} ${span(overlap.from, overlap.to)}`);
    }
  }
  return (await people(supabase, reasons)).slice(0, 4);
}

/** People you follow who logged the same concert, festival or game. */
export async function eventCompanions(supabase: SupabaseClient, userId: string, event: TogetherEvent, exclude: string[]): Promise<Companion[]> {
  const ids = (await followees(supabase, userId)).filter((id) => !exclude.includes(id));
  if (!ids.length) return [];
  const day = Date.parse(`${event.event_date}T00:00:00Z`);
  const around = (d: number) => new Date(day + d * 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabase.from("events").select(EVENT_FIELDS).in("user_id", ids.slice(0, 500)).gte("event_date", around(-3)).lte("event_date", around(3));
  const reasons = new Map<string, string>();
  for (const e of (data ?? []) as TogetherEvent[]) {
    if (sameEvent(event, e) && !reasons.has(e.user_id)) reasons.set(e.user_id, `was also at ${event.title}`);
  }
  return (await people(supabase, reasons)).slice(0, 4);
}

/** Friends who logged the same event themselves ("Also there"), apart from the people on it. */
export async function alsoThere(supabase: SupabaseClient, viewerId: string | null, event: TogetherEvent, exclude: string[]): Promise<{ person: Omit<Companion, "reason">; eventId: string }[]> {
  if (!viewerId) return [];
  const ids = [viewerId, ...(await followees(supabase, viewerId))].filter((id) => !exclude.includes(id) && id !== event.user_id);
  if (!ids.length) return [];
  const day = Date.parse(`${event.event_date}T00:00:00Z`);
  const around = (d: number) => new Date(day + d * 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabase.from("events").select(EVENT_FIELDS).in("user_id", ids.slice(0, 500)).gte("event_date", around(-3)).lte("event_date", around(3));
  const found = new Map<string, string>();
  for (const e of (data ?? []) as TogetherEvent[]) if (e.id !== event.id && sameEvent(event, e) && !found.has(e.user_id)) found.set(e.user_id, e.id);
  if (!found.size) return [];
  const { data: ps } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", [...found.keys()]);
  return (ps ?? []).map((p) => ({ person: p as Omit<Companion, "reason">, eventId: found.get(p.id as string)! }));
}

export type OwnMatch = { id: string; label: string };

/**
 * Added to someone's trip or event you've already logged yourself: yours,
 * so it can be linked instead of making a second one (migration 079). A
 * trip matches in the same country when the dates overlap (or, with only a
 * year, the same year); an event when it's the same one.
 */
export async function findOwnMatch(supabase: SupabaseClient, userId: string, kind: "trip" | "event", targetId: string, exclude: string[] = []): Promise<OwnMatch | null> {
  if (kind === "event") {
    const { data: t } = await supabase.from("events").select(EVENT_FIELDS).eq("id", targetId).maybeSingle();
    if (!t) return null;
    const target = t as TogetherEvent;
    const day = Date.parse(`${target.event_date}T00:00:00Z`);
    const around = (d: number) => new Date(day + d * 86_400_000).toISOString().slice(0, 10);
    const { data } = await supabase.from("events").select(EVENT_FIELDS).eq("user_id", userId).gte("event_date", around(-3)).lte("event_date", around(3));
    const mine = ((data ?? []) as TogetherEvent[]).find((e) => e.id !== targetId && !exclude.includes(e.id) && sameEvent(target, e));
    return mine ? { id: mine.id, label: `${mine.title}, ${formatDate(mine.event_date)}` } : null;
  }
  type V = { id: string; title: string; kind: "trip" | "lived"; year: number; visited_from: string | null; visited_to: string | null; date_precision: DatePrecision; is_current?: boolean };
  const { data: t } = await supabase
    .from("country_visits")
    .select("id, title, kind, year, visited_from, visited_to, date_precision, visited_countries!inner(country_code, country_name)")
    .eq("id", targetId)
    .maybeSingle();
  if (!t) return null;
  const vc = (Array.isArray(t.visited_countries) ? t.visited_countries[0] : t.visited_countries) as { country_code: string; country_name: string };
  const { data } = await supabase
    .from("country_visits")
    .select("id, title, kind, year, visited_from, visited_to, date_precision, is_current, visited_countries!inner(user_id, country_code)")
    .eq("visited_countries.user_id", userId)
    .eq("visited_countries.country_code", vc.country_code);
  const target = t as unknown as V;
  const range = tripRange(target);
  const mine = ((data ?? []) as unknown as V[]).filter((v) => v.id !== targetId && !exclude.includes(v.id));
  const hit =
    mine.find((v) => {
      const r = tripRange(v);
      return range && r ? !!tripOverlap({ user_id: "", country_code: vc.country_code, ...range }, { user_id: "", country_code: vc.country_code, ...r }) : v.year === target.year;
    }) ?? null;
  if (!hit) return null;
  const { tripTitle } = await import("./tripTitle");
  const name = hit.title?.trim() || `${vc.country_name} ${hit.kind === "lived" ? "stay" : "trip"}`;
  return { id: hit.id, label: `${name}, ${tripTitle(hit).headline}` };
}

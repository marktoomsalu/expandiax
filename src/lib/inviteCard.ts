import "server-only";
import { createClient } from "@/lib/supabase/server";
import { continentCounts } from "./countries";
import { isTerritoryCode } from "./territories";

/**
 * Who's inviting, as a link preview may show them: their name and photo,
 * and (only what anyone could see on their public profile) the countries
 * and events they've kept. A private profile shows the name and photo only.
 */
export type Inviter = {
  name: string;
  first: string;
  avatar: string | null;
  /** Their public countries, newest first. Empty for a private profile. */
  codes: string[];
  continents: number;
  events: number;
};

export async function loadInviter(username: string): Promise<Inviter | null> {
  const supabase = createClient();
  const { data: p } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, visibility")
    .eq("username", decodeURIComponent(username).toLowerCase())
    .maybeSingle();
  if (!p) return null;
  const name = (p.display_name as string | null)?.trim() || "A friend";
  const base = { name, first: name.split(/\s+/)[0], avatar: (p.avatar_url as string | null) ?? null };
  if (p.visibility === "private") return { ...base, codes: [], continents: 0, events: 0 };

  const [{ data: countries }, { count: events }] = await Promise.all([
    supabase.from("visited_countries").select("country_code").eq("user_id", p.id).eq("is_public", true).order("created_at", { ascending: false }),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("user_id", p.id).eq("is_public", true),
  ]);
  const codes = ((countries ?? []) as { country_code: string }[]).map((c) => c.country_code).filter((c) => !isTerritoryCode(c));
  return { ...base, codes, continents: continentCounts(codes).filter((c) => c.visited > 0).length, events: events ?? 0 };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Mark has kept 12 countries and 8 events on ExpandiaX." (or null with nothing to say). */
export function inviterLine(i: Inviter): string | null {
  const parts = [i.codes.length ? plural(i.codes.length, "country", "countries") : null, i.events ? plural(i.events, "event", "events") : null].filter(Boolean);
  return parts.length ? `${i.first} has kept ${parts.join(" and ")} on ExpandiaX.` : null;
}

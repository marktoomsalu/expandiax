import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const KINDS: Record<string, string[]> = {
  festival: ["festival"],
  sport: ["football", "race", "race_series"],
  conference: ["conference"],
  other: ["festival", "football", "race", "race_series", "conference"],
};

export type KnownEventHit = {
  title: string;
  kind: string;
  startsOn: string | null;
  endsOn: string | null;
  venue: string | null;
  city: string | null;
  countryCode: string | null;
  /** How many members saved it (members' shared events). */
  members?: number;
};

/**
 * Adding an event: real ones by name, from our catalogue (matches,
 * festivals, races, conferences) and events members share, newest first.
 */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  const type = request.nextUrl.searchParams.get("type") ?? "other";
  if (q.length < 2 || !KINDS[type]) return NextResponse.json({ items: [] });

  const supabase = createClient();
  const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const today = new Date();
  const from = new Date(today.getTime() - 8 * 365 * 86_400_000).toISOString().slice(0, 10);
  const to = new Date(today.getTime() + 365 * 86_400_000).toISOString().slice(0, 10);

  const [{ data: catalog }, { data: members }] = await Promise.all([
    supabase
      .from("event_catalog")
      .select("title, kind, starts_on, ends_on, venue, city, country_code")
      .in("kind", KINDS[type])
      .ilike("title", pattern)
      .or(`starts_on.is.null,starts_on.lte.${to}`)
      .order("starts_on", { ascending: false, nullsFirst: false })
      .limit(15),
    supabase.rpc("member_events", { p_from: from, p_to: to, p_q: q }),
  ]);

  const items: KnownEventHit[] = [
    ...((members ?? []) as { title: string; event_type: string; event_date: string; venue: string | null; city: string | null; country_code: string; members: number }[])
      .filter((m) => type === "other" || m.event_type === type)
      .slice(0, 5)
      .map((m) => ({ title: m.title, kind: m.event_type, startsOn: m.event_date, endsOn: null, venue: m.venue, city: m.city, countryCode: m.country_code, members: m.members })),
    ...((catalog ?? []) as { title: string; kind: string; starts_on: string | null; ends_on: string | null; venue: string | null; city: string | null; country_code: string | null }[]).map((c) => ({
      title: c.title,
      kind: c.kind,
      startsOn: c.starts_on,
      endsOn: c.ends_on,
      venue: c.venue,
      city: c.city,
      countryCode: c.country_code,
    })),
  ];
  return NextResponse.json({ items }, { headers: { "Cache-Control": "public, max-age=300" } });
}

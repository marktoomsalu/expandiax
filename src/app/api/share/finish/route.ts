import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { shareUser } from "@/lib/shareTokens";
import { countryByCode } from "@/lib/countries";

export const dynamic = "force-dynamic";

type Item = { path: string; kind: "image" | "video"; takenAt?: string | null };
type NewTrip = { code: string; from: string; to: string; places?: { name: string; lat: number; lng: number }[] };
type Body = { visitId?: string; eventId?: string; newTrip?: NewTrip; items?: Item[]; unused?: string[] };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const today = () => new Date().toISOString().slice(0, 10);

/**
 * "Add": what was shared goes onto the trip (or event), in the order it was taken.
 * A new trip is made first, unless one already covers those days in that
 * country (then it's that one: never two of the same trip). A trip's photo
 * and video limits hold as always; anything past them is taken away again
 * and counted, so the sheet can say so.
 */
export async function POST(request: NextRequest) {
  const userId = await shareUser(request);
  if (!userId) return NextResponse.json({ error: "signed-out" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Body | null;
  const mine = (p: unknown): p is string => typeof p === "string" && p.startsWith(`${userId}/countries/shared-`);
  const items = (body?.items ?? []).filter((i) => mine(i.path) && (i.kind === "image" || i.kind === "video")).slice(0, 60);
  const admin = createAdminClient();
  const bucket = admin.storage.from("media");
  const unused = (body?.unused ?? []).filter(mine);
  if (unused.length) await bucket.remove(unused);
  if (!items.length) return NextResponse.json({ error: "Nothing arrived." }, { status: 400 });

  if (body?.eventId) return addToEvent(userId, body.eventId, items);

  let visitId: string | null = null;
  let countryId: string | null = null;
  let code: string | null = null;
  let created = false;

  if (body?.visitId) {
    const { data } = await admin
      .from("country_visits")
      .select("id, visited_country_id, visited_countries!inner(user_id, country_code)")
      .eq("id", body.visitId)
      .maybeSingle();
    const owner = data?.visited_countries as unknown as { user_id: string; country_code: string } | undefined;
    if (data && owner?.user_id === userId) {
      visitId = data.id as string;
      countryId = data.visited_country_id as string;
      code = owner.country_code;
    }
  } else if (body?.newTrip) {
    const t = body.newTrip;
    const country = countryByCode(t.code);
    if (country && DAY.test(t.from) && DAY.test(t.to) && t.from <= t.to) {
      await admin
        .from("visited_countries")
        .upsert({ user_id: userId, country_code: country.code, country_name: country.name }, { onConflict: "user_id,country_code", ignoreDuplicates: true });
      const { data: vc } = await admin.from("visited_countries").select("id").eq("user_id", userId).eq("country_code", country.code).maybeSingle();
      countryId = (vc?.id as string) ?? null;
      code = country.code;
      if (countryId) {
        // Already there for those days? Then it's that trip.
        const { data: visits } = await admin.from("country_visits").select("id, visited_from, visited_to").eq("visited_country_id", countryId).not("visited_from", "is", null);
        const same = (visits ?? []).find((v) => (v.visited_from as string) <= t.to && ((v.visited_to as string) ?? (v.visited_from as string)) >= t.from);
        if (same) visitId = same.id as string;
        else {
          const { data: visit } = await admin
            .from("country_visits")
            .insert({
              visited_country_id: countryId,
              year: Number(t.from.slice(0, 4)),
              visited_from: t.from,
              visited_to: t.to,
              date_precision: "day",
              kind: days(t.from, t.to) >= 60 ? "lived" : "trip",
              // Fresh from a trip: it goes to followers. An old one fills in the map quietly.
              show_in_feed: days(t.to, today()) <= 30,
            })
            .select("id")
            .single();
          visitId = (visit?.id as string) ?? null;
          created = !!visitId;
          const places = (t.places ?? []).filter((p) => p?.name && Number.isFinite(p.lat) && Number.isFinite(p.lng)).slice(0, 6);
          if (visitId && places.length) {
            await admin.from("country_cities").insert(
              places.map((p, i) => ({ visited_country_id: countryId, country_visit_id: visitId, city_name: p.name.slice(0, 80), position: i, lat: p.lat, lng: p.lng }))
            );
          }
        }
      }
    }
  }

  if (!visitId || !countryId) {
    await bucket.remove(items.map((i) => i.path));
    return NextResponse.json({ error: "That trip isn't there any more." }, { status: 404 });
  }

  const { data: last } = await admin.from("country_media").select("display_order").eq("country_visit_id", visitId).order("display_order", { ascending: false }).limit(1).maybeSingle();
  let order = ((last?.display_order as number | undefined) ?? -1) + 1;
  const sorted = [...items].sort((a, b) => (a.takenAt ?? "").localeCompare(b.takenAt ?? ""));
  let photos = 0;
  let videos = 0;
  const skipped: string[] = [];
  for (const item of sorted) {
    const values: Record<string, string | number> = {
      visited_country_id: countryId,
      country_visit_id: visitId,
      storage_path: item.path,
      public_url: bucket.getPublicUrl(item.path).data.publicUrl,
      media_type: item.kind,
      caption: "",
      display_order: order,
    };
    if (item.takenAt && !Number.isNaN(Date.parse(item.takenAt))) values.taken_at = item.takenAt;
    const { error } = await admin.from("country_media").insert(values);
    if (error) {
      // Past the trip's limit (or the file never arrived): not kept.
      skipped.push(item.path);
      continue;
    }
    order += 1;
    if (item.kind === "video") videos += 1;
    else photos += 1;
  }
  if (skipped.length) await bucket.remove(skipped);

  return NextResponse.json({ visitId, code, created, added: { photos, videos }, skipped: skipped.length });
}

/** Onto an event of theirs: the same, into its photos and videos. */
async function addToEvent(userId: string, eventId: string, items: Item[]) {
  const admin = createAdminClient();
  const bucket = admin.storage.from("media");
  const { data: event } = await admin.from("events").select("id, user_id, title").eq("id", eventId).maybeSingle();
  if (!event || event.user_id !== userId) {
    await bucket.remove(items.map((i) => i.path));
    return NextResponse.json({ error: "That event isn't there any more." }, { status: 404 });
  }
  const { data: last } = await admin.from("event_media").select("display_order").eq("event_id", eventId).order("display_order", { ascending: false }).limit(1).maybeSingle();
  let order = ((last?.display_order as number | undefined) ?? -1) + 1;
  let photos = 0;
  let videos = 0;
  const skipped: string[] = [];
  for (const item of [...items].sort((a, b) => (a.takenAt ?? "").localeCompare(b.takenAt ?? ""))) {
    const values: Record<string, string | number> = {
      event_id: eventId,
      storage_path: item.path,
      public_url: bucket.getPublicUrl(item.path).data.publicUrl,
      media_type: item.kind,
      caption: "",
      display_order: order,
    };
    if (item.takenAt && !Number.isNaN(Date.parse(item.takenAt))) values.taken_at = item.takenAt;
    const { error } = await admin.from("event_media").insert(values);
    if (error) {
      skipped.push(item.path);
      continue;
    }
    order += 1;
    if (item.kind === "video") videos += 1;
    else photos += 1;
  }
  if (skipped.length) await bucket.remove(skipped);
  return NextResponse.json({ eventId, created: false, added: { photos, videos }, skipped: skipped.length });
}

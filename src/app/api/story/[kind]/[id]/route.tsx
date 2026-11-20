import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { signMedia } from "@/lib/signedMedia";
import { continentCounts, countryByCode, TOTAL_COUNTRIES } from "@/lib/countries";
import { isTerritoryCode } from "@/lib/territories";
import { polaroidSticker, stampSticker, stickerDate, worldPoster, worldSticker } from "@/lib/storyImages";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Media = { id: string; public_url: string; media_type: string; display_order: number };

/**
 * Story pictures for Instagram: a trip as a sticker (stamp or polaroid,
 * transparent around it, to paste over any photo), or your whole world
 * (a full Story, or a sticker). Only what the viewer may see; your world is
 * always your own.
 */
export async function GET(request: NextRequest, { params }: { params: { kind: string; id: string } }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const supabase = createClient();
  const style = request.nextUrl.searchParams.get("style");

  if (params.kind === "trip") {
    const { data } = await signMedia(
      await supabase
        .from("country_visits")
        .select("id, year, visited_from, visited_to, date_precision, cover_media_id, visited_countries!inner(country_code), country_media!country_media_country_visit_id_fkey(id, public_url, media_type, display_order)")
        .eq("id", params.id)
        .maybeSingle()
    );
    if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const visit = data as unknown as {
      year: number;
      visited_from: string | null;
      visited_to: string | null;
      date_precision: string | null;
      cover_media_id: string | null;
      visited_countries: { country_code: string };
      country_media: Media[];
    };
    const images = visit.country_media.filter((m) => m.media_type === "image").sort((a, b) => a.display_order - b.display_order);
    const photo = images.find((m) => m.id === visit.cover_media_id) ?? images[0] ?? null;
    const code = visit.visited_countries.country_code;
    const trip = { countryCode: code, place: countryByCode(code)?.name ?? code, when: stickerDate(visit), photo: photo?.public_url ?? null };
    return style === "polaroid" ? polaroidSticker(request.nextUrl.origin, trip) : stampSticker(request.nextUrl.origin, trip);
  }

  if (params.kind === "world") {
    const [{ data: rows }, { data: me }] = await Promise.all([
      supabase.from("visited_countries").select("country_code, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("profiles").select("display_name, username").eq("id", user.id).single(),
    ]);
    const codes = ((rows ?? []) as { country_code: string }[]).map((r) => r.country_code).filter((c) => !isTerritoryCode(c));
    const name = (me?.display_name?.trim() && me.display_name.trim() !== "Traveller" ? me.display_name.trim().split(/\s+/)[0] : `@${me?.username ?? "you"}`) as string;
    const world = {
      name,
      codes,
      continents: continentCounts(codes).filter((c) => c.visited > 0).length,
      percent: Math.round((codes.length / TOTAL_COUNTRIES) * 100),
      year: new Date().getFullYear(),
    };
    return style === "sticker" ? worldSticker(world) : worldPoster(world);
  }

  return NextResponse.json({ error: "Not found." }, { status: 404 });
}

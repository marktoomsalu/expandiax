import type { NextRequest } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { loadThenMemory } from "@/lib/thenMemory";
import { renderMemoryStory } from "@/lib/memoryStory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "One to remember" as an Instagram Story image (see lib/memoryStory). Only for the memory's owner. */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const kind = request.nextUrl.searchParams.get("kind");
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const eyebrow = (request.nextUrl.searchParams.get("eyebrow") ?? "").slice(0, 60);
  // The trip (a country's) and the photo they were looking at in the card.
  const visit = request.nextUrl.searchParams.get("visit");
  const photo = request.nextUrl.searchParams.get("photo");
  if ((kind !== "event" && kind !== "country") || !/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });

  const supabase = createClient();
  const { data: own } = await supabase
    .from(kind === "event" ? "events" : "visited_countries")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (!own) return new Response("Not found", { status: 404 });
  if (own.user_id !== user.id) return new Response("Forbidden", { status: 403 });

  const m = await loadThenMemory(supabase, { kind, id, title: "", subtitle: eyebrow, href: "", isAnniversary: !!eyebrow }, new Date(), user.id, visit && /^[0-9a-f-]{36}$/.test(visit) ? visit : null);
  if (!m) return new Response("Not found", { status: 404 });

  // Only one of this memory's own photos (anything else: its first).
  return renderMemoryStory(m, photo);
}

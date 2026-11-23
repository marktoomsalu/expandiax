import type { NextRequest } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { adminId } from "@/lib/adminAuth";
import { loadWrapped } from "@/lib/wrappedLoad";
import { hasStory, wrappedOpenFor } from "@/lib/wrapped";
import { renderWrappedPoster } from "@/lib/wrappedPoster";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The Wrapped finale as a picture: ?year=2026&format=wide|story&photo=<their photo's id>. Only ever their own year. */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const year = Number(request.nextUrl.searchParams.get("year"));
  if (!Number.isInteger(year) || year < 2000 || year > new Date().getFullYear()) return new Response("Not found", { status: 404 });
  if (!wrappedOpenFor(year) && !(await adminId())) return new Response("Not found", { status: 404 });
  const format = request.nextUrl.searchParams.get("format") === "story" ? "story" : "wide";
  const w = await loadWrapped(createClient(), user.id, year);
  if (!hasStory(w)) return new Response("Not found", { status: 404 });
  return renderWrappedPoster(w, format, request.nextUrl.searchParams.get("photo"));
}

import { NextRequest, NextResponse } from "next/server";
import { fetchSource, SOURCES, upsertCatalog, type SourceName } from "@/lib/eventCatalogSync";
import { loadShapes, makeLocator } from "@/lib/countryLocator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Keeps our event catalogue (migration 087) fresh: one source per run
 * (?source=football …), the last year and what's coming. Everything back to
 * 2019 was loaded once; old events don't change. Vercel Cron, monthly.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}` || !process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }
  const source = request.nextUrl.searchParams.get("source") as SourceName | null;
  if (!source || !SOURCES.includes(source)) return NextResponse.json({ error: `source: ${SOURCES.join(", ")}` }, { status: 400 });

  const origin = request.nextUrl.origin;
  const towns = (cc: string) => fetch(`${origin}/data/places/${cc}.json`).then((r) => (r.ok ? r.json() : []));
  const locate = makeLocator(await loadShapes(`${origin}/data/world-50m.json`));
  const since = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);

  const rows = await fetchSource(source, towns, locate, since);
  const saved = await upsertCatalog(rows, process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  return NextResponse.json({ source, since, saved });
}

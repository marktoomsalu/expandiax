import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { ExploreTeaser } from "@/components/ExploreTeaser";
import { PersonCard } from "@/components/PersonCard";
import { searchPeople } from "@/lib/peopleSearch";
import { SearchBox } from "@/components/feed/FeedTabs";
import { TrendingCard } from "@/components/network/ExploreCards";
import { COUNTRIES } from "@/lib/countries";
import { loadExplore, LIVE_TYPES } from "@/lib/exploreData";
import { trendingLive, type LiveRow, type Trending } from "@/lib/explore";

export const metadata = { title: "Explore" };


const rail = "no-scrollbar -mx-5 mt-4 flex snap-x gap-3 overflow-x-auto scroll-px-5 px-5 pb-2";

/**
 * Explore itself is the feed's Explore tab; this page is where its search
 * lands (people, places, artists), and what signed-out visitors see.
 */
export default async function ExplorePage({ searchParams }: { searchParams?: { q?: string; city?: string; cc?: string; lat?: string; lng?: string } }) {
  const supabase = createClient();
  const q = (searchParams?.q ?? "").trim();
  const viewer = await getAuthUser();

  // Explore is for members. Visitors see what's inside — real artists and
  // places, but never real people — and how to get in.
  if (!viewer) {
    const preview = await loadExplore(supabase, null, null);
    return <ExploreTeaser trending={preview.trending} places={preview.places} />;
  }

  if (!q) {
    const qs = new URLSearchParams({ tab: "explore" });
    for (const k of ["city", "cc", "lat", "lng"] as const) if (searchParams?.[k]) qs.set(k, searchParams[k]!);
    redirect(`/feed?${qs}`);
  }

  // Characters that mean something in a PostgREST filter are dropped from the search text.
  const like = `%${q.replace(/[%_,()*\\:.]/g, " ").trim()}%`;
  // People first, best match first (see searchPeople).
  const [people, { data: liveRows }] = await Promise.all([
    searchPeople(supabase, q, viewer.id),
    supabase
      .from("events")
      .select("id, user_id, event_type, title, spotify_artist_name, spotify_artist_image, event_date")
      .eq("is_public", true)
      .in("event_type", [...LIVE_TYPES])
      .or(`title.ilike.${like},spotify_artist_name.ilike.${like}`)
      .limit(300),
  ]);
  const lower = q.toLowerCase();
  const places = COUNTRIES.filter((c) => c.name.toLowerCase().includes(lower) || c.capital.toLowerCase() === lower).slice(0, 8);
  const live: Trending[] = trendingLive((liveRows ?? []) as LiveRow[], { min: 1, limit: 12 });

  return (
    <div className="mx-auto max-w-2xl px-5 py-6">
      <Link href="/feed?tab=explore" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} aria-hidden /> Explore
      </Link>
      <h1 className="mt-4 text-3xl md:text-4xl">Results for &ldquo;{q}&rdquo;</h1>
      <SearchBox action="/explore" placeholder="Search people, places or artists…" defaultValue={q} />

      <div className="mt-10 space-y-12">
        {people.length === 0 && places.length === 0 && live.length === 0 && <p className="text-sm text-muted">Nothing matches &ldquo;{q}&rdquo; yet.</p>}
        {people.length > 0 && (
          <section aria-labelledby="sr-h">
            <h2 id="sr-h" className="text-2xl">People</h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {people.map((p) => (
                <li key={p.id}>
                  <PersonCard p={p} detail={`@${p.username} · ${p.countries} ${p.countries === 1 ? "country" : "countries"}${p.following ? " · Following" : ""}`} />
                </li>
              ))}
            </ul>
          </section>
        )}
        {places.length > 0 && (
          <section aria-labelledby="sp-h">
            <h2 id="sp-h" className="text-2xl">Places</h2>
            <ul className="mt-4 flex flex-wrap gap-2.5">
              {places.map((c) => (
                <li key={c.code}>
                  <Link href={`/explore/country/${c.code.toLowerCase()}`} className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm hover:border-accent">
                    <span aria-hidden>{c.flag}</span> {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {live.length > 0 && (
          <section aria-labelledby="sl-h">
            <h2 id="sl-h" className="text-2xl">Artists &amp; events</h2>
            <div className={rail}>
              {live.map((t) => (
                <TrendingCard key={t.key} t={t} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

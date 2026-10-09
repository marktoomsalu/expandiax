import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { ExploreTeaser } from "@/components/ExploreTeaser";
import { SearchBox } from "@/components/feed/FeedTabs";
import { TrendingCard } from "@/components/network/ExploreCards";
import { COUNTRIES } from "@/lib/countries";
import { loadExplore, LIVE_TYPES } from "@/lib/exploreData";
import { trendingLive, type LiveRow, type Trending } from "@/lib/explore";
import type { ProfileVisibility } from "@/lib/types";

export const metadata = { title: "Explore" };

type ProfileLite = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  visibility?: ProfileVisibility;
};

function Avatar({ p, size = 48 }: { p: { display_name: string; avatar_url: string | null }; size?: number }) {
  return p.avatar_url ? (
    <Image src={p.avatar_url} alt="" width={size} height={size} className="shrink-0 rounded-full border border-line object-cover" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-full border border-line bg-raised font-serif text-lg text-muted" style={{ width: size, height: size }}>
      {p.display_name.charAt(0)}
    </span>
  );
}

function ProfileCard({ p, detail }: { p: ProfileLite; detail: string }) {
  return (
    <Link href={`/u/${p.username}`} className="card group flex items-center gap-4 px-4 py-4">
      <Avatar p={p} />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 font-serif text-lg group-hover:text-accent">
          {p.display_name}
          {p.visibility && p.visibility !== "public" && <Lock size={13} className="shrink-0 text-muted" aria-label="Private account" />}
        </p>
        <p className="truncate text-xs text-muted">{detail}</p>
      </div>
    </Link>
  );
}

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
  // Search isn't limited to public profiles — private accounts should still be
  // findable so they can be requested; their content stays gated regardless.
  const [{ data: byUsername }, { data: byName }, { data: liveRows }, { data: countRows }, { data: followRows }] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name, avatar_url, visibility, discoverable").ilike("username", like).limit(20),
    supabase.from("profiles").select("id, username, display_name, avatar_url, visibility, discoverable").ilike("display_name", like).limit(20),
    supabase
      .from("events")
      .select("id, user_id, event_type, title, spotify_artist_name, spotify_artist_image, event_date")
      .eq("is_public", true)
      .in("event_type", [...LIVE_TYPES])
      .or(`title.ilike.${like},spotify_artist_name.ilike.${like}`)
      .limit(300),
    supabase.from("public_country_counts").select("user_id, country_count"),
    supabase.from("follows").select("followee_id").eq("follower_id", viewer.id),
  ]);
  const countsByUser = new Map((countRows ?? []).map((r) => [r.user_id, Number(r.country_count)]));
  const following = new Set((followRows ?? []).map((r) => r.followee_id));

  // People who opted out of search only turn up for those who already follow them.
  const map = new Map<string, ProfileLite>();
  for (const p of [...(byUsername ?? []), ...(byName ?? [])] as (ProfileLite & { discoverable: boolean })[]) {
    if (p.discoverable || following.has(p.id)) map.set(p.id, p);
  }
  const people = [...map.values()].sort((a, b) => (countsByUser.get(b.id) ?? 0) - (countsByUser.get(a.id) ?? 0));
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
        {people.length > 0 && (
          <section aria-labelledby="sr-h">
            <h2 id="sr-h" className="text-2xl">People</h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {people.map((p) => (
                <li key={p.id}>
                  <ProfileCard p={p} detail={`@${p.username} · ${countsByUser.get(p.id) ?? 0} countries`} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

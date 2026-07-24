import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RatingStars } from "@/components/Rating";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Explore" };
export const revalidate = 60;

type ProfileLite = { id: string; username: string; display_name: string; avatar_url: string | null; bio: string };

function ProfileCard({ p, detail }: { p: ProfileLite; detail: string }) {
  return (
    <Link href={`/u/${p.username}`} className="card group flex items-center gap-4 px-4 py-4">
      {p.avatar_url ? (
        <Image src={p.avatar_url} alt="" width={48} height={48} className="h-12 w-12 rounded-full border border-line object-cover" />
      ) : (
        <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-raised font-serif text-lg text-muted">
          {p.display_name.charAt(0)}
        </span>
      )}
      <div className="min-w-0">
        <p className="font-serif text-lg group-hover:text-accent">{p.display_name}</p>
        <p className="truncate text-xs text-muted">{detail}</p>
      </div>
    </Link>
  );
}

export default async function ExplorePage({ searchParams }: { searchParams?: { q?: string } }) {
  const supabase = createClient();
  const q = (searchParams?.q ?? "").trim();

  const [{ data: profilesData }, { data: recentEvents }, { data: countRows }, { data: { user: viewer } }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("events")
        .select("id, title, subtitle, event_date, city, country_name, rating, profiles(username, display_name)")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase.from("public_country_counts").select("user_id, country_count"),
      supabase.auth.getUser(),
    ]);

  const profiles = (profilesData ?? []) as ProfileLite[];
  const countsByUser = new Map<string, number>();
  for (const row of countRows ?? []) countsByUser.set(row.user_id, row.country_count);
  const byCountryCount = (a: ProfileLite, b: ProfileLite) => (countsByUser.get(b.id) ?? 0) - (countsByUser.get(a.id) ?? 0);
  const featured = [...profiles].sort(byCountryCount).slice(0, 6);

  let searchResults: ProfileLite[] = [];
  if (q) {
    const like = `%${q}%`;
    const [{ data: byUsername }, { data: byName }] = await Promise.all([
      supabase.from("profiles").select("id, username, display_name, avatar_url, bio").eq("visibility", "public").ilike("username", like).limit(20),
      supabase.from("profiles").select("id, username, display_name, avatar_url, bio").eq("visibility", "public").ilike("display_name", like).limit(20),
    ]);
    const map = new Map<string, ProfileLite>();
    for (const p of [...(byUsername ?? []), ...(byName ?? [])] as ProfileLite[]) map.set(p.id, p);
    searchResults = [...map.values()].sort(byCountryCount);
  }

  let suggested: ProfileLite[] = [];
  if (viewer && !q) {
    const { data: followingRows } = await supabase.from("follows").select("followee_id").eq("follower_id", viewer.id);
    const followingIds = new Set((followingRows ?? []).map((r) => r.followee_id));
    suggested = profiles
      .filter((p) => p.id !== viewer.id && !followingIds.has(p.id))
      .sort(byCountryCount)
      .slice(0, 6);
  }

  const titleCounts = new Map<string, number>();
  for (const e of recentEvents ?? []) titleCounts.set(e.title, (titleCounts.get(e.title) ?? 0) + 1);
  const popularTitles = [...titleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

  return (
    <div className="mx-auto max-w-shell px-5 py-12">
      <p className="eyebrow">Explore</p>
      <h1 className="mt-2 text-4xl md:text-5xl">Worlds worth wandering.</h1>
      <p className="mt-3 max-w-xl text-muted">Public travellers, fresh countries and the events people can&rsquo;t stop replaying.</p>

      <form action="/explore" method="GET" className="mt-6 max-w-md">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search travellers by name…"
            aria-label="Search travellers"
            className="field !pl-10"
          />
        </div>
      </form>

      {q ? (
        <section className="mt-10" aria-labelledby="sr-h">
          <h2 id="sr-h" className="text-2xl">Results for &ldquo;{q}&rdquo;</h2>
          {searchResults.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No public travellers match that search.</p>
          ) : (
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {searchResults.map((p) => (
                <li key={p.id}>
                  <ProfileCard p={p} detail={`@${p.username} · ${countsByUser.get(p.id) ?? 0} countries`} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          {/* Featured travellers */}
          <section className="mt-12" aria-labelledby="ft-h">
            <h2 id="ft-h" className="text-2xl">Featured travellers</h2>
            {featured.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No public profiles yet. Be the first — create your account and make your world public.</p>
            ) : (
              <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((p) => (
                  <li key={p.id}>
                    <ProfileCard p={p} detail={`@${p.username} · ${countsByUser.get(p.id) ?? 0} countries`} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Suggested for you */}
          {suggested.length > 0 && (
            <section className="mt-14" aria-labelledby="sg-h">
              <h2 id="sg-h" className="text-2xl">Suggested for you</h2>
              <p className="mt-1 text-sm text-muted">Public travellers you don&rsquo;t follow yet.</p>
              <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {suggested.map((p) => (
                  <li key={p.id}>
                    <ProfileCard p={p} detail={`@${p.username} · ${countsByUser.get(p.id) ?? 0} countries`} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* Recent event memories */}
      {(recentEvents ?? []).length > 0 && (
        <section className="mt-14" aria-labelledby="cc-h">
          <h2 id="cc-h" className="text-2xl">Fresh event memories</h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(recentEvents ?? []).map((e) => {
              const p = one(e.profiles as { username: string; display_name: string } | { username: string; display_name: string }[] | null);
              if (!p) return null;
              return (
                <li key={e.id}>
                  <Link href={`/u/${p.username}/events/${e.id}`} className="card group block px-4 py-4">
                    <p className="font-serif text-lg group-hover:text-accent">{e.title}</p>
                    {e.subtitle && <p className="text-sm italic text-muted">{e.subtitle}</p>}
                    <p className="mt-1.5 text-xs text-muted">{formatDate(e.event_date)} · {[e.city, e.country_name].filter(Boolean).join(", ")} · by {p.display_name}</p>
                    <div className="mt-2"><RatingStars value={e.rating} size={13} /></div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Popular titles */}
      {popularTitles.length > 0 && (
        <section className="mt-14" aria-labelledby="pa-h">
          <h2 id="pa-h" className="text-2xl">What people are archiving</h2>
          <ul className="mt-5 flex flex-wrap gap-2.5">
            {popularTitles.map(([name, n]) => (
              <li key={name} className="rounded-full border border-line bg-surface px-4 py-1.5 font-serif text-sm">
                {name}{n > 1 && <span className="ml-1.5 text-xs text-muted">×{n}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

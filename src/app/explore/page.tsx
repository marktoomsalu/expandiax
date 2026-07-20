import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RatingStars } from "@/components/Rating";
import { countryByCode } from "@/lib/countries";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Explore" };
export const revalidate = 60;

type ProfileLite = { id: string; username: string; display_name: string; avatar_url: string | null; bio: string };

export default async function ExplorePage() {
  const supabase = createClient();

  const [{ data: profilesData }, { data: recentCountries }, { data: recentConcerts }, { data: allVisits }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("visited_countries")
        .select("id, country_code, country_name, note, created_at, profiles(username, display_name)")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("concerts")
        .select("id, artist_name, concert_name, concert_date, city, country_name, rating, profiles(username, display_name)")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase.from("visited_countries").select("user_id").limit(1000),
    ]);

  const profiles = (profilesData ?? []) as ProfileLite[];
  const countsByUser = new Map<string, number>();
  for (const v of allVisits ?? []) countsByUser.set(v.user_id, (countsByUser.get(v.user_id) ?? 0) + 1);
  const featured = [...profiles].sort((a, b) => (countsByUser.get(b.id) ?? 0) - (countsByUser.get(a.id) ?? 0)).slice(0, 6);

  const artistCounts = new Map<string, number>();
  for (const c of recentConcerts ?? []) artistCounts.set(c.artist_name, (artistCounts.get(c.artist_name) ?? 0) + 1);
  const popularArtists = [...artistCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

  return (
    <div className="mx-auto max-w-shell px-5 py-12">
      <p className="eyebrow">Explore</p>
      <h1 className="mt-2 text-4xl md:text-5xl">Worlds worth wandering.</h1>
      <p className="mt-3 max-w-xl text-muted">Public travellers, fresh countries and the concerts people can&rsquo;t stop replaying.</p>

      {/* Featured travellers */}
      <section className="mt-12" aria-labelledby="ft-h">
        <h2 id="ft-h" className="text-2xl">Featured travellers</h2>
        {featured.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No public profiles yet. Be the first — create your account and make your world public.</p>
        ) : (
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => (
              <li key={p.id}>
                <Link href={`/u/${p.username}`} className="card group flex items-center gap-4 px-4 py-4">
                  {p.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatar_url} alt="" className="h-12 w-12 rounded-full border border-line object-cover" />
                  ) : (
                    <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-raised font-serif text-lg text-muted">
                      {p.display_name.charAt(0)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="font-serif text-lg group-hover:text-accent">{p.display_name}</p>
                    <p className="truncate text-xs text-muted">
                      @{p.username} · {countsByUser.get(p.id) ?? 0} countries
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recently added countries */}
      {(recentCountries ?? []).length > 0 && (
        <section className="mt-14" aria-labelledby="rc-h">
          <h2 id="rc-h" className="text-2xl">Recently pinned</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(recentCountries ?? []).map((c) => {
              const meta = countryByCode(c.country_code);
              const p = one(c.profiles as { username: string; display_name: string } | { username: string; display_name: string }[] | null);
              if (!p) return null;
              return (
                <li key={c.id}>
                  <Link href={`/u/${p.username}/countries/${c.country_code.toLowerCase()}`} className="card group block px-4 py-3.5">
                    <p className="font-serif text-lg group-hover:text-accent">{meta?.flag} {c.country_name}</p>
                    <p className="mt-0.5 text-xs text-muted">by {p.display_name}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Recent concert memories */}
      {(recentConcerts ?? []).length > 0 && (
        <section className="mt-14" aria-labelledby="cc-h">
          <h2 id="cc-h" className="text-2xl">Fresh concert memories</h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(recentConcerts ?? []).map((c) => {
              const p = one(c.profiles as { username: string; display_name: string } | { username: string; display_name: string }[] | null);
              if (!p) return null;
              return (
                <li key={c.id}>
                  <Link href={`/u/${p.username}/concerts/${c.id}`} className="card group block px-4 py-4">
                    <p className="font-serif text-lg group-hover:text-accent">{c.artist_name}</p>
                    {c.concert_name && <p className="text-sm italic text-muted">{c.concert_name}</p>}
                    <p className="mt-1.5 text-xs text-muted">{formatDate(c.concert_date)} · {[c.city, c.country_name].filter(Boolean).join(", ")} · by {p.display_name}</p>
                    <div className="mt-2"><RatingStars value={c.rating} size={13} /></div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Popular artists */}
      {popularArtists.length > 0 && (
        <section className="mt-14" aria-labelledby="pa-h">
          <h2 id="pa-h" className="text-2xl">Artists people are archiving</h2>
          <ul className="mt-5 flex flex-wrap gap-2.5">
            {popularArtists.map(([name, n]) => (
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

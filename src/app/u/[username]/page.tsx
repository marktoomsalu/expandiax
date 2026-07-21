import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { WorldMapLink } from "@/components/WorldMapLink";
import { RatingStars } from "@/components/Rating";
import { FollowButton } from "@/components/FollowButton";
import { ReportButton } from "@/components/ReportButton";
import { TOTAL_COUNTRIES, continentCounts, countryByCode } from "@/lib/countries";
import { formatDate } from "@/lib/utils";
import type { Concert, ConcertMedia, CountryMedia, Profile, VisitedCountry } from "@/lib/types";

type CountryRow = VisitedCountry & { country_media: CountryMedia[]; country_visits: { year: number }[] };
type ConcertRow = Concert & { concert_media: ConcertMedia[] };

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio")
    .eq("username", params.username.toLowerCase())
    .maybeSingle();
  if (!profile) return { title: "Profile" };

  const { count } = await supabase
    .from("visited_countries")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profile.id);

  const description =
    profile.bio ||
    `${profile.display_name}'s world on ExpandiaX — ${count ?? 0} of ${TOTAL_COUNTRIES} countries, and the concerts along the way.`;

  return {
    title: profile.display_name,
    description,
    openGraph: {
      title: `${profile.display_name} (@${profile.username})`,
      description,
    },
    twitter: {
      title: `${profile.display_name} (@${profile.username})`,
      description,
    },
  };
}

export default async function PublicProfilePage({ params }: { params: { username: string } }) {
  const supabase = createClient();
  const { data: profile } = (await supabase
    .from("profiles")
    .select("*")
    .eq("username", params.username.toLowerCase())
    .maybeSingle()) as { data: Profile | null };

  if (!profile) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="text-3xl">This world is private.</h1>
        <p className="mt-3 text-sm text-muted">
          The profile doesn&rsquo;t exist, or its owner keeps it to themselves.
        </p>
        <Link href="/explore" className="btn-ghost mt-8">Explore public travellers</Link>
      </div>
    );
  }

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  const isOwnProfile = viewer?.id === profile.id;

  const [{ data: countriesData }, { data: concertsData }, { count: followerCount }, { count: followingCount }, { data: followingRow }] =
    await Promise.all([
      supabase
        .from("visited_countries")
        .select("*, country_media!country_media_visited_country_id_fkey(*), country_visits(year)")
        .eq("user_id", profile.id)
        .order("country_name"),
      supabase
        .from("concerts")
        .select("*, concert_media!concert_media_concert_id_fkey(*)")
        .eq("user_id", profile.id)
        .eq("is_public", true)
        .order("concert_date", { ascending: false }),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("followee_id", profile.id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
      viewer && !isOwnProfile
        ? supabase.from("follows").select("follower_id").eq("follower_id", viewer.id).eq("followee_id", profile.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const isFollowing = !!followingRow;
  const countries = (countriesData ?? []) as CountryRow[];
  const concerts = (concertsData ?? []) as ConcertRow[];
  const codes = countries.map((c) => c.country_code);
  const visitCounts = Object.fromEntries(countries.map((c) => [c.country_code, c.country_visits.length]));
  const pct = Math.round((codes.length / TOTAL_COUNTRIES) * 1000) / 10;
  const visitedContinents = continentCounts(codes).filter((c) => c.visited > 0);
  const uniqueArtists = new Set(concerts.map((c) => c.artist_name)).size;
  const home = countryByCode(profile.home_country_code);

  const favourites = countries.filter((c) => c.is_favourite || c.note).slice(0, 4)
    .sort((a, b) => Number(b.is_favourite) - Number(a.is_favourite));
  const gallery = [
    ...countries.flatMap((c) => c.country_media.map((m) => ({ ...m, alt: `Photo from ${c.country_name}` }))),
    ...concerts.flatMap((c) =>
      c.concert_media.filter((m) => m.media_type === "image").map((m) => ({ ...m, alt: `${c.artist_name} live` }))
    ),
  ].slice(0, 8);

  const stat = (value: React.ReactNode, label: string) => (
    <div className="border-l border-line pl-4 first:border-0 first:pl-0">
      <p className="stat-number !text-3xl md:!text-4xl">{value}</p>
      <p className="eyebrow mt-1.5">{label}</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-shell px-5 py-12">
      {/* Header */}
      <header className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        {profile.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt={`${profile.display_name}'s photo`}
            width={96}
            height={96}
            className="h-24 w-24 rounded-full border border-line object-cover"
          />
        ) : (
          <div aria-hidden className="flex h-24 w-24 items-center justify-center rounded-full border border-line bg-raised font-serif text-3xl text-muted">
            {profile.display_name.charAt(0)}
          </div>
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-4xl md:text-5xl">{profile.display_name}</h1>
            {!isOwnProfile && viewer && <FollowButton targetId={profile.id} initialFollowing={isFollowing} />}
          </div>
          <p className="mt-1.5 text-sm text-muted">
            @{profile.username}
            {home && <> · from {home.flag} {home.name}</>}
            {" · "}remembering since {new Date(profile.created_at).getFullYear()}
          </p>
          <p className="mt-1.5 text-sm text-muted">
            <Link href={`/u/${profile.username}/followers`} className="hover:text-ink">
              <span className="font-medium text-ink">{followerCount ?? 0}</span> followers
            </Link>
            {" · "}
            <Link href={`/u/${profile.username}/following`} className="hover:text-ink">
              <span className="font-medium text-ink">{followingCount ?? 0}</span> following
            </Link>
          </p>
          {profile.bio && <p className="mt-3 max-w-xl leading-relaxed">{profile.bio}</p>}
        </div>
      </header>

      {/* Stats */}
      <div className="mt-10 grid grid-cols-2 gap-y-6 sm:flex sm:flex-wrap sm:gap-x-10">
        {stat(codes.length, "Countries")}
        {stat(`${pct}%`, "Of the world")}
        {stat(`${visitedContinents.length}/6`, "Continents")}
        {stat(concerts.length, "Concerts")}
        {stat(uniqueArtists, "Artists seen")}
      </div>

      {/* Map */}
      <div className="mt-10 overflow-hidden rounded-card border border-line bg-surface p-1.5 sm:p-3">
        <WorldMapLink visitedCodes={codes} visitCounts={visitCounts} username={profile.username} />
      </div>

      {/* Favourite memories */}
      {favourites.length > 0 && (
        <section className="mt-14" aria-labelledby="mem-h">
          <p className="eyebrow">Travel</p>
          <h2 id="mem-h" className="mt-1 text-2xl md:text-3xl">Favourite memories</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {favourites.map((c) => {
              const meta = countryByCode(c.country_code);
              const cover =
                c.country_media.find((m) => m.id === c.cover_media_id) ??
                [...c.country_media].sort((a, b) => a.display_order - b.display_order)[0];
              return (
                <Link key={c.id} href={`/u/${profile.username}/countries/${c.country_code.toLowerCase()}`} className="card group overflow-hidden">
                  {cover && (
                    <div className="relative aspect-[16/8] w-full">
                      <Image
                        src={cover.public_url}
                        alt={cover.caption || `Photo from ${c.country_name}`}
                        fill
                        sizes="(min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                    </div>
                  )}
                  <div className="px-5 py-4">
                    <p className="font-serif text-xl">{meta?.flag} {c.country_name}</p>
                    {c.note && <p className="mt-1.5 line-clamp-2 text-sm italic leading-relaxed text-muted">&ldquo;{c.note}&rdquo;</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent concerts */}
      {concerts.length > 0 && (
        <section className="mt-14" aria-labelledby="conc-h">
          <p className="eyebrow">Music</p>
          <h2 id="conc-h" className="mt-1 text-2xl md:text-3xl">Recent concerts</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {concerts.slice(0, 6).map((c) => {
              const cover =
                c.concert_media.find((m) => m.id === c.cover_media_id) ??
                c.concert_media.filter((m) => m.media_type === "image").sort((a, b) => a.display_order - b.display_order)[0];
              return (
                <li key={c.id}>
                  <Link href={`/u/${profile.username}/concerts/${c.id}`} className="card group block overflow-hidden">
                    <div className="relative aspect-[16/9] bg-ink/90">
                      {cover ? (
                        <Image
                          src={cover.public_url}
                          alt={cover.caption || `${c.artist_name} live`}
                          fill
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-4 text-center font-serif text-2xl italic text-canvas/90 dark:text-ink/90">{c.artist_name}</div>
                      )}
                    </div>
                    <div className="px-4 py-3.5">
                      <p className="font-serif text-lg">{c.artist_name}</p>
                      <p className="mt-0.5 text-xs text-muted">{formatDate(c.concert_date)} · {[c.city, c.country_name].filter(Boolean).join(", ")}</p>
                      <div className="mt-1.5"><RatingStars value={c.rating} size={13} /></div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Gallery */}
      {gallery.length > 0 && (
        <section className="mt-14" aria-labelledby="gal-h">
          <p className="eyebrow">Archive</p>
          <h2 id="gal-h" className="mt-1 text-2xl md:text-3xl">Selected frames</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {gallery.map((m) => (
              <div key={m.id} className="relative aspect-square w-full overflow-hidden rounded-lg border border-line">
                <Image
                  src={m.public_url}
                  alt={m.caption || m.alt}
                  fill
                  sizes="(min-width: 640px) 25vw, 50vw"
                  loading="lazy"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {countries.length === 0 && concerts.length === 0 && (
        <p className="mt-14 text-center text-sm text-muted">
          {profile.display_name} hasn&rsquo;t added any public memories yet.
        </p>
      )}

      {!isOwnProfile && (
        <div className="mt-16 flex justify-center border-t border-line pt-6">
          <ReportButton targetType="profile" targetId={profile.id} targetUrl={`/u/${profile.username}`} />
        </div>
      )}
    </div>
  );
}

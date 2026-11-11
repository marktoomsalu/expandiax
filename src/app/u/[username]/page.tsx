import Link from "next/link";
import Image from "next/image";
import { stockPhotoFor } from "@/lib/stockPhotos";
import { StockCredit } from "@/components/StockCredit";
import { MessageButton } from "@/components/chat/AskAboutButton";
import { StockImage } from "@/components/StockImage";
import { BarChart3, ChevronRight, Pencil } from "lucide-react";
import type { Metadata } from "next";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { WorldMapLink } from "@/components/WorldMapLink";
import { RatingStars } from "@/components/Rating";
import { FollowButton } from "@/components/FollowButton";
import { ReportButton } from "@/components/ReportButton";
import { BlockButton } from "@/components/BlockButton";
import { BadgeGrid } from "@/components/BadgeGrid";
import { EarlyExplorerBadge } from "@/components/EarlyExplorerBadge";
import { SignOutButton } from "@/components/SignOutButton";
import { TOTAL_COUNTRIES, countryByCode } from "@/lib/countries";
import { isTerritoryCode, TOTAL_TERRITORIES } from "@/lib/territories";
import { formatDate, hexToRgbTriplet } from "@/lib/utils";
import { focalPosition } from "@/lib/media";
import { evaluateBadges, isEarlyExplorer } from "@/lib/badges";
import { buildAllTimeStats, type CountryStatInput, type EventStatInput } from "@/lib/stats";
import { TOTAL_US_STATES } from "@/lib/usStates";
import { visitSortKey, formatVisitRange } from "@/lib/utils";
import type { CountryVisit, Event, EventMedia, CountryMedia, Profile, VisitedCountry, VisitedUSState } from "@/lib/types";
import { signMedia } from "@/lib/signedMedia";
import { mapStays } from "@/lib/stays";
import { MapLegend } from "@/components/MapLegend";

type VisitLite = Pick<CountryVisit, "id" | "year" | "visited_from" | "visited_to" | "date_precision" | "highlight" | "kind" | "is_public" | "audience">;
type CountryRow = VisitedCountry & { country_media: CountryMedia[]; country_visits: VisitLite[] };
type EventRow = Event & { event_media: EventMedia[] };
type TripCard = { visit: VisitLite; countryCode: string; countryName: string; cover?: CountryMedia };

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
    `${profile.display_name}'s world on ExpandiaX - ${count ?? 0} of ${TOTAL_COUNTRIES} countries, and the events along the way.`;

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

export default async function PublicProfilePage({ params, searchParams }: { params: { username: string }; searchParams?: { preview?: string } }) {
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

  const viewer = await getAuthUser();
  // "View public profile" from Settings: your own page exactly as someone
  // who doesn't follow you sees it, without your own buttons or anything
  // you've kept to "Only me".
  const preview = viewer?.id === profile.id && searchParams?.preview === "1";
  const isOwnProfile = viewer?.id === profile.id && !preview;

  const [
    { data: countriesData },
    { data: eventsData },
    { data: usStatesData },
    { count: followerCount },
    { count: followingCount },
    { data: followingRow },
    { data: pendingRequestRow },
  ] = await Promise.all([
      supabase
        .from("visited_countries")
        .select("*, country_media!country_media_visited_country_id_fkey(*), country_visits(*)")
        .eq("user_id", profile.id)
        .in("is_public", preview ? [true] : [true, false])
        .order("country_name"),
      supabase
        .from("events")
        .select("*, event_media!event_media_event_id_fkey(*)")
        .eq("user_id", profile.id)
        .eq("is_public", true)
        .order("event_date", { ascending: false }),
      supabase.from("visited_us_states").select("*").eq("user_id", profile.id).order("state_name"),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("followee_id", profile.id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
      viewer && !isOwnProfile
        ? supabase.from("follows").select("follower_id").eq("follower_id", viewer.id).eq("followee_id", profile.id).maybeSingle()
        : Promise.resolve({ data: null }),
      viewer && !isOwnProfile
        ? supabase.from("follow_requests").select("requester_id").eq("requester_id", viewer.id).eq("target_id", profile.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]).then((r) => signMedia(r));

  const isFollowing = !!followingRow;
  const hasPendingRequest = !!pendingRequestRow;
  // Mirrors is_profile_public(): private unlocks once the target has
  // accepted a follow request (the only way isFollowing can be true for a
  // private profile, since direct follows into private profiles are
  // blocked at the DB).
  const hasAccess = isOwnProfile || profile.visibility === "public" || isFollowing;

  // On a private profile you can't open: who you know that follows them, as Instagram.
  let mutuals: { names: string[]; more: number } | null = null;
  if (!hasAccess && viewer && !preview) {
    const { data: mine } = await supabase.from("follows").select("followee_id").eq("follower_id", viewer.id);
    const myIds = (mine ?? []).map((r) => r.followee_id as string);
    if (myIds.length) {
      const { data: theirs } = await supabase.from("follows").select("follower_id").eq("followee_id", profile.id).in("follower_id", myIds);
      const ids = (theirs ?? []).map((r) => r.follower_id as string);
      if (ids.length) {
        const { data: people } = await supabase.from("profiles").select("display_name").in("id", ids.slice(0, 2));
        mutuals = { names: (people ?? []).map((p) => p.display_name), more: Math.max(0, ids.length - 2) };
      }
    }
  }
  const previewBanner = preview && (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm">
      <span>
        <span className="font-medium">Preview:</span> this is how people who don&rsquo;t follow you see your profile.
      </span>
      <Link href="/settings" className="font-medium text-accent hover:underline">
        Back to settings
      </Link>
    </div>
  );
  // visited_countries rows now include territories too (Greenland,
  // Gibraltar, etc.) — realCountries/territories split them back apart for
  // anything that shouldn't blend the two (the 195-country %, continents,
  // badges); `countries` (unfiltered) still feeds trips/gallery/the globe,
  // so territory photos and map highlights show up there naturally.
  // In the preview, leave out the trips you keep to yourself, and their photos, as others see it.
  const countries = ((countriesData ?? []) as CountryRow[]).map((c) => {
    if (!preview) return c;
    // Someone who doesn't follow you sees only posts for everyone (Feed).
    const hidden = new Set(c.country_visits.filter((v) => v.is_public === false || (v.audience ?? "everyone") !== "everyone").map((v) => v.id));
    return hidden.size
      ? { ...c, country_visits: c.country_visits.filter((v) => !hidden.has(v.id)), country_media: c.country_media.filter((m) => !hidden.has(m.country_visit_id ?? "")) }
      : c;
  });
  const realCountries = countries.filter((c) => !isTerritoryCode(c.country_code));
  const territories = countries.filter((c) => isTerritoryCode(c.country_code));
  // The preview shows only events for everyone, as someone who doesn't follow you sees them.
  const events = ((eventsData ?? []) as EventRow[]).filter((e) => !preview || (e.audience ?? "everyone") === "everyone");
  const usStates = (usStatesData ?? []) as VisitedUSState[];
  const codes = countries.map((c) => c.country_code);
  const countryCodes = realCountries.map((c) => c.country_code);
  // Trips count as visits; somewhere they lived shows pink, like home.
  const { visitCounts, livedCodes } = mapStays(countries);
  const home = countryByCode(profile.home_country_code);

  const statCountries: CountryStatInput[] = realCountries.map((c) => ({
    country_code: c.country_code,
    is_favourite: c.is_favourite,
    photo_count: c.country_media.length,
    visits: c.country_visits.map((v) => ({ year: v.year })),
  }));
  const statEvents: EventStatInput[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    country_code: e.country_code,
    event_type: e.event_type,
    event_date: e.event_date,
    rating: e.rating,
    is_favourite: e.is_favourite,
    photo_count: e.event_media.filter((m) => m.media_type === "image").length,
    video_count: e.event_media.filter((m) => m.media_type === "video").length,
  }));
  const badges = evaluateBadges(buildAllTimeStats(statCountries, statEvents)).filter((b) => b.isUnlocked);

  const allTrips: TripCard[] = countries
    .flatMap((c) =>
      c.country_visits.map((v) => ({
        visit: v,
        countryCode: c.country_code,
        countryName: c.country_name,
        cover:
          c.country_media.find((m) => m.country_visit_id === v.id && m.id === c.cover_media_id) ??
          [...c.country_media].filter((m) => m.country_visit_id === v.id).sort((a, b) => a.display_order - b.display_order)[0],
      }))
    )
    .sort((a, b) => visitSortKey(b.visit).localeCompare(visitSortKey(a.visit)));
  const codesWithPhotos = new Set(countries.filter((c) => c.country_media.length > 0).map((c) => c.country_code));
  const recentTrips = allTrips.slice(0, 3);

  // The two counters open the full lists: yours in My World and Events,
  // someone else's on their own list pages.
  const stat = (value: React.ReactNode, label: string, href: string) => (
    <Link href={href} className="group border-l border-line pl-4 first:border-0 first:pl-0">
      <p className="stat-number !text-3xl transition-colors group-hover:text-accent md:!text-4xl">{value}</p>
      <p className="eyebrow mt-1.5 flex items-center gap-1">
        {label} <ChevronRight size={12} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
      </p>
    </Link>
  );

  // Their own accent color, scoped to this page only, via the same CSS
  // variable every bg-accent/text-accent/border-accent class already reads
  // from — no per-component styling needed.
  // Their home country's photos take turns, one a day.
  const coverStock = profile.cover_url ? null : stockPhotoFor(profile.home_country_code, `${profile.id}:${new Date().toISOString().slice(0, 10)}`);
  const accentTriplet = profile.accent_color ? hexToRgbTriplet(profile.accent_color) : null;
  const accentStyle = accentTriplet ? ({ "--accent": accentTriplet } as React.CSSProperties) : undefined;

  return (
    <div style={accentStyle}>
      {/* Cover: their own photo, or one of their home country's (a different one each day), fading into the page. */}
      {/* Phones: edge to edge. Wider screens: the width of the page, rounded, a little taller, so it isn't a thin strip. */}
      <div className="sm:mx-auto sm:max-w-shell sm:px-5 sm:pt-6">
      <div className="relative h-44 w-full overflow-hidden sm:h-72 sm:rounded-3xl lg:h-80" style={{ backgroundColor: coverStock?.color ?? "rgb(43 11 46)" }}>
        {profile.cover_url ? (
          <Image src={profile.cover_url} alt="" fill priority sizes="100vw" className="object-cover" />
        ) : coverStock ? (
          <StockImage photo={coverStock} alt="" priority sizes="100vw" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#2b0b2e] via-[#7c1d6f] to-[#fb7822]" aria-hidden />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-canvas/30 to-canvas" aria-hidden />
        {!profile.cover_url && coverStock && <StockCredit photo={coverStock} className="absolute right-4 top-3 !text-white/70" />}
      </div>
      </div>
    <div className="mx-auto -mt-20 max-w-shell px-5 pb-12 sm:-mt-24">
      {previewBanner}
      {/* Header */}
      <header className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:px-8">
        {/* A halo in their accent colour (ExpandiaX pink unless they chose one). */}
        <span
          className="block shrink-0 rounded-full"
          style={{ boxShadow: "0 0 0 4px rgb(var(--canvas)), 0 0 0 7px rgb(var(--accent)), 0 0 36px 8px rgb(var(--accent) / 0.55)" }}
        >
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={`${profile.display_name}'s photo`}
              width={112}
              height={112}
              priority
              className="h-28 w-28 rounded-full object-cover"
            />
          ) : (
            <span aria-hidden className="flex h-28 w-28 items-center justify-center rounded-full bg-raised font-serif text-4xl text-muted">
              {profile.display_name.charAt(0)}
            </span>
          )}
        </span>
        <div className="flex-1">
          <h1 className="text-4xl md:text-5xl">{profile.display_name}</h1>
          {profile.bio && <p className="mt-2 max-w-xl leading-relaxed">{profile.bio}</p>}
          <p className="mt-1.5 text-sm text-muted">
            @{profile.username}
            {home && <> · from {home.flag} {home.name}</>}
            {" · "}collecting memories since {new Date(profile.created_at).getFullYear()}
          </p>
          {hasAccess ? (
            <p className="mt-1.5 text-sm text-muted">
              <Link href={`/u/${profile.username}/followers`} className="hover:text-ink">
                <span className="font-medium text-ink">{followerCount ?? 0}</span> followers
              </Link>
              {" · "}
              <Link href={`/u/${profile.username}/following`} className="hover:text-ink">
                <span className="font-medium text-ink">{followingCount ?? 0}</span> following
              </Link>
            </p>
          ) : (
            // A private profile you can't open: the numbers, but not who.
            <p className="mt-1.5 text-sm text-muted">
              <span className="font-medium text-ink">{followerCount ?? 0}</span> followers
              {" · "}
              <span className="font-medium text-ink">{followingCount ?? 0}</span> following
            </p>
          )}
          {mutuals && (
            <p className="mt-1 text-xs text-muted">
              Followed by {mutuals.names.join(mutuals.more ? ", " : " and ")}
              {mutuals.more > 0 && ` and ${mutuals.more} ${mutuals.more === 1 ? "other" : "others"} you know`}
            </p>
          )}
          {/* Your own buttons, or Follow: under who you are and your followers. */}
          {(preview || isOwnProfile || viewer) && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {preview && (
                <span className="btn-accent pointer-events-none !py-2 text-sm" aria-hidden>
                  Follow
                </span>
              )}
              {!isOwnProfile && !preview && viewer && (
                <FollowButton
                  targetId={profile.id}
                  visibility={profile.visibility}
                  initialFollowing={isFollowing}
                  initialRequested={hasPendingRequest}
                />
              )}
              {!isOwnProfile && !preview && viewer && (
                <MessageButton person={{ id: profile.id, username: profile.username, display_name: profile.display_name, avatar_url: profile.avatar_url }} />
              )}
              {isOwnProfile && (
                <>
                  <Link href="/settings" className="btn-ghost !py-2 text-sm">
                    <Pencil size={14} /> Edit profile
                  </Link>
                  <Link href="/stats" className="btn-ghost !py-2 text-sm">
                    <BarChart3 size={14} /> Stats
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {hasAccess ? (
        <>
      {/* Stats */}
      <div className="mt-10 grid grid-cols-2 gap-y-6 sm:flex sm:flex-wrap sm:gap-x-10">
        {stat(countryCodes.length, "Countries", isOwnProfile ? "/my-world" : `/u/${profile.username}/countries`)}
        {stat(events.length, "Events", isOwnProfile ? "/events" : `/u/${profile.username}/events`)}
      </div>

      {/* Map */}
      <div className="mt-10 overflow-hidden rounded-card border border-line bg-surface p-1.5 sm:p-3">
        <WorldMapLink
          visitedCodes={codes}
          visitCounts={visitCounts}
          homeCode={profile.home_country_code}
          livedCodes={livedCodes}
          username={profile.username}
        />
        <MapLegend hasHome={!!profile.home_country_code} hasLived={livedCodes.length > 0} />
      </div>

      {/* US States */}
      {usStates.length > 0 && (
        <section id="us-states" className="mt-14" aria-labelledby="states-h">
          <p className="eyebrow">Stateside</p>
          <h2 id="states-h" className="mt-1 text-2xl md:text-3xl">{usStates.length} of {TOTAL_US_STATES} US states</h2>
          <ul className="mt-6 flex flex-wrap gap-2">
            {usStates.map((s) => (
              <li key={s.id} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm">
                {s.state_name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Territories */}
      {territories.length > 0 && (
        <section id="territories" className="mt-14" aria-labelledby="territories-h">
          <p className="eyebrow">Beyond the {TOTAL_COUNTRIES}</p>
          <h2 id="territories-h" className="mt-1 text-2xl md:text-3xl">{territories.length} of {TOTAL_TERRITORIES} territories</h2>
          <ul className="mt-6 flex flex-wrap gap-2">
            {territories.map((t) => (
              <li key={t.id} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm">
                {t.country_name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recent trips */}
      {recentTrips.length > 0 && (
        <section className="mt-14" aria-labelledby="mem-h">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Travel</p>
              <h2 id="mem-h" className="mt-1 text-2xl md:text-3xl">Recent trips</h2>
            </div>
            {allTrips.length > 3 && (
              <Link href={`/u/${profile.username}/trips`} className="text-sm text-accent underline-offset-4 hover:underline">
                See more
              </Link>
            )}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentTrips.map(({ visit, countryCode, countryName, cover }) => {
              const meta = countryByCode(countryCode);
              const stock = !cover && !codesWithPhotos.has(countryCode) ? stockPhotoFor(countryCode, profile.id) : null;
              return (
                <Link key={visit.id} href={`/u/${profile.username}/countries/${countryCode.toLowerCase()}`} className="card group overflow-hidden">
                  {cover && (
                    <div className="relative aspect-[16/8] w-full">
                      <Image
                        src={cover.public_url}
                        alt={cover.caption || `Photo from ${countryName}`}
                        fill
                        sizes="(min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                        style={{ objectPosition: focalPosition(cover) }}
                      />
                    </div>
                  )}
                  {stock && (
                    // No photos of this country yet: a credited stock photo instead of an empty card.
                    <div className="relative aspect-[16/8] w-full" style={{ backgroundColor: stock.color }}>
                      <StockImage photo={stock} aspect="2:1" sizes="(min-width: 640px) 50vw, 100vw" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" aria-hidden />
                      <StockCredit photo={stock} linked={false} className="absolute bottom-2.5 right-3" />
                    </div>
                  )}
                  <div className="px-5 py-4">
                    <p className="eyebrow">{formatVisitRange(visit)}</p>
                    <p className="mt-1 font-serif text-xl">{meta?.flag} {countryName}</p>
                    {visit.highlight && <p className="mt-1.5 line-clamp-2 text-sm italic leading-relaxed text-muted">&ldquo;{visit.highlight}&rdquo;</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent events */}
      {events.length > 0 && (
        <section className="mt-14" aria-labelledby="conc-h">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Music &amp; moments</p>
              <h2 id="conc-h" className="mt-1 text-2xl md:text-3xl">Recent events</h2>
            </div>
            {events.length > 3 && (
              <Link href={`/u/${profile.username}/events`} className="text-sm text-accent underline-offset-4 hover:underline">
                See more
              </Link>
            )}
          </div>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.slice(0, 3).map((e) => {
              const cover =
                e.event_media.find((m) => m.id === e.cover_media_id) ??
                e.event_media.filter((m) => m.media_type === "image").sort((a, b) => a.display_order - b.display_order)[0];
              return (
                <li key={e.id}>
                  <Link href={`/u/${profile.username}/events/${e.id}`} className="card group block overflow-hidden">
                    <div className="relative aspect-[16/9] bg-ink/90">
                      {cover ? (
                        <Image
                          src={cover.public_url}
                          alt={cover.caption || e.title}
                          fill
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      ) : e.spotify_artist_image ? (
                        <Image
                          src={e.spotify_artist_image}
                          alt={e.spotify_artist_name || e.title}
                          fill
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-4 text-center font-serif text-2xl italic text-canvas/90 dark:text-ink/90">{e.title}</div>
                      )}
                    </div>
                    <div className="px-4 py-3.5">
                      <p className="font-serif text-lg">{e.title}</p>
                      <p className="mt-0.5 text-xs text-muted">{formatDate(e.event_date)} · {[e.city, e.country_name].filter(Boolean).join(", ")}</p>
                      <div className="mt-1.5"><RatingStars value={e.rating} size={13} /></div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Badges */}
      {(badges.length > 0 || isEarlyExplorer(profile.signup_number)) && (
        <section id="badges" className="mt-14" aria-labelledby="badges-h">
          <p className="eyebrow">Trophy case</p>
          <h2 id="badges-h" className="mt-1 text-2xl md:text-3xl">Badges</h2>
          {isEarlyExplorer(profile.signup_number) && (
            <div className="mt-6">
              <EarlyExplorerBadge signupNumber={profile.signup_number} />
            </div>
          )}
          {badges.length > 0 && (
            <div className="mt-6">
              <BadgeGrid badges={badges} showLocked={false} />
            </div>
          )}
        </section>
      )}

      {countries.length === 0 && events.length === 0 && usStates.length === 0 && territories.length === 0 && (
        <p className="mt-14 text-center text-sm text-muted">
          {profile.display_name} hasn&rsquo;t added any public memories yet.
        </p>
      )}
        </>
      ) : (
        <div className="mt-14 text-center">
          <p className="text-lg">This account is private.</p>
          <p className="mt-2 text-sm text-muted">
            {hasPendingRequest
              ? "Your follow request is waiting for approval."
              : `Request to follow ${profile.display_name} to see their countries, trips and events.`}
          </p>
        </div>
      )}

      {!isOwnProfile && !preview && (
        <div className="mt-16 flex items-center justify-center gap-6 border-t border-line pt-6">
          <ReportButton targetType="profile" targetId={profile.id} targetUrl={`/u/${profile.username}`} />
          {viewer && <BlockButton targetId={profile.id} targetName={profile.display_name} targetUsername={profile.username} />}
        </div>
      )}

      {isOwnProfile && <SignOutButton variant="floating" />}
    </div>
    </div>
  );
}

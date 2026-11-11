import Link from "next/link";
import { Users } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { StatCard } from "@/components/StatCard";
import { BadgeGrid } from "@/components/BadgeGrid";
import { EarlyExplorerBadge } from "@/components/EarlyExplorerBadge";
import { WorldMap } from "@/components/WorldMap";
import { EmptyState } from "@/components/EmptyState";
import { YearByYear } from "@/components/YearByYear";
import { CONTINENT_COLORS, TOTAL_COUNTRIES, continentCounts } from "@/lib/countries";
import { isTerritoryCode } from "@/lib/territories";
import { EVENT_TYPES } from "@/lib/events";
import { evaluateBadges } from "@/lib/badges";
import {
  buildAllTimeStats,
  buildYearStats,
  mostRepeatedTitle,
  type CountryStatInput,
  type EventStatInput,
} from "@/lib/stats";
import { cn } from "@/lib/utils";
import type { EventType } from "@/lib/types";
import { CONNECTOR_TARGET } from "@/lib/invite";
import { ConnectorBadge } from "@/components/invite/ConnectorBadge";

export const metadata = { title: "Stats" };

type CountryRow = {
  id: string;
  country_code: string;
  is_favourite: boolean;
  country_visits: { year: number; visited_from: string | null; visited_to: string | null }[];
  country_media: { id: string }[];
};

type EventRow = {
  id: string;
  title: string;
  country_code: string;
  event_type: EventType;
  event_date: string;
  rating: number | null;
  is_favourite: boolean;
  event_media: { id: string; media_type: "image" | "video" }[];
};

export default async function StatsPage({ searchParams }: { searchParams: { year?: string } }) {
  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");

  const [{ data: countriesData }, { data: eventsData }, { data: profile }] = await Promise.all([
    supabase
      .from("visited_countries")
      .select(
        "id, country_code, is_favourite, country_visits(year, visited_from, visited_to), country_media!country_media_visited_country_id_fkey(id)"
      )
      .eq("user_id", user.id),
    supabase
      .from("events")
      .select(
        "id, title, country_code, event_type, event_date, rating, is_favourite, event_media!event_media_event_id_fkey(id, media_type)"
      )
      .eq("user_id", user.id),
    supabase.from("profiles").select("signup_number").eq("id", user.id).single(),
  ]);

  const { data: invitedRaw } = await supabase.rpc("invite_count", { p_user: user.id });
  const invitedCount = typeof invitedRaw === "number" ? invitedRaw : 0;

  const countryRows = (countriesData ?? []) as CountryRow[];
  const eventRows = (eventsData ?? []) as EventRow[];

  // Territories (Greenland, Gibraltar, etc.) share this table but stay out
  // of every count-based stat/badge below — same rule as My World and the
  // public profile. They still show up on the map, via allCodes.
  const realCountryRows = countryRows.filter((c) => !isTerritoryCode(c.country_code));
  const allCodes = countryRows.map((c) => c.country_code);

  const countries: CountryStatInput[] = realCountryRows.map((c) => ({
    country_code: c.country_code,
    is_favourite: c.is_favourite,
    photo_count: c.country_media?.length ?? 0,
    visits: (c.country_visits ?? []).map((v) => ({ year: v.year, visited_from: v.visited_from, visited_to: v.visited_to })),
  }));

  const events: EventStatInput[] = eventRows.map((e) => ({
    id: e.id,
    title: e.title,
    country_code: e.country_code,
    event_type: e.event_type,
    event_date: e.event_date,
    rating: e.rating,
    is_favourite: e.is_favourite,
    photo_count: (e.event_media ?? []).filter((m) => m.media_type === "image").length,
    video_count: (e.event_media ?? []).filter((m) => m.media_type === "video").length,
  }));

  const hasAnyData = countries.length > 0 || events.length > 0;
  const allTime = buildAllTimeStats(countries, events);
  const years = allTime.yearsActive;
  const currentYear = new Date().getFullYear();

  const requestedYear = searchParams.year;
  const selectedYear =
    requestedYear === "all" ? null : requestedYear ? Number(requestedYear) : years.at(-1) ?? currentYear;

  // Likes are deliberately never shown publicly (see LikeButton.tsx) — this
  // is the one place the owner can see them: every like on what they've
  // posted, or with a year picked, the likes they got during that year.
  const countryIds = countryRows.map((c) => c.id);
  const eventIds = eventRows.map((e) => e.id);
  const likesOn = (kind: "country" | "event", ids: string[]) => {
    if (!ids.length) return Promise.resolve({ count: 0 });
    let q = supabase.from("likes").select("id", { count: "exact", head: true }).eq("kind", kind).in("target_id", ids);
    if (selectedYear !== null) q = q.gte("created_at", `${selectedYear}-01-01`).lt("created_at", `${selectedYear + 1}-01-01`);
    return q;
  };
  const [{ count: countryLikes }, { count: eventLikes }] = await Promise.all([likesOn("country", countryIds), likesOn("event", eventIds)]);
  const totalLikes = (countryLikes ?? 0) + (eventLikes ?? 0);
  const yearStats = selectedYear !== null ? buildYearStats(selectedYear, countries, events) : null;

  const badges = evaluateBadges(allTime);
  const unlockedCount = badges.filter((b) => b.isUnlocked).length;
  const repeated = mostRepeatedTitle(events);
  const topRatedAllTime =
    [...events].filter((e) => e.rating != null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0] ?? null;

  const scopeCodes = yearStats
    ? countryRows.filter((c) => c.country_visits.some((v) => v.year === selectedYear)).map((c) => c.country_code)
    : allCodes;
  const scopeContinents = continentCounts(yearStats ? yearStats.countryCodes : countries.map((c) => c.country_code));
  const scopeEventsByType = yearStats ? yearStats.eventsByType : allTime.eventsByType;

  const yearBreakdown = years.map((y) => {
    const ys = buildYearStats(y, countries, events);
    return { year: y, countries: ys.countryCodes.length, events: ys.events.length };
  });

  return (
    <div className="mx-auto max-w-shell px-5 py-10">
      <p className="eyebrow">Stats</p>
      <h1 className="mt-2 text-3xl md:text-4xl">Your world, by the numbers.</h1>

      {!hasAnyData ? (
        <div className="mt-10">
          <EmptyState
            title="Nothing to measure yet."
            body="Add a country or log your first event, and your stats and badges will start filling in here."
            actionLabel="Start with My World"
            actionHref="/my-world"
          />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/stats?year=all"
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm",
                selectedYear === null ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"
              )}
            >
              All time
            </Link>
            {[...years].reverse().map((y) => (
              <Link
                key={y}
                href={`/stats?year=${y}`}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm",
                  selectedYear === y ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"
                )}
              >
                {y}
              </Link>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
            {yearStats ? (
              <>
                <StatCard label="Countries" value={yearStats.countryCodes.length} detail={`${yearStats.newCountryCodes.length} new to you`} />
                <StatCard label="Continents" value={`${yearStats.continentsVisited}/6`} detail="touched this year" />
                <StatCard label="Events logged" value={yearStats.events.length} detail="this year" />
                <StatCard label="Memories added" value={yearStats.photos + yearStats.videos} detail="photos & videos" />
              </>
            ) : (
              <>
                <StatCard label="Countries" value={allTime.totalCountries} detail={`of ${TOTAL_COUNTRIES} recognised countries`} />
                <StatCard label="Continents" value={`${allTime.continentsVisited}/6`} detail="visited" />
                <StatCard label="Events logged" value={allTime.totalEvents} detail="across every type" />
                <StatCard label="Memories added" value={allTime.totalPhotos + allTime.totalVideos} detail="photos & videos" />
              </>
            )}
            <StatCard className="col-span-2 lg:col-span-1" label="Likes received" value={totalLikes} detail={selectedYear !== null ? `in ${selectedYear}, only you see this` : "only you see this"} />
          </div>

          <div className="mt-8 overflow-hidden rounded-card border border-line bg-surface p-1.5 sm:p-3">
            <WorldMap visitedCodes={scopeCodes} interactive={false} />
          </div>

          <section className="mt-10">
            <h2 className="text-xl">By continent</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {scopeContinents.map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: CONTINENT_COLORS[c.name] }} />
                      {c.name}
                    </span>
                    <span className="text-muted">{c.visited}/{c.total}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${c.total ? (c.visited / c.total) * 100 : 0}%`, backgroundColor: CONTINENT_COLORS[c.name] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {(yearStats ? yearStats.events.length : allTime.totalEvents) > 0 && (
            <section className="mt-10">
              <h2 className="text-xl">Events by type</h2>
              <ul className="mt-4 flex flex-wrap gap-2.5">
                {EVENT_TYPES.map((t) => {
                  const count = scopeEventsByType[t.value];
                  if (count === 0) return null;
                  return (
                    <li key={t.value} className="flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm">
                      <t.icon size={14} className="text-accent" aria-hidden />
                      {t.label} <span className="text-xs text-muted">×{count}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {(yearStats?.topRated || yearStats?.longestTripDays || (!yearStats && (topRatedAllTime || repeated))) && (
            <section className="mt-10 grid gap-4 sm:grid-cols-2">
              {yearStats?.topRated && (
                <div className="card px-5 py-5">
                  <p className="eyebrow">Highest rated this year</p>
                  <p className="mt-2 font-serif text-lg">{yearStats.topRated.title}</p>
                  <p className="mt-1 text-sm text-muted">{yearStats.topRated.rating}/10</p>
                </div>
              )}
              {yearStats?.longestTripDays && (
                <div className="card px-5 py-5">
                  <p className="eyebrow">Longest trip this year</p>
                  <p className="stat-number mt-2">{yearStats.longestTripDays} days</p>
                </div>
              )}
              {!yearStats && topRatedAllTime && (
                <div className="card px-5 py-5">
                  <p className="eyebrow">Highest rated ever</p>
                  <p className="mt-2 font-serif text-lg">{topRatedAllTime.title}</p>
                  <p className="mt-1 text-sm text-muted">{topRatedAllTime.rating}/10</p>
                </div>
              )}
              {!yearStats && repeated && (
                <div className="card px-5 py-5">
                  <p className="eyebrow">Most repeated</p>
                  <p className="mt-2 font-serif text-lg">{repeated.title}</p>
                  <p className="mt-1 text-sm text-muted">logged {repeated.count} times</p>
                </div>
              )}
            </section>
          )}

          {yearBreakdown.length > 1 && (
            <section className="mt-10">
              <h2 className="text-xl">Year by year</h2>
              <YearByYear years={yearBreakdown} />
            </section>
          )}

          <section id="badges" className="mt-12 border-t border-line pt-10">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl">Badges</h2>
              <p className="text-sm text-muted">{unlockedCount}/{badges.length} unlocked</p>
            </div>
            {profile && (
              <div className="mt-6">
                <EarlyExplorerBadge signupNumber={profile.signup_number} />
              </div>
            )}
            {invitedCount >= CONNECTOR_TARGET ? (
              <ConnectorBadge count={invitedCount} className="mt-4" />
            ) : (
              <Link href="/invite" className="mt-4 flex items-center gap-3 rounded-card border border-dashed border-accent/40 px-4 py-3 hover:border-accent">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Users size={18} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Connector</span>
                  <span className="block text-xs text-muted">
                    {invitedCount} of {CONNECTOR_TARGET} friends joined with your invite link. Invite friends →
                  </span>
                </span>
              </Link>
            )}
            <div className="mt-6">
              <BadgeGrid badges={badges} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

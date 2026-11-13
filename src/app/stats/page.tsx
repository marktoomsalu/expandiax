import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { StatDrills, type Drill, type DrillItem, type StatTile } from "@/components/StatDrills";
import { BadgeGrid } from "@/components/BadgeGrid";
import { EarlyExplorerBadge } from "@/components/EarlyExplorerBadge";
import { WorldMap } from "@/components/WorldMap";
import { EmptyState } from "@/components/EmptyState";
import { YearByYear } from "@/components/YearByYear";
import { CONTINENT_COLORS, CONTINENTS, TOTAL_COUNTRIES, continentCounts, countryByCode } from "@/lib/countries";
import { TOTAL_TERRITORIES, isTerritoryCode, territoryByCode, territoryFlag } from "@/lib/territories";
import { EVENT_TYPES, eventTypeMeta } from "@/lib/events";
import { formatDate } from "@/lib/utils";
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

  const [{ data: invitedRaw }, { data: connectsRaw }] = await Promise.all([
    supabase.rpc("invite_count", { p_user: user.id }),
    supabase.rpc("world_connect_count", { p_user: user.id }),
  ]);
  const invitedCount = typeof invitedRaw === "number" ? invitedRaw : 0;
  const worldConnects = typeof connectsRaw === "number" ? connectsRaw : 0;

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

  const badges = evaluateBadges(allTime, { invitedFriends: invitedCount, worldConnects, antarctica: allCodes.includes("AQ") });
  const unlockedCount = badges.filter((b) => b.isUnlocked).length;
  const repeated = mostRepeatedTitle(events);
  const topRatedAllTime =
    [...events].filter((e) => e.rating != null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0] ?? null;

  const scopeCodes = yearStats
    ? countryRows.filter((c) => c.country_visits.some((v) => v.year === selectedYear)).map((c) => c.country_code)
    : allCodes;
  const scopeContinents = continentCounts(yearStats ? yearStats.countryCodes : countries.map((c) => c.country_code));
  const scopeEventsByType = yearStats ? yearStats.eventsByType : allTime.eventsByType;

  // ---- What's behind each number (StatDrills), for the period picked ----
  const inScope = (c: CountryRow) => selectedYear === null || c.country_visits.some((v) => v.year === selectedYear);
  const yearsOf = (c: CountryRow) => [...new Set(c.country_visits.map((v) => v.year))].sort((a, b) => b - a).join(" · ");
  const lastYear = (c: CountryRow) => Math.max(0, ...c.country_visits.map((v) => v.year));
  const scopeCountryRows = realCountryRows.filter(inScope);
  const scopeTerritoryRows = countryRows.filter((c) => isTerritoryCode(c.country_code) && inScope(c));
  const countryItem = (c: CountryRow): DrillItem => {
    const meta = countryByCode(c.country_code);
    return { key: c.id, primary: meta?.name ?? c.country_code, flag: meta?.flag, secondary: yearsOf(c) || undefined, href: `/my-world/${c.country_code.toLowerCase()}` };
  };
  const byRecent = (a: CountryRow, b: CountryRow) => lastYear(b) - lastYear(a) || (countryByCode(a.country_code)?.name ?? "").localeCompare(countryByCode(b.country_code)?.name ?? "");
  const scopeEventRows = (yearStats ? eventRows.filter((e) => e.event_date.startsWith(String(selectedYear))) : eventRows).slice().sort((a, b) => b.event_date.localeCompare(a.event_date));
  const period = selectedYear === null ? "" : ` in ${selectedYear}`;

  const drills: Record<string, Drill> = {
    countries: { title: `Countries${period}`, items: scopeCountryRows.slice().sort(byRecent).map(countryItem), empty: "No countries yet." },
    territories: {
      title: `Territories${period}`,
      items: scopeTerritoryRows.map((c) => {
        const t = territoryByCode(c.country_code);
        return { key: c.id, primary: t?.name ?? c.country_code, flag: territoryFlag(c.country_code), secondary: yearsOf(c) || undefined, href: `/my-world/${c.country_code.toLowerCase()}` };
      }),
      empty: "No territories yet: places like Greenland, Gibraltar or Antarctica count here.",
    },
    continents: {
      title: `By continent${period}`,
      groups: CONTINENTS.map((name) => ({
        name,
        color: CONTINENT_COLORS[name],
        items: scopeCountryRows.filter((c) => countryByCode(c.country_code)?.continent === name).sort(byRecent).map(countryItem),
      })).filter((g) => g.items.length > 0),
    },
    events: {
      title: `Events${period}`,
      items: scopeEventRows.map((e) => ({
        key: e.id,
        primary: e.title,
        flag: countryByCode(e.country_code)?.flag,
        secondary: `${eventTypeMeta(e.event_type).label} · ${formatDate(e.event_date)}`,
        href: `/events/${e.id}`,
      })),
      empty: "No events yet.",
    },
    memories: {
      title: "Where your photos and videos are",
      items: [
        ...scopeCountryRows.map((c) => ({ c, n: c.country_media?.length ?? 0 })).filter((x) => x.n > 0).map(({ c, n }) => ({ ...countryItem(c), secondary: `${n} ${n === 1 ? "photo or video" : "photos & videos"}`, n })),
        ...scopeEventRows
          .map((e) => ({ e, n: (e.event_media ?? []).length }))
          .filter((x) => x.n > 0)
          .map(({ e, n }) => ({ key: e.id, primary: e.title, flag: countryByCode(e.country_code)?.flag, secondary: `${n} ${n === 1 ? "photo or video" : "photos & videos"}`, href: `/events/${e.id}`, n })),
      ]
        .sort((a, b) => b.n - a.n)
        .slice(0, 30)
        .map((x): DrillItem => ({ key: x.key, primary: x.primary, flag: x.flag, secondary: x.secondary, href: x.href })),
      empty: "No photos or videos yet.",
    },
  };

  const tiles: StatTile[] = yearStats
    ? [
        { key: "countries", label: "Countries", value: yearStats.countryCodes.length, detail: `${yearStats.newCountryCodes.length} new to you`, drill: drills.countries },
        { key: "territories", label: "Territories", value: scopeTerritoryRows.length, detail: "this year", drill: drills.territories },
        { key: "continents", label: "Continents", value: `${yearStats.continentsVisited}/6`, detail: "touched this year", drill: drills.continents },
        { key: "events", label: "Events logged", value: yearStats.events.length, detail: "this year", drill: drills.events },
        { key: "memories", label: "Memories added", value: yearStats.photos + yearStats.videos, detail: "photos & videos", drill: drills.memories },
      ]
    : [
        { key: "countries", label: "Countries", value: allTime.totalCountries, detail: `of ${TOTAL_COUNTRIES} recognised countries`, drill: drills.countries },
        { key: "territories", label: "Territories", value: scopeTerritoryRows.length, detail: `of ${TOTAL_TERRITORIES} territories`, drill: drills.territories },
        { key: "continents", label: "Continents", value: `${allTime.continentsVisited}/6`, detail: "visited", drill: drills.continents },
        { key: "events", label: "Events logged", value: allTime.totalEvents, detail: "across every type", drill: drills.events },
        { key: "memories", label: "Memories added", value: allTime.totalPhotos + allTime.totalVideos, detail: "photos & videos", drill: drills.memories },
      ];
  tiles.push({ key: "likes", label: "Likes received", value: totalLikes, detail: selectedYear !== null ? `in ${selectedYear}, only you see this` : "only you see this" });

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

          {/* Tap a number to see what's behind it. */}
          <StatDrills tiles={tiles} className="mt-8" />

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

          {/* Opened at #badges: room for the header above it, so nothing's cut off. */}
          <section id="badges" className="mt-12 scroll-mt-[calc(env(safe-area-inset-top)+76px)] border-t border-line pt-10">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl">Badges</h2>
              <p className="text-sm text-muted">{unlockedCount}/{badges.length} unlocked</p>
            </div>
            {profile && (
              <div className="mt-6">
                <EarlyExplorerBadge signupNumber={profile.signup_number} />
              </div>
            )}
            <div className="mt-6">
              <BadgeGrid badges={badges} actions />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

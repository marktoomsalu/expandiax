import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/StatCard";
import { BadgeGrid } from "@/components/BadgeGrid";
import { WorldMap } from "@/components/WorldMap";
import { EmptyState } from "@/components/EmptyState";
import { CONTINENT_COLORS, TOTAL_COUNTRIES, continentCounts } from "@/lib/countries";
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

export const metadata = { title: "Stats" };

type CountryRow = {
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: countriesData }, { data: eventsData }] = await Promise.all([
    supabase
      .from("visited_countries")
      .select(
        "country_code, is_favourite, country_visits(year, visited_from, visited_to), country_media!country_media_visited_country_id_fkey(id)"
      )
      .eq("user_id", user.id),
    supabase
      .from("events")
      .select(
        "id, title, country_code, event_type, event_date, rating, is_favourite, event_media!event_media_event_id_fkey(id, media_type)"
      )
      .eq("user_id", user.id),
  ]);

  const countryRows = (countriesData ?? []) as CountryRow[];
  const eventRows = (eventsData ?? []) as EventRow[];

  const countries: CountryStatInput[] = countryRows.map((c) => ({
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
  const yearStats = selectedYear !== null ? buildYearStats(selectedYear, countries, events) : null;

  const badges = evaluateBadges(allTime);
  const unlockedCount = badges.filter((b) => b.isUnlocked).length;
  const repeated = mostRepeatedTitle(events);
  const topRatedAllTime =
    [...events].filter((e) => e.rating != null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0] ?? null;

  const scopeCodes = yearStats ? yearStats.countryCodes : countries.map((c) => c.country_code);
  const scopeContinents = continentCounts(scopeCodes);
  const scopeEventsByType = yearStats ? yearStats.eventsByType : allTime.eventsByType;

  const yearBreakdown = years.map((y) => {
    const ys = buildYearStats(y, countries, events);
    return { year: y, countries: ys.countryCodes.length, events: ys.events.length };
  });
  const maxYearCountries = Math.max(1, ...yearBreakdown.map((y) => y.countries));
  const maxYearEvents = Math.max(1, ...yearBreakdown.map((y) => y.events));

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

          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
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
              <div className="mt-4 space-y-3">
                {[...yearBreakdown].reverse().map((y) => (
                  <div key={y.year} className="flex items-center gap-3 text-sm">
                    <span className="w-12 shrink-0 text-muted">{y.year}</span>
                    <div className="flex-1 space-y-1">
                      <div className="h-2 overflow-hidden rounded-full bg-raised">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${(y.countries / maxYearCountries) * 100}%` }} />
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-raised">
                        <div className="h-full rounded-full bg-ink/30" style={{ width: `${(y.events / maxYearEvents) * 100}%` }} />
                      </div>
                    </div>
                    <span className="w-20 shrink-0 text-right text-xs text-muted">{y.countries}c · {y.events}e</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 flex items-center gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-2 w-2 rounded-full bg-accent" /> countries</span>
                <span className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-2 w-2 rounded-full bg-ink/30" /> events</span>
              </p>
            </section>
          )}

          <section id="badges" className="mt-12 border-t border-line pt-10">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl">Badges</h2>
              <p className="text-sm text-muted">{unlockedCount}/{badges.length} unlocked</p>
            </div>
            <div className="mt-6">
              <BadgeGrid badges={badges} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

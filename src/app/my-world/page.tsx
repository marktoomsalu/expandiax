import Link from "next/link";
import { BarChart3, ImagePlus, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { MapNavigator } from "@/components/MapNavigator";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { ContinentCard } from "@/components/ContinentCard";
import { CountryGrid } from "@/components/CountryGrid";
import { COUNTRIES, CONTINENT_COLORS, TOTAL_COUNTRIES, continentCounts, countryByCode } from "@/lib/countries";
import { isTerritoryCode, TOTAL_TERRITORIES } from "@/lib/territories";
import { visitSortKey } from "@/lib/utils";
import { stockPhotoFor, type StockPhoto } from "@/lib/stockPhotos";
import type { VisitedCountry, CountryMedia } from "@/lib/types";

export const metadata = { title: "My World" };

type VisitLite = { year: number; visited_from: string | null; visited_to: string | null };
type Row = VisitedCountry & { country_media: CountryMedia[]; country_visits: VisitLite[] };

// When you actually travelled, not when you happened to add it to the app —
// falls back to the entry date only if no visit year/date was ever logged.
function travelRecency(c: Row): string {
  const dates = c.country_visits.map(visitSortKey);
  return dates.length > 0 ? dates.sort().at(-1)! : c.created_at.slice(0, 10);
}

export default async function MyWorldPage() {
  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");

  const [{ data }, { data: profile }] = await Promise.all([
    supabase
      .from("visited_countries")
      .select("*, country_media!country_media_visited_country_id_fkey(*), country_visits(year, visited_from, visited_to)")
      .eq("user_id", user.id),
    supabase.from("profiles").select("home_country_code").eq("id", user.id).single(),
  ]);

  // Territories (Greenland, Gibraltar, etc.) live in this same table now —
  // codes/visitCounts stay unfiltered (so they show on the map and in "Your
  // countries" below), but the 195-count/%/continents specifically only
  // ever look at real countries.
  const byRecency = [...((data ?? []) as Row[])].sort((a, b) => travelRecency(b).localeCompare(travelRecency(a)));
  // Countries added (e.g. via onboarding) with no photos and no logged
  // visit yet sink to the bottom of the grid — they're a to-do, not
  // something worth the same prime real estate as a filled-in trip.
  const hasContent = (c: Row) => c.country_media.length > 0 || c.country_visits.length > 0;
  const countries = [...byRecency.filter(hasContent), ...byRecency.filter((c) => !hasContent(c))];
  // Countries without a photo of their own show a stock one, and the nudge
  // points at the most recent of them.
  const withoutPhotos = countries.filter((c) => c.country_media.length === 0);
  const stock: Record<string, StockPhoto> = {};
  for (const c of withoutPhotos) {
    const photo = stockPhotoFor(c.country_code, user.id);
    if (photo) stock[c.country_code] = photo;
  }
  const realCountries = countries.filter((c) => !isTerritoryCode(c.country_code));
  const territoryCount = countries.length - realCountries.length;
  const codes = countries.map((c) => c.country_code);
  const countryCodes = realCountries.map((c) => c.country_code);
  const visitCounts = Object.fromEntries(countries.map((c) => [c.country_code, c.country_visits.length]));
  const pct = Math.round((countryCodes.length / TOTAL_COUNTRIES) * 1000) / 10;
  const continents = continentCounts(countryCodes);
  const visitedContinents = continents.filter((c) => c.visited > 0).length;
  const visitedSet = new Set(codes);
  const countriesByContinent = new Map<
    string,
    { code: string; name: string; flag: string; visited: boolean; count: number }[]
  >();
  for (const c of COUNTRIES) {
    const list = countriesByContinent.get(c.continent) ?? [];
    list.push({ code: c.code, name: c.name, flag: c.flag, visited: visitedSet.has(c.code), count: visitCounts[c.code] ?? 0 });
    countriesByContinent.set(c.continent, list);
  }
  for (const list of countriesByContinent.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  const latest = byRecency[0];

  return (
    <div className="mx-auto max-w-shell px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">My World</p>
          <h1 className="mt-2 text-3xl md:text-4xl">
            {codes.length === 0 ? "Your map, still quiet." : `${countryCodes.length} of ${TOTAL_COUNTRIES} countries.`}
          </h1>
        </div>
        {latest && (
          <p className="text-sm text-muted">
            Most recent: <Link href={`/my-world/${latest.country_code.toLowerCase()}`} className="text-accent underline-offset-4 hover:underline">{countryByCode(latest.country_code)?.flag} {latest.country_name}</Link>
          </p>
        )}
        <div className="flex items-center gap-3">
          <Link href="/stats" className="btn-ghost !py-2 text-sm"><BarChart3 size={16} /> Stats</Link>
          <Link href="#country-search" className="btn-accent"><Plus size={17} /> Add country</Link>
        </div>
      </div>

      <div className="mt-8">
        <MapNavigator visitedCodes={codes} visitCounts={visitCounts} homeCode={profile?.home_country_code} />
      </div>

      {codes.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Your world is waiting."
            body="Mark the first country you have visited and begin building your personal map. Search above or tap any country."
            actionLabel="Find your first country"
            actionHref="/my-world/ee"
          />
        </div>
      ) : (
        <>
          <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Countries" value={countryCodes.length} detail={`of ${TOTAL_COUNTRIES} recognised countries`} />
            {territoryCount > 0 && (
              <StatCard label="Territories" value={territoryCount} detail={`of ${TOTAL_TERRITORIES} tracked - separate from your 195`} />
            )}
            <StatCard label="World explored" value={`${pct}%`} detail="and counting" />
            <StatCard label="Continents" value={`${visitedContinents}/6`} detail="have your footprints" />
            <StatCard label="Photos kept" value={realCountries.reduce((n, c) => n + c.country_media.length, 0)} detail="memories in your archive" />
          </div>

          <section className="mt-10" aria-labelledby="continents-h">
            <h2 id="continents-h" className="text-xl">By continent</h2>
            <p className="mt-1 text-xs text-muted">Tap a continent to see which countries you&rsquo;ve visited there.</p>
            <div className="mt-4 grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {continents.map((c) => (
                <ContinentCard
                  key={c.name}
                  name={c.name}
                  color={CONTINENT_COLORS[c.name]}
                  visited={c.visited}
                  total={c.total}
                  countries={countriesByContinent.get(c.name) ?? []}
                />
              ))}
            </div>
          </section>

          <section className="mt-10" aria-labelledby="countries-h">
            <h2 id="countries-h" className="text-xl">Your countries</h2>
            {withoutPhotos.length > 0 && (
              <Link
                href={`/my-world/${withoutPhotos[0].country_code.toLowerCase()}`}
                className="card mt-4 flex items-center gap-3 px-4 py-3.5 transition-shadow hover:shadow-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <ImagePlus size={18} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {withoutPhotos.length === 1 ? "1 country is" : `${withoutPhotos.length} countries are`} waiting for your photos
                  </span>
                  <span className="block truncate text-xs text-muted">
                    Start with {withoutPhotos[0].country_name} - add a few photos and a line about the trip.
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-accent">Add →</span>
              </Link>
            )}
            <div className="mt-4">
              <CountryGrid countries={countries} stock={stock} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

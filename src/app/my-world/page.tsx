import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MapNavigator } from "@/components/MapNavigator";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { CONTINENT_COLORS, TOTAL_COUNTRIES, continentCounts, countryByCode } from "@/lib/countries";
import type { VisitedCountry, CountryMedia } from "@/lib/types";

export const metadata = { title: "My World" };

type Row = VisitedCountry & { country_media: CountryMedia[]; country_visits: { year: number }[] };

export default async function MyWorldPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data } = await supabase
    .from("visited_countries")
    .select("*, country_media!country_media_visited_country_id_fkey(*), country_visits(year)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const countries = (data ?? []) as Row[];
  const codes = countries.map((c) => c.country_code);
  const pct = Math.round((codes.length / TOTAL_COUNTRIES) * 1000) / 10;
  const continents = continentCounts(codes);
  const visitedContinents = continents.filter((c) => c.visited > 0).length;
  const latest = countries[0];

  return (
    <div className="mx-auto max-w-shell px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">My World</p>
          <h1 className="mt-2 text-3xl md:text-4xl">
            {codes.length === 0 ? "Your map, still quiet." : `${codes.length} of ${TOTAL_COUNTRIES} countries.`}
          </h1>
        </div>
        {latest && (
          <p className="text-sm text-muted">
            Most recent: <Link href={`/my-world/${latest.country_code.toLowerCase()}`} className="text-accent underline-offset-4 hover:underline">{countryByCode(latest.country_code)?.flag} {latest.country_name}</Link>
          </p>
        )}
      </div>

      <div className="mt-8">
        <MapNavigator visitedCodes={codes} />
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
            <StatCard label="Countries" value={codes.length} detail={`of ${TOTAL_COUNTRIES} recognised countries`} />
            <StatCard label="World explored" value={`${pct}%`} detail="and counting" />
            <StatCard label="Continents" value={`${visitedContinents}/6`} detail="have your footprints" />
            <StatCard label="Photos kept" value={countries.reduce((n, c) => n + c.country_media.length, 0)} detail="memories in your archive" />
          </div>

          <section className="mt-10" aria-labelledby="continents-h">
            <h2 id="continents-h" className="text-xl">By continent</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {continents.map((c) => {
                const color = CONTINENT_COLORS[c.name];
                return (
                  <div key={c.name} className="card px-4 py-3">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                        {c.name}
                      </span>
                      <span className="text-muted">{c.visited} / {c.total}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised" role="progressbar" aria-label={`${c.name} progress`} aria-valuenow={c.visited} aria-valuemin={0} aria-valuemax={c.total}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${c.total ? (c.visited / c.total) * 100 : 0}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-10" aria-labelledby="countries-h">
            <h2 id="countries-h" className="text-xl">Your countries</h2>
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {countries.map((c) => {
                const meta = countryByCode(c.country_code);
                const cover =
                  c.country_media.find((m) => m.id === c.cover_media_id) ??
                  [...c.country_media].sort((a, b) => a.display_order - b.display_order)[0];
                const years = [...new Set(c.country_visits.map((v) => v.year))].sort();
                return (
                  <li key={c.id}>
                    <Link href={`/my-world/${c.country_code.toLowerCase()}`} className="card group block overflow-hidden transition-shadow hover:shadow-lg">
                      <div className="relative aspect-[3/4] bg-raised">
                        {cover ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={cover.public_url} alt={cover.caption || `Photo from ${c.country_name}`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" aria-hidden />
                            <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-12 text-white">
                              <p className="font-serif text-xl drop-shadow-sm">{meta?.flag} {c.country_name}</p>
                              <p className="mt-0.5 text-xs text-white/75">
                                {years.length ? years.join(" · ") : "Add your visit years"}
                              </p>
                            </div>
                          </>
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                            <span className="font-serif text-5xl opacity-60" aria-hidden>{meta?.flag}</span>
                            <div>
                              <p className="font-serif text-lg">{c.country_name}</p>
                              <p className="mt-0.5 text-xs text-muted">
                                {years.length ? years.join(" · ") : "Add your visit years"}
                              </p>
                            </div>
                          </div>
                        )}
                        {c.is_favourite && (
                          <span className="absolute left-3 top-3 rounded-full bg-canvas/90 px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-wide text-accent">Favourite</span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

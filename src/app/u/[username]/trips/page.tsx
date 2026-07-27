import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { formatVisitRange, visitSortKey } from "@/lib/utils";
import type { CountryMedia, CountryVisit, VisitedCountry } from "@/lib/types";

export const metadata = { title: "Trips" };

const PAGE_SIZE = 30;

type VisitLite = Pick<CountryVisit, "id" | "year" | "visited_from" | "visited_to" | "date_precision" | "highlight">;
type CountryRow = VisitedCountry & { country_media: CountryMedia[]; country_visits: VisitLite[] };
type TripCard = { visit: VisitLite; countryCode: string; countryName: string; cover?: CountryMedia };

export default async function AllTripsPage({
  params,
  searchParams,
}: {
  params: { username: string };
  searchParams?: { limit?: string };
}) {
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", params.username.toLowerCase())
    .maybeSingle();

  if (!profile) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="text-3xl">This world is private.</h1>
        <p className="mt-3 text-sm text-muted">The profile doesn&rsquo;t exist, or its owner keeps it to themselves.</p>
        <Link href="/explore" className="btn-ghost mt-8">Explore public travellers</Link>
      </div>
    );
  }

  const limit = Math.min(Math.max(Number(searchParams?.limit) || PAGE_SIZE, PAGE_SIZE), 300);

  const { data } = await supabase
    .from("visited_countries")
    .select("country_code, country_name, cover_media_id, country_media!country_media_visited_country_id_fkey(*), country_visits(id, year, visited_from, visited_to, date_precision, highlight)")
    .eq("user_id", profile.id);

  const countries = (data ?? []) as CountryRow[];
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
  const trips = allTrips.slice(0, limit);

  return (
    <div className="mx-auto max-w-shell px-5 py-10">
      <Link href={`/u/${profile.username}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> {profile.display_name}
      </Link>
      <p className="eyebrow mt-8">{profile.display_name}</p>
      <h1 className="mt-1 text-3xl md:text-4xl">All trips.</h1>

      {trips.length === 0 ? (
        <p className="mt-10 text-sm text-muted">No trips logged yet.</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map(({ visit, countryCode, countryName, cover }) => {
            const meta = countryByCode(countryCode);
            return (
              <li key={visit.id}>
                <Link href={`/u/${profile.username}/countries/${countryCode.toLowerCase()}`} className="card group block overflow-hidden">
                  {cover && (
                    <div className="relative aspect-[16/8] w-full">
                      <Image
                        src={cover.public_url}
                        alt={cover.caption || `Photo from ${countryName}`}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                    </div>
                  )}
                  <div className="px-5 py-4">
                    <p className="eyebrow">{formatVisitRange(visit)}</p>
                    <p className="mt-1 font-serif text-xl">{meta?.flag} {countryName}</p>
                    {visit.highlight && <p className="mt-1.5 line-clamp-2 text-sm italic leading-relaxed text-muted">&ldquo;{visit.highlight}&rdquo;</p>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {trips.length >= limit && allTrips.length > limit && (
        <div className="mt-8 flex justify-center">
          <Link href={`/u/${profile.username}/trips?limit=${limit + PAGE_SIZE}`} className="btn-ghost">
            Load more
          </Link>
        </div>
      )}
    </div>
  );
}

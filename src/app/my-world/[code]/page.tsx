import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { territoryByCode, territoryToMeta } from "@/lib/territories";
import { CountryEditor, AddCountryForm } from "@/components/CountryEditor";
import { CountryHero } from "@/components/CountryHero";
import { stockPhotoFor } from "@/lib/stockPhotos";
import { countrySummary } from "@/lib/tripPlaces";
import { buildCountryView } from "@/lib/countryView";
import { CountryPlaces } from "@/components/CountryPlaces";
import type { VisitedCountryFull } from "@/lib/types";
import { signMedia } from "@/lib/signedMedia";

export default async function ManageCountryPage({ params }: { params: { code: string } }) {
  const country = countryByCode(params.code);
  const territory = country ? null : territoryByCode(params.code);
  const meta = country ?? (territory ? territoryToMeta(territory) : null);
  if (!meta) notFound();
  const isTerritory = !!territory;

  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");

  const [{ data: profile }, { data }] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", user.id).single(),
    supabase
      .from("visited_countries")
      .select("*, country_visits(*), country_cities(*), country_media!country_media_visited_country_id_fkey(*)")
      .eq("user_id", user.id)
      .eq("country_code", meta.code)
      .maybeSingle(),
  ]).then((r) => signMedia(r));

  const visited = data as VisitedCountryFull | null;
  if (visited && profile) {
    const { visits, cities, heroPhoto, trips, places } = buildCountryView(visited, meta);
    const base = `/my-world/${meta.code.toLowerCase()}`;
    // A place opens on its most recent trip, scrolled to that place.
    const placeHref = (cityIds: string[]) => {
      const c = visits.map((v) => cities.find((x) => x.country_visit_id === v.id && cityIds.includes(x.id))).find(Boolean);
      return c ? `${base}/visits/${c.country_visit_id}#place-${c.id}` : base;
    };

    return (
      <div>
        <CountryHero
          visitedCountryId={visited.id}
          flag={meta.flag}
          name={meta.name}
          continent={meta.continent}
          isTerritory={isTerritory}
          onlyMe={!visited.is_public}
          summary={countrySummary(visits, places.length, visited.country_media.length)}
          photo={heroPhoto?.public_url ?? null}
          stock={heroPhoto ? null : stockPhotoFor(meta.code, user.id)}
          publicHref={`/explore/country/${meta.code.toLowerCase()}`}
          initialFavourite={visited.is_favourite}
        />
        <div className="mx-auto max-w-3xl space-y-8 px-5 pb-16 pt-8">
          {meta.code === "US" && (
            <div className="card flex flex-wrap items-center justify-between gap-4 border-accent/30 bg-accent-soft/40 px-5 py-4">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <MapPin size={15} className="text-accent" aria-hidden /> Track your US states too
                </p>
                <p className="mt-1 text-xs text-muted">
                  See exactly which states you&rsquo;ve explored, on their own map alongside your world map.
                </p>
              </div>
              <Link href="/my-world/states" className="btn-accent shrink-0 !py-2 text-sm">
                <MapPin size={15} /> Add US States
              </Link>
            </div>
          )}
          <CountryPlaces places={places} countryCode={meta.code} hrefFor={placeHref} />
          <CountryEditor data={visited} meta={meta} trips={trips} />
        </div>
      </div>
    );
  }

  // Not on the map yet: add it.
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/my-world" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> My World
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2">
            {meta.continent}
            {isTerritory && (
              <span className="rounded-full border border-line px-2 py-0.5 text-[0.625rem] font-medium normal-case tracking-normal text-muted">
                Territory
              </span>
            )}
          </p>
          <h1 className="mt-1 text-4xl md:text-5xl">
            <span aria-hidden className="mr-2">{meta.flag}</span>
            {meta.name}
          </h1>
        </div>
      </div>

      <div className="mt-10">
        <div className="card px-6 py-10 text-center">
          <h2 className="font-serif text-2xl">Not on your map yet.</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Add your first trip - photos and a soundtrack live with it, right after.
          </p>
          <div className="mt-6">
            <AddCountryForm meta={meta} />
          </div>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ChevronRight, Compass, MapPin, Plus } from "lucide-react";
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
import { locatePlaces } from "@/lib/locatePlaces";

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
  // Every place of every trip on the map, even ones saved without coordinates.
  if (visited) visited.country_cities = await locatePlaces(supabase, visited.country_cities, meta.code);
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
          {/* Your stays first, then the places they took you. */}
          <CountryEditor
            data={visited}
            meta={meta}
            trips={trips}
            afterTrips={places.length > 0 ? <CountryPlaces places={places} countryCode={meta.code} hrefFor={placeHref} /> : null}
          />
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

      {/* Two different things: look around (nothing gets added), or put it on your map. */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link
          href={`/explore/country/${meta.code.toLowerCase()}`}
          className="group flex items-start gap-3.5 rounded-2xl border border-line bg-surface p-4 shadow-sm transition-colors hover:border-accent"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Compass size={20} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 font-serif text-lg leading-tight">
              Explore {meta.name} <ChevronRight size={16} className="text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
            <span className="mt-0.5 block text-xs text-muted">Who&rsquo;s been, where they went and what they did. Ask them for tips. Nothing is added to your map.</span>
          </span>
        </Link>
        <a href="#add" className="group flex items-start gap-3.5 rounded-2xl border border-accent/40 bg-accent-soft/40 p-4 shadow-sm transition-colors hover:border-accent">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white">
            <Plus size={20} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-serif text-lg leading-tight">Add to My World</span>
            <span className="mt-0.5 block text-xs text-muted">Been here? Add your trip, or a time you lived here, with its photos.</span>
          </span>
        </a>
      </div>

      <div id="add" className="mt-8 scroll-mt-24">
        <div className="card px-6 py-10 text-center">
          <h2 className="font-serif text-2xl">Been to {meta.name}? Add it to your map</h2>
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

import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Home, Image as ImageIcon, Lock, MapPin } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { canSellPremium } from "@/lib/nativeAppServer";
import { countryByCode } from "@/lib/countries";
import { territoryByCode, territoryToMeta } from "@/lib/territories";
import { CountryEditor, AddCountryForm } from "@/components/CountryEditor";
import { CountryHero } from "@/components/CountryHero";
import { stockPhotoFor } from "@/lib/stockPhotos";
import { visitSortKey } from "@/lib/utils";
import { countrySummary, orderStops, placesInCountry, stayLength, stayMonth, stayWhen, tripName } from "@/lib/tripPlaces";
import { PlacesMap } from "@/components/PlacesMap";
import { StockImage } from "@/components/StockImage";
import type { StayView } from "@/components/StayRow";
import { COUNTRY_CAP } from "@/lib/plan";
import type { Plan, VisitedCountryFull } from "@/lib/types";
import { signMedia } from "@/lib/signedMedia";

/** "Kotor", "Kotor & Budva", "Kotor, Budva & Perast", "Kotor, Budva & 3 more". */
function listCities(cities: string[]): string {
  if (cities.length <= 1) return cities[0] ?? "";
  if (cities.length <= 3) return `${cities.slice(0, -1).join(", ")} & ${cities.at(-1)}`;
  return `${cities.slice(0, 2).join(", ")} & ${cities.length - 2} more`;
}

export default async function ManageCountryPage({ params }: { params: { code: string } }) {
  const country = countryByCode(params.code);
  const territory = country ? null : territoryByCode(params.code);
  const meta = country ?? (territory ? territoryToMeta(territory) : null);
  if (!meta) notFound();
  const isTerritory = !!territory;

  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");

  const [{ data: profile }, { data }, { count: countryCount }] = await Promise.all([
    supabase.from("profiles").select("username, plan").eq("id", user.id).single(),
    supabase
      .from("visited_countries")
      .select("*, country_visits(*), country_cities(*), country_media!country_media_visited_country_id_fkey(*)")
      .eq("user_id", user.id)
      .eq("country_code", meta.code)
      .maybeSingle(),
    supabase.from("visited_countries").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]).then((r) => signMedia(r));

  const visited = data as VisitedCountryFull | null;
  const plan = (profile?.plan ?? "free") as Plan;
  const countryCap = COUNTRY_CAP[plan];
  const atCountryCap = countryCap !== null && (countryCount ?? 0) >= countryCap;
  const needsPremiumForTerritory = isTerritory && plan !== "premium";
  const canSell = canSellPremium();
  if (visited && profile) {
    const visits = [...visited.country_visits].sort((a, b) => visitSortKey(b).localeCompare(visitSortKey(a)));
    const images = visited.country_media.filter((m) => m.media_type === "image").sort((a, b) => a.display_order - b.display_order);
    const tripCover = (visitId: string, coverId: string | null) => {
      const own = images.filter((m) => m.country_visit_id === visitId);
      return own.find((m) => m.id === coverId) ?? own[0];
    };
    // The country's picture: the one you chose, else your latest trip's, else any of yours.
    const heroPhoto =
      images.find((m) => m.id === visited.cover_media_id) ??
      (visits[0] ? tripCover(visits[0].id, visits[0].cover_media_id) : undefined) ??
      images[0];
    const cities = visited.country_cities ?? [];
    const base = `/my-world/${meta.code.toLowerCase()}`;
    const trips: StayView[] = visits.map((v, i) => {
      const media = visited.country_media.filter((m) => m.country_visit_id === v.id);
      const cover = tripCover(v.id, v.cover_media_id);
      const stops = orderStops(cities.filter((c) => c.country_visit_id === v.id)).map((c) => c.city_name);
      const prev = visits[i - 1];
      return {
        id: v.id,
        name: tripName(v, meta.name, stops[0]),
        kind: v.kind,
        places: stops.length ? listCities(stops) : v.highlight.trim() || null,
        when: stayWhen(v),
        length: stayLength(v),
        // The year shows where it changes; the month on every row that has one.
        railTop: !prev || prev.year !== v.year ? String(v.year) : null,
        railBottom: stayMonth(v),
        photos: media.filter((m) => m.media_type === "image").length,
        photo: cover?.public_url ?? null,
        // Different stock photo per trip, so an empty country doesn't repeat one picture.
        stock: cover ? null : stockPhotoFor(meta.code, v.id),
        mediaPaths: media.map((m) => m.storage_path),
      };
    });
    const places = placesInCountry(visits, cities, visited.country_media);
    const mappedPlaces = places.filter((p) => p.lat != null && p.lng != null);
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
          publicHref={visited.is_public ? `/u/${profile.username}/countries/${meta.code.toLowerCase()}` : null}
          initialFavourite={visited.is_favourite}
        />
        <div className="mx-auto max-w-3xl space-y-8 px-5 pb-16 pt-8">
          {meta.code === "US" && (plan === "premium" || canSell) && (
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
          {places.length > 0 && (
            <section aria-labelledby="places-h">
              <h2 id="places-h" className="font-serif text-2xl">
                Places in this country
              </h2>
              <ul className="no-scrollbar -mx-5 mt-3 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
                {places.map((p) => {
                  const placeStock = p.cover ? null : stockPhotoFor(meta.code, p.cityIds[0]);
                  const years = p.from && p.to ? (p.from.slice(0, 4) === p.to.slice(0, 4) ? p.from.slice(0, 4) : `${p.from.slice(0, 4)} – ${p.to.slice(0, 4)}`) : null;
                  return (
                    <li key={p.key} className="w-44 shrink-0 snap-start sm:w-52">
                      <Link href={placeHref(p.cityIds)} className="group relative block h-52 overflow-hidden rounded-2xl bg-[#14110d] shadow-sm ring-1 ring-black/5">
                        {p.cover ? (
                          <Image src={p.cover} alt="" fill sizes="208px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                        ) : placeStock ? (
                          <StockImage photo={placeStock} aspect="4:5" sizes="208px" className="opacity-80" />
                        ) : null}
                        <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" aria-hidden />
                        {p.lived && (
                          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-accent shadow">
                            <Home size={11} aria-hidden /> Lived here
                          </span>
                        )}
                        <span className="absolute inset-x-0 bottom-0 p-3 text-white">
                          <span className="block truncate font-serif text-lg leading-tight">{p.name}</span>
                          <span className="block text-xs text-white/80">
                            {p.trips} {p.trips === 1 ? (p.lived ? "stay" : "trip") : p.lived ? "visits" : "trips"}
                            {years ? ` · ${years}` : ""}
                          </span>
                          <span className="mt-1 flex items-center gap-1 text-xs text-white/80">
                            <ImageIcon size={12} aria-hidden /> {p.photos + p.videos}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {mappedPlaces.length > 0 && (
                <PlacesMap
                  className="mt-4"
                  points={mappedPlaces.map((p) => ({ id: p.key, name: p.name, lat: p.lat!, lng: p.lng!, label: `${p.trips} ${p.trips === 1 ? "visit" : "visits"}` }))}
                />
              )}
            </section>
          )}
          <CountryEditor data={visited} meta={meta} plan={plan} trips={trips} />
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
          {needsPremiumForTerritory ? (
            <>
              <Lock size={22} className="mx-auto mt-3 text-muted" aria-hidden />
              {canSell ? (
                <>
                  <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
                    {meta.name} is a special territory - tracking those is a Premium feature, separate from your 195-country limit.
                  </p>
                  <Link href="/settings/billing" className="btn-accent mt-5">Upgrade to Premium</Link>
                </>
              ) : (
                <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
                  {meta.name} is a special territory - tracking those isn&rsquo;t available on your account.
                </p>
              )}
            </>
          ) : atCountryCap ? (
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              {canSell ? (
                <>
                  You&rsquo;ve reached the free plan&rsquo;s {countryCap}-country limit.{" "}
                  <Link href="/settings/billing" className="text-accent underline-offset-4 hover:underline">
                    Upgrade to Premium
                  </Link>{" "}
                  to keep adding countries.
                </>
              ) : (
                <>You&rsquo;ve reached your {countryCap}-country limit.</>
              )}
            </p>
          ) : (
            <>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                Add your first trip - photos and a soundtrack live with it, right after.
              </p>
              <div className="mt-6">
                <AddCountryForm meta={meta} plan={plan} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

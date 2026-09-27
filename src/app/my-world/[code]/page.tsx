import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Lock, MapPin } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { canSellPremium } from "@/lib/nativeAppServer";
import { countryByCode } from "@/lib/countries";
import { territoryByCode, territoryToMeta } from "@/lib/territories";
import { CountryEditor, AddCountryForm, type TripView } from "@/components/CountryEditor";
import { CountryHero } from "@/components/CountryHero";
import { stockPhotoFor } from "@/lib/stockPhotos";
import { formatVisitRange, visitSortKey } from "@/lib/utils";
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
    const trips: TripView[] = visits.map((v) => {
      const media = visited.country_media.filter((m) => m.country_visit_id === v.id);
      const cover = tripCover(v.id, v.cover_media_id);
      const cities = (visited.country_cities ?? []).filter((c) => c.country_visit_id === v.id).map((c) => c.city_name);
      return {
        id: v.id,
        title: formatVisitRange(v),
        subtitle: cities.length ? listCities(cities) : v.highlight.trim() || null,
        photos: media.filter((m) => m.media_type === "image").length,
        videos: media.filter((m) => m.media_type === "video").length,
        hasSoundtrack: !!v.spotify_track_id,
        photo: cover?.public_url ?? null,
        // Different stock photo per trip, so an empty country doesn't repeat one picture.
        stock: cover ? null : stockPhotoFor(meta.code, v.id),
        mediaPaths: media.map((m) => m.storage_path),
      };
    });

    return (
      <div>
        <CountryHero
          visitedCountryId={visited.id}
          flag={meta.flag}
          name={meta.name}
          continent={meta.continent}
          isTerritory={isTerritory}
          onlyMe={!visited.is_public}
          trips={visits.length}
          memories={visited.country_media.length}
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

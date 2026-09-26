import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, ImagePlus, Lock, MapPin } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { canSellPremium } from "@/lib/nativeAppServer";
import { countryByCode } from "@/lib/countries";
import { territoryByCode, territoryToMeta } from "@/lib/territories";
import { CountryEditor, AddCountryForm } from "@/components/CountryEditor";
import { ShareButton } from "@/components/ShareButton";
import { StockCredit } from "@/components/StockCredit";
import { stockPhotoFor } from "@/lib/stockPhotos";
import { visitSortKey } from "@/lib/utils";
import { COUNTRY_CAP } from "@/lib/plan";
import type { Plan, VisitedCountryFull } from "@/lib/types";

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
      .select("*, country_visits(*), country_media!country_media_visited_country_id_fkey(*)")
      .eq("user_id", user.id)
      .eq("country_code", meta.code)
      .maybeSingle(),
    supabase.from("visited_countries").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  const visited = data as VisitedCountryFull | null;
  const plan = (profile?.plan ?? "free") as Plan;
  const countryCap = COUNTRY_CAP[plan];
  const atCountryCap = countryCap !== null && (countryCount ?? 0) >= countryCap;
  const needsPremiumForTerritory = isTerritory && plan !== "premium";
  const canSell = canSellPremium();
  const stock = visited && visited.country_media.length === 0 ? stockPhotoFor(meta.code, user.id) : null;
  const latestVisit = visited ? [...visited.country_visits].sort((a, b) => visitSortKey(b).localeCompare(visitSortKey(a)))[0] : undefined;

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
        {visited && profile && (
          <div className="flex items-center gap-5">
            <ShareButton kind="country" targetId={visited.id} title={`${meta.flag} ${meta.name}`} />
            <Link
              href={`/u/${profile.username}/countries/${meta.code.toLowerCase()}`}
              className="inline-flex items-center gap-1.5 text-sm text-accent underline-offset-4 hover:underline"
            >
              View public page <ExternalLink size={14} />
            </Link>
          </div>
        )}
      </div>

      {stock && visited && (
        // Nothing of their own here yet: a credited stock photo as a placeholder, and the way to replace it.
        <div className="relative mt-6 h-56 overflow-hidden rounded-2xl sm:h-72" style={{ backgroundColor: stock.color }}>
          <Image src={stock.src} alt={stock.alt} fill priority unoptimized sizes="(min-width: 768px) 768px, 100vw" className="object-cover saturate-[0.85]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/5" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <p className="font-serif text-2xl drop-shadow">This is Unsplash&rsquo;s {meta.name}. Show us yours.</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              {latestVisit ? (
                <Link
                  href={`/my-world/${meta.code.toLowerCase()}/visits/${latestVisit.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-2 text-sm font-semibold text-[#14110d] shadow-sm"
                >
                  <ImagePlus size={15} aria-hidden /> Add your photos
                </Link>
              ) : (
                <span className="text-sm text-white/85">Add a trip below, then your photos.</span>
              )}
              <StockCredit photo={stock} />
            </div>
          </div>
        </div>
      )}

      <div className="mt-10">
        {!visited ? (
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
        ) : (
          <div className="space-y-8">
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
            <CountryEditor data={visited} meta={meta} plan={plan} />
          </div>
        )}
      </div>
    </div>
  );
}

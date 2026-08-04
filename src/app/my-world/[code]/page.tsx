import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { CountryEditor, AddCountryForm } from "@/components/CountryEditor";
import { ShareButton } from "@/components/ShareButton";
import { COUNTRY_CAP } from "@/lib/plan";
import type { Plan, VisitedCountryFull } from "@/lib/types";

export default async function ManageCountryPage({ params }: { params: { code: string } }) {
  const meta = countryByCode(params.code);
  if (!meta) notFound();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/my-world" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> My World
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{meta.continent}</p>
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

      <div className="mt-10">
        {!visited ? (
          <div className="card px-6 py-10 text-center">
            <h2 className="font-serif text-2xl">Not on your map yet.</h2>
            {atCountryCap ? (
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                You&rsquo;ve reached the free plan&rsquo;s {countryCap}-country limit.{" "}
                <Link href="/settings/billing" className="text-accent underline-offset-4 hover:underline">
                  Upgrade to Premium
                </Link>{" "}
                to keep adding countries.
              </p>
            ) : (
              <>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                  Add your first trip - photos and a soundtrack live with it, right after.
                </p>
                <div className="mt-6">
                  <AddCountryForm meta={meta} />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-8">
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
            <CountryEditor data={visited} meta={meta} />
          </div>
        )}
      </div>
    </div>
  );
}

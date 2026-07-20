import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { CountryEditor, MarkVisitedButton } from "@/components/CountryEditor";
import { MediaUploader } from "@/components/MediaUploader";
import type { VisitedCountryFull } from "@/lib/types";

export default async function ManageCountryPage({ params }: { params: { code: string } }) {
  const meta = countryByCode(params.code);
  if (!meta) notFound();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: profile }, { data }] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", user.id).single(),
    supabase
      .from("visited_countries")
      .select("*, country_visits(*), country_cities(*), country_media!country_media_visited_country_id_fkey(*)")
      .eq("user_id", user.id)
      .eq("country_code", meta.code)
      .maybeSingle(),
  ]);

  const visited = data as VisitedCountryFull | null;

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
          <Link
            href={`/u/${profile.username}/countries/${meta.code.toLowerCase()}`}
            className="inline-flex items-center gap-1.5 text-sm text-accent underline-offset-4 hover:underline"
          >
            View public page <ExternalLink size={14} />
          </Link>
        )}
      </div>

      <div className="mt-10">
        {!visited ? (
          <div className="card px-6 py-12 text-center">
            <h2 className="font-serif text-2xl">Not on your map yet.</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              One click adds it to your map. Photos, years, cities and a memory are all optional extras for later.
            </p>
            <div className="mt-6 flex justify-center">
              <MarkVisitedButton meta={meta} />
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            <MediaUploader
              userId={user.id}
              scope="countries"
              parentId={visited.id}
              table="country_media"
              fkColumn="visited_country_id"
              kind="image"
              max={5}
              items={visited.country_media}
              coverId={visited.cover_media_id}
              coverTable="visited_countries"
              label="Photos"
            />
            <CountryEditor data={visited} meta={meta} />
          </div>
        )}
      </div>
    </div>
  );
}

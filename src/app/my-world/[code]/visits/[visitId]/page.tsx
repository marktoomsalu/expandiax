import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { VisitEditor } from "@/components/VisitEditor";
import { MediaUploader } from "@/components/MediaUploader";
import { formatVisitRange } from "@/lib/utils";
import type { CountryMedia, CountryVisit } from "@/lib/types";

type VisitRow = CountryVisit & {
  visited_countries: { id: string; user_id: string; country_code: string };
  country_media: CountryMedia[];
};

export const metadata = { title: "Edit trip" };

export default async function VisitPage({
  params,
  searchParams,
}: {
  params: { code: string; visitId: string };
  searchParams: { created?: string };
}) {
  const meta = countryByCode(params.code);
  if (!meta) notFound();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data } = await supabase
    .from("country_visits")
    .select("*, visited_countries!inner(id, user_id, country_code), country_media(*)")
    .eq("id", params.visitId)
    .eq("visited_countries.user_id", user.id)
    .eq("visited_countries.country_code", meta.code)
    .maybeSingle();

  if (!data) notFound();
  const visit = data as VisitRow;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link href={`/my-world/${meta.code.toLowerCase()}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> {meta.flag} {meta.name}
      </Link>

      {searchParams.created && (
        <p role="status" className="mt-6 rounded-lg border border-accent/40 bg-accent-soft/50 px-4 py-3 text-sm">
          Trip added. Now give it a face — add photos, a soundtrack, and the full memory below.
        </p>
      )}

      <p className="eyebrow mt-6">Trip</p>
      <h1 className="mt-1 text-3xl md:text-4xl">{formatVisitRange(visit)}</h1>

      <div className="mt-8">
        <VisitEditor visit={visit} />
      </div>

      <div className="mt-10 border-t border-line pt-8">
        <MediaUploader
          userId={user.id}
          scope="countries"
          parentId={visit.id}
          table="country_media"
          fkColumn="country_visit_id"
          extraFields={{ visited_country_id: visit.visited_country_id }}
          kind="image"
          max={5}
          items={visit.country_media}
          coverId={visit.cover_media_id}
          coverTable="country_visits"
          label="Photos from this trip"
        />
      </div>
    </div>
  );
}

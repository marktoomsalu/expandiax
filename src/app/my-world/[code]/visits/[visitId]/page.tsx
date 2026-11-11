import { notFound, redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { signMedia } from "@/lib/signedMedia";
import { TripView, type TripVisit } from "@/components/trip/TripView";

export const metadata = { title: "Trip" };

/** One of your trips (or stays), in My World: the trip page with your tools to change it. */
export default async function VisitPage({ params, searchParams }: { params: { code: string; visitId: string }; searchParams: { created?: string } }) {
  const meta = countryByCode(params.code);
  if (!meta) notFound();
  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");

  const { data } = await signMedia(
    await supabase
      .from("country_visits")
      .select("*, visited_countries!inner(id, user_id, country_code), country_media!country_media_country_visit_id_fkey(*), country_cities(*)")
      .eq("id", params.visitId)
      .eq("visited_countries.user_id", user.id)
      .eq("visited_countries.country_code", meta.code)
      .maybeSingle()
  );
  if (!data) notFound();

  return (
    <TripView
      visit={data as TripVisit}
      meta={meta}
      owner
      created={!!searchParams.created}
      country={{ href: `/my-world/${meta.code.toLowerCase()}`, label: meta.name, allTrips: `All your trips in ${meta.name}` }}
    />
  );
}

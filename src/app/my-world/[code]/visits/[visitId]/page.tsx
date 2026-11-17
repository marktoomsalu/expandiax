import { notFound, redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { signMedia } from "@/lib/signedMedia";
import { locatePlaces } from "@/lib/locatePlaces";
import { TripView, type TripVisit } from "@/components/trip/TripView";
import { loadCollaborators, namesTogether } from "@/lib/collab";
import { stayLinks } from "@/lib/stayLinks";
import { JournalSection } from "@/components/trip/JournalSection";

export const metadata = { title: "Trip" };

/** One of your trips (or stays), or one shared with you, in My World: the trip page with your tools to change it. */
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
      .eq("visited_countries.country_code", meta.code)
      .maybeSingle()
  );
  if (!data) notFound();
  const trip = data as TripVisit;
  // Yours, or a trip you're a collaborator on (migration 075).
  const isOwner = trip.visited_countries.user_id === user.id;
  const collaborators = await loadCollaborators(supabase, "trip", trip.id);
  const mine = collaborators.find((c) => c.user_id === user.id && c.status === "accepted");
  if (!isOwner && !mine) notFound();
  trip.country_cities = await locatePlaces(supabase, trip.country_cities, meta.code);
  const others = collaborators.filter((c) => c.status === "accepted" && c.user_id !== user.id).map((c) => c.person?.display_name ?? "");
  let ownerName = "";
  if (!isOwner) {
    const { data: o } = await supabase.from("profiles").select("display_name").eq("id", trip.visited_countries.user_id).maybeSingle();
    ownerName = o?.display_name ?? "";
  }
  const together = namesTogether([ownerName, ...others].filter(Boolean));
  const base = `/my-world/${meta.code.toLowerCase()}/visits`;
  const [links, { data: journals }] = await Promise.all([
    stayLinks(supabase, trip, meta.name, (id) => `${base}/${id}`),
    // Yours, and (on a trip shared with you) its owner's if they shared it. None before migration 076.
    supabase.from("trip_journals").select("user_id, body, is_shared").eq("visit_id", trip.id),
  ]);
  const myJournal = journals?.find((j) => j.user_id === user.id);
  const ownerJournal = !isOwner ? journals?.find((j) => j.user_id === trip.visited_countries.user_id && j.is_shared) : null;

  return (
    <TripView
      visit={trip}
      meta={meta}
      owner={isOwner}
      canEdit={isOwner || !!mine?.can_edit}
      together={together || null}
      yours
      created={!!searchParams.created}
      duringStay={links.duringStay}
      tripsDuring={links.tripsDuring}
      journal={
        <JournalSection
          mine={myJournal ? { body: myJournal.body, shared: myJournal.is_shared } : null}
          editHref={isOwner || mine?.can_edit ? `${base}/${trip.id}/edit#journal` : null}
          theirs={ownerJournal ? { body: ownerJournal.body, by: ownerName.split(" ")[0] } : null}
        />
      }
      country={{ href: `/my-world/${meta.code.toLowerCase()}`, label: `All trips to ${meta.name}`, allTrips: `All your trips to ${meta.name}` }}
    />
  );
}

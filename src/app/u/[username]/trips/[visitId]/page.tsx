import { locatePlaces } from "@/lib/locatePlaces";
import { notFound, redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { signMedia } from "@/lib/signedMedia";
import { TripView, type TripVisit } from "@/components/trip/TripView";
import type { CommentWithAuthor } from "@/lib/types";
import { loadCollaborators, namesTogether } from "@/lib/collab";

type Props = { params: { username: string; visitId: string } };

async function load(username: string, visitId: string) {
  if (!/^[0-9a-f-]{36}$/.test(visitId)) return null;
  const supabase = createClient();
  const { data: person } = await supabase.from("profiles").select("id, username, display_name").eq("username", username.toLowerCase()).maybeSingle();
  if (!person) return null;
  // Read as the viewer: their privacy (Everyone / Friends / Only me) decides.
  const { data } = await signMedia(
    await supabase
      .from("country_visits")
      .select("*, visited_countries!inner(id, user_id, country_code), country_media!country_media_country_visit_id_fkey(*), country_cities(*)")
      .eq("id", visitId)
      .maybeSingle()
  );
  if (!data) return null;
  const visit = data as TripVisit;
  // Theirs, or a trip they're a collaborator on (one shared post, migration 075).
  const collaborators = await loadCollaborators(supabase, "trip", visit.id);
  const accepted = collaborators.filter((c) => c.status === "accepted");
  if (visit.visited_countries.user_id !== person.id && !accepted.some((c) => c.user_id === person.id)) return null;
  return { person, visit, accepted };
}

export async function generateMetadata({ params }: Props) {
  const got = await load(params.username, params.visitId);
  const meta = got ? countryByCode(got.visit.visited_countries.country_code) : null;
  return { title: got && meta ? `${got.visit.title?.trim() || meta.name} · ${got.person.display_name}` : "Trip" };
}

/**
 * One trip (or stay) of anyone's, opened from the feed or a profile: its
 * photos, places, story, likes and comments, and the way to all their trips
 * in that country. Its owner can change it from here.
 */
export default async function TripPage({ params }: Props) {
  const got = await load(params.username, params.visitId);
  if (!got) notFound();
  const { person, visit, accepted } = got;
  const meta = countryByCode(visit.visited_countries.country_code);
  if (!meta) notFound();
  const supabase = createClient();
  const user = await getAuthUser();
  const mine = user?.id === person.id;
  // Your own trip (or one shared with you): the one trip page in My World
  // (same tools, and Back leads to your country under Countries), wherever you came from.
  if (user && (user.id === visit.visited_countries.user_id || accepted.some((c) => c.user_id === user.id))) {
    redirect(`/my-world/${meta.code.toLowerCase()}/visits/${visit.id}`);
  }
  // Who else was there, besides the person whose page this is.
  let ownerName = "";
  if (visit.visited_countries.user_id !== person.id) {
    const { data: o } = await supabase.from("profiles").select("display_name").eq("id", visit.visited_countries.user_id).maybeSingle();
    ownerName = o?.display_name ?? "";
  }
  const together = namesTogether([ownerName, ...accepted.filter((c) => c.user_id !== person.id).map((c) => c.person?.display_name ?? "")].filter(Boolean));
  visit.country_cities = await locatePlaces(supabase, visit.country_cities, meta.code);
  const countryId = visit.visited_countries.id;
  const [{ data: like }, { data: comments }] = await Promise.all([
    user ? supabase.from("likes").select("target_id").eq("user_id", user.id).eq("kind", "country").eq("target_id", countryId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("comments").select("*, profiles(username, display_name, avatar_url)").eq("kind", "country").eq("target_id", countryId).order("created_at", { ascending: true }),
  ]);
  const first = person.display_name.trim().split(" ")[0];

  return (
    <TripView
      visit={visit}
      meta={meta}
      owner={mine}
      together={together || null}
      country={{
        href: `/u/${person.username}/countries/${meta.code.toLowerCase()}`,
        label: mine ? `All trips to ${meta.name}` : `${first}’s trips to ${meta.name}`,
        allTrips: mine ? `All your trips to ${meta.name}` : `All of ${first}’s trips to ${meta.name}`,
      }}
      social={{ liked: !!like, comments: (comments ?? []) as CommentWithAuthor[] }}
    />
  );
}

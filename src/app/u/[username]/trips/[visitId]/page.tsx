import { notFound } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { signMedia } from "@/lib/signedMedia";
import { TripView, type TripVisit } from "@/components/trip/TripView";
import type { CommentWithAuthor } from "@/lib/types";

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
      .eq("visited_countries.user_id", person.id)
      .maybeSingle()
  );
  return data ? { person, visit: data as TripVisit } : null;
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
  const { person, visit } = got;
  const meta = countryByCode(visit.visited_countries.country_code);
  if (!meta) notFound();
  const supabase = createClient();
  const user = await getAuthUser();
  const mine = user?.id === person.id;
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
      country={{
        href: `/u/${person.username}/countries/${meta.code.toLowerCase()}`,
        label: mine ? `Your ${meta.name}` : `${first}’s ${meta.name}`,
        allTrips: mine ? `All your trips in ${meta.name}` : `All of ${first}’s trips in ${meta.name}`,
      }}
      social={{ liked: !!like, comments: (comments ?? []) as CommentWithAuthor[] }}
    />
  );
}

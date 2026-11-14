import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";

/**
 * An event from your Events: editing it if it's yours (or shared with you
 * with edit rights), otherwise its page on your profile (an event shared
 * with you to look at, migration 075).
 */
export default async function EventRedirect({ params }: { params: { id: string } }) {
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");
  const supabase = createClient();
  const [{ data: event }, { data: me }, { data: collab }] = await Promise.all([
    supabase.from("events").select("user_id").eq("id", params.id).maybeSingle(),
    supabase.from("profiles").select("username").eq("id", user.id).single(),
    supabase.from("post_collaborators").select("can_edit").eq("kind", "event").eq("target_id", params.id).eq("user_id", user.id).eq("status", "accepted").maybeSingle(),
  ]);
  if (event && event.user_id !== user.id && !collab?.can_edit && me) redirect(`/u/${me.username}/events/${params.id}`);
  redirect(`/events/${params.id}/edit`);
}

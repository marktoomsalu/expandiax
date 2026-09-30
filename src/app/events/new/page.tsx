import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { EventForm } from "@/components/EventForm";
import { dedupeRecentArtists } from "@/lib/events";

export const metadata = { title: "Add event" };

export default async function NewEventPage() {
  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");

  const { data } = await supabase
    .from("events")
    .select("spotify_artist_id, spotify_artist_name, spotify_artist_image")
    .eq("user_id", user.id)
    .not("spotify_artist_id", "is", null)
    .order("event_date", { ascending: false })
    .limit(50);
  const recentArtists = dedupeRecentArtists(data ?? []);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/events" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Events
      </Link>
      <p className="eyebrow mt-6">New entry</p>
      <h1 className="mt-2 text-3xl md:text-4xl">A moment worth keeping.</h1>
      <p className="mt-2 text-sm text-muted">Photos, details, all in one place - fill in as much as you like.</p>
      <div className="mt-8">
        <EventForm recentArtists={recentArtists} userId={user.id} />
      </div>
    </div>
  );
}

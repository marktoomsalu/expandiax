import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { EventForm } from "@/components/EventForm";
import { dedupeRecentArtists } from "@/lib/events";
import { EVENT_CAP } from "@/lib/plan";
import type { Plan } from "@/lib/types";

export const metadata = { title: "Add event" };

export default async function NewEventPage() {
  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");

  const [{ data }, { data: profile }, { count: eventCount }] = await Promise.all([
    supabase
      .from("events")
      .select("spotify_artist_id, spotify_artist_name, spotify_artist_image")
      .eq("user_id", user.id)
      .not("spotify_artist_id", "is", null)
      .order("event_date", { ascending: false })
      .limit(50),
    supabase.from("profiles").select("plan").eq("id", user.id).single(),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  const recentArtists = dedupeRecentArtists(data ?? []);
  const plan = (profile?.plan ?? "free") as Plan;
  const eventCap = EVENT_CAP[plan];
  const atEventCap = eventCap !== null && (eventCount ?? 0) >= eventCap;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/events" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Events
      </Link>
      <p className="eyebrow mt-6">New entry</p>
      <h1 className="mt-2 text-3xl md:text-4xl">A moment worth keeping.</h1>
      {atEventCap ? (
        <div className="card mt-8 px-6 py-12 text-center">
          <h2 className="font-serif text-2xl">You&rsquo;ve reached the free plan&rsquo;s limit.</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Free plans are capped at {eventCap} events.{" "}
            <Link href="/settings/billing" className="text-accent underline-offset-4 hover:underline">
              Upgrade to Premium
            </Link>{" "}
            to keep logging new ones.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">Save the event first - photos and videos come right after.</p>
          <div className="mt-8">
            <EventForm recentArtists={recentArtists} />
          </div>
        </>
      )}
    </div>
  );
}

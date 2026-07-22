import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "@/components/EventForm";
import { MediaUploader } from "@/components/MediaUploader";
import { DeleteEventButton } from "@/components/DeleteEventButton";
import type { EventFull } from "@/lib/types";

export const metadata = { title: "Edit event" };

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { created?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: profile }, { data }] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", user.id).single(),
    supabase
      .from("events")
      .select("*, event_media!event_media_event_id_fkey(*)")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const event = data as EventFull | null;
  if (!event) notFound();

  const images = event.event_media.filter((m) => m.media_type === "image");
  const videos = event.event_media.filter((m) => m.media_type === "video");

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/events" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Events
      </Link>

      {searchParams.created && (
        <p role="status" className="mt-6 rounded-lg border border-accent/40 bg-accent-soft/50 px-4 py-3 text-sm">
          Event added. Now give it a face — upload photos and videos below.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Edit</p>
          <h1 className="mt-1 text-3xl md:text-4xl">{event.title}</h1>
        </div>
        {profile && event.is_public && (
          <Link
            href={`/u/${profile.username}/events/${event.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-accent underline-offset-4 hover:underline"
          >
            View public page <ExternalLink size={14} />
          </Link>
        )}
      </div>

      <div className="mt-8">
        <EventForm event={event} />
      </div>

      <div className="mt-12 space-y-10 border-t border-line pt-8">
        <MediaUploader
          userId={user.id}
          scope="events"
          parentId={event.id}
          table="event_media"
          fkColumn="event_id"
          kind="image"
          max={5}
          items={images}
          coverId={event.cover_media_id}
          coverTable="events"
          label="Photos"
        />
        <MediaUploader
          userId={user.id}
          scope="events"
          parentId={event.id}
          table="event_media"
          fkColumn="event_id"
          kind="video"
          max={3}
          items={videos}
          captions
          label="Videos"
        />
      </div>

      <div className="mt-12 border-t border-line pt-6">
        <DeleteEventButton eventId={event.id} mediaPaths={event.event_media.map((m) => m.storage_path)} />
      </div>
    </div>
  );
}

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RatingStars } from "@/components/Rating";
import { formatDate } from "@/lib/utils";
import type { Event, EventMedia } from "@/lib/types";

export const metadata = { title: "Events" };

const PAGE_SIZE = 30;

type EventRow = Event & { event_media: EventMedia[] };

export default async function AllEventsPage({
  params,
  searchParams,
}: {
  params: { username: string };
  searchParams?: { limit?: string };
}) {
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", params.username.toLowerCase())
    .maybeSingle();

  if (!profile) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="text-3xl">This world is private.</h1>
        <p className="mt-3 text-sm text-muted">The profile doesn&rsquo;t exist, or its owner keeps it to themselves.</p>
        <Link href="/explore" className="btn-ghost mt-8">Explore public travellers</Link>
      </div>
    );
  }

  const limit = Math.min(Math.max(Number(searchParams?.limit) || PAGE_SIZE, PAGE_SIZE), 300);

  const { data } = await supabase
    .from("events")
    .select("*, event_media!event_media_event_id_fkey(*)")
    .eq("user_id", profile.id)
    .eq("is_public", true)
    .order("event_date", { ascending: false })
    .limit(limit);

  const events = (data ?? []) as EventRow[];

  return (
    <div className="mx-auto max-w-shell px-5 py-10">
      <Link href={`/u/${profile.username}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> {profile.display_name}
      </Link>
      <p className="eyebrow mt-8">{profile.display_name}</p>
      <h1 className="mt-1 text-3xl md:text-4xl">All events.</h1>

      {events.length === 0 ? (
        <p className="mt-10 text-sm text-muted">No public events yet.</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => {
            const cover =
              e.event_media.find((m) => m.id === e.cover_media_id) ??
              e.event_media.filter((m) => m.media_type === "image").sort((a, b) => a.display_order - b.display_order)[0];
            return (
              <li key={e.id}>
                <Link href={`/u/${profile.username}/events/${e.id}`} className="card group block overflow-hidden">
                  <div className="relative aspect-[16/9] bg-ink/90">
                    {cover ? (
                      <Image
                        src={cover.public_url}
                        alt={cover.caption || e.title}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : e.spotify_artist_image ? (
                      <Image
                        src={e.spotify_artist_image}
                        alt={e.spotify_artist_name || e.title}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-4 text-center font-serif text-2xl italic text-canvas/90 dark:text-ink/90">{e.title}</div>
                    )}
                  </div>
                  <div className="px-4 py-3.5">
                    <p className="font-serif text-lg">{e.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{formatDate(e.event_date)} · {[e.city, e.country_name].filter(Boolean).join(", ")}</p>
                    <div className="mt-1.5"><RatingStars value={e.rating} size={13} /></div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {events.length >= limit && (
        <div className="mt-8 flex justify-center">
          <Link href={`/u/${profile.username}/events?limit=${limit + PAGE_SIZE}`} className="btn-ghost">
            Load more
          </Link>
        </div>
      )}
    </div>
  );
}

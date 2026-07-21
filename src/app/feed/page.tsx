import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { countryByCode } from "@/lib/countries";
import { formatRelative } from "@/lib/utils";
import type { FeedEvent, Profile } from "@/lib/types";

export const metadata = { title: "Feed" };

export default async function FeedPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: followingRows } = await supabase.from("follows").select("followee_id").eq("follower_id", user.id);
  const followeeIds = (followingRows ?? []).map((r) => r.followee_id);

  let events: FeedEvent[] = [];
  let actors = new Map<string, Pick<Profile, "id" | "username" | "display_name" | "avatar_url">>();

  if (followeeIds.length > 0) {
    const { data: feedData } = await supabase
      .from("feed_events")
      .select("*")
      .in("actor_id", followeeIds)
      .order("created_at", { ascending: false })
      .limit(30);
    events = (feedData ?? []) as FeedEvent[];

    if (events.length > 0) {
      const actorIds = [...new Set(events.map((e) => e.actor_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", actorIds);
      actors = new Map((profiles ?? []).map((p) => [p.id, p]));
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <p className="eyebrow">Feed</p>
      <h1 className="mt-2 text-3xl md:text-4xl">What your world is up to.</h1>

      {followeeIds.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Your feed is quiet."
            body="Follow other travellers to see the countries they pin and the concerts they log, right here."
            actionLabel="Explore travellers"
            actionHref="/explore"
          />
        </div>
      ) : events.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Nothing yet."
            body="The people you follow haven't added anything public yet — check back soon."
          />
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {events.map((event) => {
            const actor = actors.get(event.actor_id);
            if (!actor) return null;
            const meta = countryByCode(event.country_code);
            const href =
              event.kind === "country"
                ? `/u/${actor.username}/countries/${event.country_code.toLowerCase()}`
                : `/u/${actor.username}/concerts/${event.ref_id}`;
            return (
              <li key={`${event.kind}-${event.ref_id}`} className="card overflow-hidden p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/u/${actor.username}`}
                    aria-label={actor.display_name}
                    className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-raised font-serif text-sm text-muted"
                  >
                    {actor.avatar_url ? (
                      <Image src={actor.avatar_url} alt="" width={36} height={36} className="h-full w-full object-cover" />
                    ) : (
                      actor.display_name.charAt(0)
                    )}
                  </Link>
                  <div className="min-w-0">
                    <Link href={`/u/${actor.username}`} className="text-sm font-medium hover:text-accent">
                      {actor.display_name}
                    </Link>
                    <span className="text-xs text-muted"> · {formatRelative(event.created_at)}</span>
                  </div>
                </div>
                <Link href={href} className="group mt-3 flex items-center gap-4">
                  <p className="min-w-0 flex-1 text-sm leading-relaxed text-ink">
                    {event.kind === "country" ? (
                      <>
                        Added <span className="font-serif text-base">{meta?.flag} {event.title}</span> to their map.
                      </>
                    ) : (
                      <>
                        Logged a concert — <span className="font-serif text-base">{event.title}</span>
                        {event.subtitle && <span className="italic text-muted"> · {event.subtitle}</span>}.
                      </>
                    )}
                  </p>
                  {event.cover_url && (
                    <Image
                      src={event.cover_url}
                      alt=""
                      width={80}
                      height={80}
                      className="h-16 w-16 shrink-0 rounded-lg object-cover transition-transform duration-300 group-hover:scale-[1.03] sm:h-20 sm:w-20"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

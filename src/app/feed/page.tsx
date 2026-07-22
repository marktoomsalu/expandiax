import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { LikeButton } from "@/components/LikeButton";
import { countryByCode } from "@/lib/countries";
import { eventTypeMeta } from "@/lib/events";
import { formatDate, formatMonthYear, formatRelative } from "@/lib/utils";
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

  let items: FeedEvent[] = [];
  let actors = new Map<string, Pick<Profile, "id" | "username" | "display_name" | "avatar_url">>();
  const likeCounts = new Map<string, number>();
  const likedByMe = new Set<string>();

  if (followeeIds.length > 0) {
    const { data: feedData } = await supabase
      .from("feed_events")
      .select("*")
      .in("actor_id", followeeIds)
      .order("created_at", { ascending: false })
      .limit(30);
    items = (feedData ?? []) as FeedEvent[];

    if (items.length > 0) {
      const actorIds = [...new Set(items.map((i) => i.actor_id))];
      const refIds = items.map((i) => i.ref_id);
      const [{ data: profiles }, { data: likeRows }] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", actorIds),
        supabase.from("likes").select("kind, target_id, user_id").in("target_id", refIds),
      ]);
      actors = new Map((profiles ?? []).map((p) => [p.id, p]));
      for (const row of likeRows ?? []) {
        const key = `${row.kind}:${row.target_id}`;
        likeCounts.set(key, (likeCounts.get(key) ?? 0) + 1);
        if (row.user_id === user.id) likedByMe.add(key);
      }
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
            body="Follow other travellers to see the countries they pin and the events they log, right here."
            actionLabel="Explore travellers"
            actionHref="/explore"
          />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Nothing yet."
            body="The people you follow haven't added anything public yet — check back soon."
          />
        </div>
      ) : (
        <ul className="mt-8 space-y-6">
          {items.map((item) => {
            const actor = actors.get(item.actor_id);
            if (!actor) return null;
            const meta = countryByCode(item.country_code);
            const key = `${item.kind}:${item.ref_id}`;
            const href =
              item.kind === "country"
                ? `/u/${actor.username}/countries/${item.country_code.toLowerCase()}`
                : `/u/${actor.username}/events/${item.ref_id}`;
            const typeLabel = item.event_type ? eventTypeMeta(item.event_type).label.toLowerCase() : "event";
            return (
              <li key={key} className="card overflow-hidden">
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <Link
                      href={`/u/${actor.username}`}
                      aria-label={actor.display_name}
                      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-raised font-serif text-sm text-muted"
                    >
                      {actor.avatar_url ? (
                        <Image src={actor.avatar_url} alt="" width={40} height={40} className="h-full w-full object-cover" />
                      ) : (
                        actor.display_name.charAt(0)
                      )}
                    </Link>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-1.5">
                        <Link href={`/u/${actor.username}`} className="text-sm font-medium hover:text-accent">
                          {actor.display_name}
                        </Link>
                        <span className="text-xs text-muted">{item.kind === "country" ? "added a country" : `logged a ${typeLabel}`}</span>
                      </div>
                      <span className="text-xs text-muted">{formatRelative(item.created_at)}</span>
                    </div>
                  </div>
                  <Link href={href} className="mt-3 block hover:text-accent">
                    <p className="font-serif text-lg text-ink">
                      {item.kind === "country" ? <>{meta?.flag} {item.title}</> : item.title}
                    </p>
                    {item.subtitle && <p className="text-sm italic text-muted">{item.subtitle}</p>}
                    {(item.visit_date || item.visit_year) && (
                      <p className="mt-1 text-xs text-muted">
                        {item.kind === "country" ? "Visited" : "Was there"}{" "}
                        {item.visit_date
                          ? item.visit_date_precision === "month"
                            ? formatMonthYear(item.visit_date)
                            : formatDate(item.visit_date)
                          : item.visit_year}
                        {item.kind === "event" && item.country_name && ` · ${item.country_name}`}
                      </p>
                    )}
                    {item.body && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink">{item.body}</p>}
                  </Link>
                </div>

                {item.cover_url && (
                  <div className="relative aspect-[4/3] w-full bg-raised">
                    {item.cover_media_type === "video" ? (
                      <video
                        src={item.cover_url}
                        controls
                        preload="metadata"
                        className="absolute inset-0 h-full w-full bg-black object-contain"
                      />
                    ) : (
                      <Link href={href} className="absolute inset-0 block">
                        <Image src={item.cover_url} alt="" fill sizes="(min-width: 640px) 640px, 100vw" className="object-cover" />
                      </Link>
                    )}
                  </div>
                )}

                <div className="flex items-center border-t border-line px-4 py-3 sm:px-5">
                  <LikeButton
                    kind={item.kind}
                    targetId={item.ref_id}
                    initialLiked={likedByMe.has(key)}
                    initialCount={likeCounts.get(key) ?? 0}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

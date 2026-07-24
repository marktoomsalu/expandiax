import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { LikeButton } from "@/components/LikeButton";
import { ShareButton } from "@/components/ShareButton";
import { CommentSection } from "@/components/CommentSection";
import { SpotifyEmbed } from "@/components/SpotifyEmbed";
import { PhotoGallery } from "@/components/PhotoGallery";
import { countryByCode } from "@/lib/countries";
import { eventTypeMeta } from "@/lib/events";
import { formatDate, formatMonthYear, formatRelative } from "@/lib/utils";
import type { CommentWithAuthor, FeedEvent, Profile } from "@/lib/types";

export const metadata = { title: "Feed" };

const PAGE_SIZE = 30;

export default async function FeedPage({ searchParams }: { searchParams?: { limit?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const limit = Math.min(Math.max(Number(searchParams?.limit) || PAGE_SIZE, PAGE_SIZE), 300);

  const { data: followingRows } = await supabase.from("follows").select("followee_id").eq("follower_id", user.id);
  const followeeIds = (followingRows ?? []).map((r) => r.followee_id);

  let items: FeedEvent[] = [];
  let actors = new Map<string, Pick<Profile, "id" | "username" | "display_name" | "avatar_url">>();
  const likeCounts = new Map<string, number>();
  const likedByMe = new Set<string>();
  const commentsByKey = new Map<string, CommentWithAuthor[]>();

  if (followeeIds.length > 0) {
    const { data: feedData } = await supabase
      .from("feed_events")
      .select("*")
      .in("actor_id", followeeIds)
      .order("created_at", { ascending: false })
      .limit(limit);
    items = (feedData ?? []) as FeedEvent[];

    if (items.length > 0) {
      const actorIds = [...new Set(items.map((i) => i.actor_id))];
      const refIds = items.map((i) => i.ref_id);
      const [{ data: profiles }, { data: likeRows }, { data: commentRows }] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", actorIds),
        supabase.from("likes").select("kind, target_id, user_id").in("target_id", refIds),
        supabase
          .from("comments")
          .select("*, profiles(username, display_name, avatar_url)")
          .in("target_id", refIds)
          .order("created_at", { ascending: true }),
      ]);
      actors = new Map((profiles ?? []).map((p) => [p.id, p]));
      for (const row of likeRows ?? []) {
        const key = `${row.kind}:${row.target_id}`;
        likeCounts.set(key, (likeCounts.get(key) ?? 0) + 1);
        if (row.user_id === user.id) likedByMe.add(key);
      }
      for (const row of (commentRows ?? []) as CommentWithAuthor[]) {
        const key = `${row.kind}:${row.target_id}`;
        commentsByKey.set(key, [...(commentsByKey.get(key) ?? []), row]);
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
                        {item.kind === "event" &&
                          [item.venue, item.city, item.country_name].filter(Boolean).length > 0 &&
                          ` · ${[item.venue, item.city, item.country_name].filter(Boolean).join(", ")}`}
                      </p>
                    )}
                    {item.body && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink">{item.body}</p>}
                  </Link>
                  {item.kind === "country" && item.spotify_track_id && (
                    <div className="mt-3">
                      <SpotifyEmbed trackId={item.spotify_track_id} compact />
                    </div>
                  )}
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
                      <PhotoGallery
                        photos={[{ id: key, url: item.cover_url, alt: item.title }]}
                        gridClassName="absolute inset-0"
                        itemClassName="absolute inset-0 h-full w-full"
                        sizes="(min-width: 640px) 640px, 100vw"
                      />
                    )}
                  </div>
                )}

                <div className="flex items-center gap-5 border-t border-line px-4 py-3 sm:px-5">
                  <LikeButton
                    kind={item.kind}
                    targetId={item.ref_id}
                    initialLiked={likedByMe.has(key)}
                    initialCount={likeCounts.get(key) ?? 0}
                  />
                  <ShareButton kind={item.kind} targetId={item.ref_id} title={item.title} />
                </div>
                <div className="border-t border-line px-4 py-3 sm:px-5">
                  <CommentSection
                    kind={item.kind}
                    targetId={item.ref_id}
                    posterId={item.actor_id}
                    initialComments={commentsByKey.get(key) ?? []}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {items.length >= limit && (
        <div className="mt-8 flex justify-center">
          <Link href={`/feed?limit=${limit + PAGE_SIZE}`} className="btn-ghost">
            Load more
          </Link>
        </div>
      )}
    </div>
  );
}

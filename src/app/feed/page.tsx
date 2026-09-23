import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Clock, Compass, Globe2, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { GreetingHeader } from "@/components/GreetingHeader";
import { LikeButton } from "@/components/LikeButton";
import { FollowButton } from "@/components/FollowButton";
import { CommentSection } from "@/components/CommentSection";
import { FeedPostBody } from "@/components/FeedPostBody";
import { FeedMediaCarousel, type FeedMediaItem } from "@/components/FeedMediaCarousel";
import { SpotifyEmbed } from "@/components/SpotifyEmbed";
import { IWasThereButton } from "@/components/IWasThereButton";
import { countryByCode } from "@/lib/countries";
import { eventTypeMeta } from "@/lib/events";
import {
  buildNextSuggestions,
  buildTogetherCards,
  eventMatchKey,
  pickResurfacedMemory,
  type OwnCountryLite,
  type OwnEventLite,
} from "@/lib/feedSections";
import { cn, formatDate, formatMonthYear, formatRelative } from "@/lib/utils";
import type { CommentWithAuthor, FeedEvent, Profile } from "@/lib/types";

export const metadata = { title: "Feed" };

const PAGE_SIZE = 30;

type RawMedia = FeedMediaItem & { displayOrder: number };

export default async function FeedPage({ searchParams }: { searchParams?: { limit?: string } }) {
  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");

  const limit = Math.min(Math.max(Number(searchParams?.limit) || PAGE_SIZE, PAGE_SIZE), 300);

  const { data: followingRows } = await supabase.from("follows").select("followee_id").eq("follower_id", user.id);
  const followeeIds = (followingRows ?? []).map((r) => r.followee_id);
  const followingSet = new Set(followeeIds);

  const [{ data: publicProfiles }, { data: countRows }, { data: viewerProfile }, { data: ownEventsRaw }, { data: ownCountriesRaw }, { data: followeeCountryRows }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("visibility", "public")
        .neq("id", user.id)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("public_country_counts").select("user_id, country_count"),
      supabase.from("profiles").select("feed_last_seen_at, username, display_name, avatar_url").eq("id", user.id).single(),
      supabase.from("events").select("id, title, event_date, cover_media_id, is_favourite").eq("user_id", user.id),
      supabase
        .from("visited_countries")
        .select("id, country_code, country_name, cover_media_id, is_favourite, country_visits(visited_from, visited_to, date_precision)")
        .eq("user_id", user.id),
      followeeIds.length
        ? supabase.from("visited_countries").select("country_code").in("user_id", followeeIds)
        : Promise.resolve({ data: [] as { country_code: string }[] }),
    ]);
  // Captured before the update below overwrites it — "new since your last
  // visit" has to compare against where you last left off, not against
  // the value this same page load is about to set.
  const previousLastSeenAt = viewerProfile?.feed_last_seen_at ?? null;
  const countsByUser = new Map((countRows ?? []).map((r) => [r.user_id, r.country_count]));
  const suggested = (publicProfiles ?? [])
    .filter((p) => !followingSet.has(p.id))
    .sort((a, b) => (countsByUser.get(b.id) ?? 0) - (countsByUser.get(a.id) ?? 0))
    .slice(0, 8);

  const ownEvents = (ownEventsRaw ?? []) as OwnEventLite[];
  const ownCountries = (ownCountriesRaw ?? []) as unknown as OwnCountryLite[];
  const ownEventsByKey = new Map(ownEvents.map((e) => [eventMatchKey(e.title, e.event_date), e.id]));
  const ownCountryCodes = new Set(ownCountries.map((c) => c.country_code));

  const resurfaced = pickResurfacedMemory(ownEvents, ownCountries, user.id, new Date());
  let resurfacedCoverUrl: string | null = null;
  if (resurfaced?.coverMediaId) {
    const table = resurfaced.kind === "event" ? "event_media" : "country_media";
    const { data: coverRow } = await supabase.from(table).select("public_url").eq("id", resurfaced.coverMediaId).single();
    resurfacedCoverUrl = coverRow?.public_url ?? null;
  }

  const next = buildNextSuggestions(
    (followeeCountryRows ?? []).map((r) => r.country_code),
    ownCountryCodes
  );

  let items: FeedEvent[] = [];
  let actors = new Map<string, Pick<Profile, "id" | "username" | "display_name" | "avatar_url">>();
  const likedByMe = new Set<string>();
  const commentsByKey = new Map<string, CommentWithAuthor[]>();
  const mediaByKey = new Map<string, RawMedia[]>();

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
      const countryRefIds = items.filter((i) => i.kind === "country").map((i) => i.ref_id);
      const eventRefIds = items.filter((i) => i.kind === "event").map((i) => i.ref_id);
      const [{ data: profiles }, { data: likeRows }, { data: commentRows }, { data: countryMediaRows }, { data: eventMediaRows }] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", actorIds),
        supabase.from("likes").select("kind, target_id").eq("user_id", user.id).in("target_id", refIds),
        supabase
          .from("comments")
          .select("*, profiles(username, display_name, avatar_url)")
          .in("target_id", refIds)
          .order("created_at", { ascending: true }),
        countryRefIds.length
          ? supabase.from("country_media").select("id, visited_country_id, public_url, media_type, display_order, caption, focal_x, focal_y").in("visited_country_id", countryRefIds)
          : Promise.resolve({ data: [] as { id: string; visited_country_id: string; public_url: string; media_type: "image" | "video"; display_order: number; caption: string; focal_x: number | null; focal_y: number | null }[] }),
        eventRefIds.length
          ? supabase.from("event_media").select("id, event_id, public_url, media_type, display_order, caption, focal_x, focal_y").in("event_id", eventRefIds)
          : Promise.resolve({ data: [] as { id: string; event_id: string; public_url: string; media_type: "image" | "video"; display_order: number; caption: string; focal_x: number | null; focal_y: number | null }[] }),
      ]);
      actors = new Map((profiles ?? []).map((p) => [p.id, p]));
      for (const row of likeRows ?? []) likedByMe.add(`${row.kind}:${row.target_id}`);
      for (const row of (commentRows ?? []) as CommentWithAuthor[]) {
        const key = `${row.kind}:${row.target_id}`;
        commentsByKey.set(key, [...(commentsByKey.get(key) ?? []), row]);
      }
      for (const row of countryMediaRows ?? []) {
        const key = `country:${row.visited_country_id}`;
        const list = mediaByKey.get(key) ?? [];
        list.push({ id: row.id, url: row.public_url, type: row.media_type, alt: row.caption || "", displayOrder: row.display_order, focalX: row.focal_x, focalY: row.focal_y });
        mediaByKey.set(key, list);
      }
      for (const row of eventMediaRows ?? []) {
        const key = `event:${row.event_id}`;
        const list = mediaByKey.get(key) ?? [];
        list.push({ id: row.id, url: row.public_url, type: row.media_type, alt: row.caption || "", displayOrder: row.display_order, focalX: row.focal_x, focalY: row.focal_y });
        mediaByKey.set(key, list);
      }
      for (const list of mediaByKey.values()) list.sort((a, b) => a.displayOrder - b.displayOrder);
    }
  }

  const together = buildTogetherCards(
    items,
    new Map([...actors.entries()].map(([id, p]) => [id, { username: p.username, display_name: p.display_name }])),
    ownEventsByKey
  );

  // A first-ever visit has nothing to be "caught up" from, so it's not
  // treated as a caught-up state at all - just the plain feed, no banner.
  const hasNewSincePreviousVisit = previousLastSeenAt !== null && items.some((i) => i.created_at > previousLastSeenAt);
  const showCaughtUpBanner = previousLastSeenAt !== null && items.length > 0 && !hasNewSincePreviousVisit;

  await supabase.from("profiles").update({ feed_last_seen_at: new Date().toISOString() }).eq("id", user.id);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Home</p>
          <GreetingHeader firstName={(viewerProfile?.display_name || "there").split(" ")[0]} />
        </div>
        <div className="flex items-center gap-3">
          <Link href="/explore" className="btn-ghost !py-2 text-sm">
            <Compass size={16} /> Explore
          </Link>
          {viewerProfile?.username && (
            <Link
              href={`/u/${viewerProfile.username}`}
              aria-label="Your profile"
              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-raised font-serif text-sm text-muted"
            >
              {viewerProfile.avatar_url ? (
                <Image src={viewerProfile.avatar_url} alt="" width={40} height={40} className="h-full w-full object-cover" />
              ) : (
                (viewerProfile.display_name || "?").charAt(0)
              )}
            </Link>
          )}
        </div>
      </div>

      {/* NEW — memories recently added by people you follow */}
      <section className="mt-10" aria-labelledby="new-h">
        <h2 id="new-h" className="text-sm font-medium text-muted">New</h2>

        {followeeIds.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Your feed is quiet."
              body="Follow other travellers to see the countries they pin and the events they log, right here."
              actionLabel="Explore travellers"
              actionHref="/explore"
            />
          </div>
        ) : items.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Nothing yet."
              body="The people you follow haven't added anything public yet - check back soon."
            />
          </div>
        ) : (
          <>
            {showCaughtUpBanner && (
              <div className="mt-4 flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-sm text-muted">
                <CheckCircle2 size={16} className="text-accent" aria-hidden />
                You&rsquo;re caught up. Go make something worth remembering.
              </div>
            )}
            <ul className={cn("space-y-6", showCaughtUpBanner ? "mt-4" : "mt-4")}>
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
                const dateLabel = item.visit_date
                  ? item.visit_date_precision === "month"
                    ? formatMonthYear(item.visit_date)
                    : formatDate(item.visit_date)
                  : item.visit_year
                    ? String(item.visit_year)
                    : null;
                const rawMedia = mediaByKey.get(key) ?? [];
                const media: FeedMediaItem[] =
                  rawMedia.length > 0
                    ? [...rawMedia].sort((a, b) => (a.url === item.cover_url ? -1 : b.url === item.cover_url ? 1 : 0))
                    : item.cover_url
                      ? [{ id: key, url: item.cover_url, type: item.cover_media_type ?? "image", alt: item.title }]
                      : [];
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
                            <span className="text-xs text-muted">
                              {item.kind === "country"
                                ? "added a country"
                                : `logged a ${typeLabel}${dateLabel ? ` · ${dateLabel}` : ""}`}
                            </span>
                          </div>
                          <span className="text-xs text-muted">{formatRelative(item.created_at)}</span>
                        </div>
                      </div>
                      <FeedPostBody
                        href={href}
                        flag={item.kind === "country" ? meta?.flag : undefined}
                        title={item.title}
                        subtitle={item.subtitle}
                        body={item.body}
                        metaLine={
                          <>
                            {item.kind === "country" && dateLabel && (
                              <p className="mt-1 text-xs text-muted">Visited {dateLabel}</p>
                            )}
                            {item.kind === "event" && [item.venue, item.city, item.country_name].filter(Boolean).length > 0 && (
                              <p className="mt-1 text-xs text-muted">
                                Attended <span aria-hidden>📍</span> {[item.venue, item.city, item.country_name].filter(Boolean).join(", ")}
                              </p>
                            )}
                          </>
                        }
                      />
                      {item.kind === "country" && item.spotify_track_id && (
                        <div className="mt-3">
                          <SpotifyEmbed trackId={item.spotify_track_id} compact />
                        </div>
                      )}
                    </div>

                    <FeedMediaCarousel items={media} />

                    <div className="flex items-center gap-5 border-t border-line px-4 py-3 sm:px-5">
                      <LikeButton kind={item.kind} targetId={item.ref_id} initialLiked={likedByMe.has(key)} />
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
          </>
        )}

        {items.length >= limit && (
          <div className="mt-8 flex justify-center">
            <Link href={`/feed?limit=${limit + PAGE_SIZE}`} className="btn-ghost">
              Load more
            </Link>
          </div>
        )}
      </section>

      {/* THEN — a memory resurfaced from your own past */}
      {resurfaced && (
        <section className="mt-10" aria-labelledby="then-h">
          <h2 id="then-h" className="flex items-center gap-1.5 text-sm font-medium text-muted">
            <Clock size={14} aria-hidden /> Then
          </h2>
          <Link href={resurfaced.href} className="card mt-4 flex items-center gap-4 overflow-hidden p-3 transition-shadow hover:shadow-sm">
            {resurfacedCoverUrl ? (
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                <Image src={resurfacedCoverUrl} alt="" fill sizes="64px" className="object-cover" />
              </div>
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Clock size={20} aria-hidden />
              </div>
            )}
            <div className="min-w-0">
              <p className="eyebrow">{resurfaced.subtitle}</p>
              <p className="mt-0.5 truncate font-serif text-lg">{resurfaced.title}</p>
            </div>
          </Link>
        </section>
      )}

      {/* TOGETHER — shared experiences with people you follow */}
      {together.length > 0 && (
        <section className="mt-10" aria-labelledby="together-h">
          <h2 id="together-h" className="flex items-center gap-1.5 text-sm font-medium text-muted">
            <Users size={14} aria-hidden /> Together
          </h2>
          <ul className="mt-4 space-y-3">
            {together.map((card, i) => (
              <li key={i} className="card flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  {card.status === "shared" ? (
                    <>
                      <p className="text-sm">
                        You and <span className="font-medium">{card.actorName}</span> were both at
                      </p>
                      <p className="truncate font-serif text-lg">{card.title}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm">
                        <span className="font-medium">{card.actorName}</span> was at
                      </p>
                      <p className="truncate font-serif text-lg">{card.title}</p>
                      <p className="mt-0.5 text-xs text-muted">Were you there too?</p>
                    </>
                  )}
                </div>
                {card.status === "shared" ? (
                  <Link href={card.ownHref} className="btn-ghost shrink-0 !py-2 text-xs">
                    Your version
                  </Link>
                ) : (
                  <div className="shrink-0">
                    <IWasThereButton prefill={card.prefill} label="I was there" />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* NEXT — experiences that could become future memories */}
      <section className="mt-10" aria-labelledby="next-h">
        <h2 id="next-h" className="flex items-center gap-1.5 text-sm font-medium text-muted">
          <Globe2 size={14} aria-hidden /> Next
        </h2>
        {next.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2.5">
            {next.map((s) => (
              <li key={s.code}>
                <span className="flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm">
                  <span aria-hidden>{s.flag}</span> {s.name}
                  <span className="text-xs text-muted">
                    {s.friendCount} {s.friendCount === 1 ? "friend has" : "friends have"} been
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Link href="/start" className="card mt-4 block p-4 text-center transition-shadow hover:shadow-sm">
            <p className="font-serif text-lg">Log your next adventure.</p>
            <p className="mt-1 text-sm text-muted">A place, a night, a memory worth keeping.</p>
          </Link>
        )}
      </section>

      {suggested.length > 0 && (
        <section className="mt-10" aria-labelledby="discover-h">
          <div className="flex items-center justify-between">
            <h2 id="discover-h" className="text-sm font-medium text-muted">Discover travellers</h2>
            <Link href="/explore" className="text-xs text-accent hover:underline">See all</Link>
          </div>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
            {suggested.map((p) => (
              <div key={p.id} className="flex w-36 shrink-0 flex-col items-center rounded-lg border border-line bg-surface px-3 py-4 text-center">
                <Link
                  href={`/u/${p.username}`}
                  aria-label={p.display_name}
                  className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-line bg-raised font-serif text-lg text-muted"
                >
                  {p.avatar_url ? (
                    <Image src={p.avatar_url} alt="" width={56} height={56} className="h-full w-full object-cover" />
                  ) : (
                    p.display_name.charAt(0)
                  )}
                </Link>
                <Link href={`/u/${p.username}`} className="mt-2 line-clamp-1 text-sm font-medium hover:text-accent">
                  {p.display_name}
                </Link>
                <p className="text-xs text-muted">{countsByUser.get(p.id) ?? 0} countries</p>
                <div className="mt-2">
                  <FollowButton targetId={p.id} visibility="public" initialFollowing={false} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

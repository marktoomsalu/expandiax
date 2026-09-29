import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { LikeButton } from "@/components/LikeButton";
import { FeedExplore } from "@/components/network/FeedExplore";
import { DreamButton } from "@/components/network/DreamButton";
import { FeedTabs, SearchBox } from "@/components/feed/FeedTabs";
import { liveKey } from "@/lib/explore";
import { CommentSection } from "@/components/CommentSection";
import { FeedMemoryCard, type FeedMediaItem } from "@/components/FeedMemoryCard";
import { countryByCode } from "@/lib/countries";
import { eventTypeMeta } from "@/lib/events";
import { flagGradientColors } from "@/lib/flagColors";
import {
  groupCountryBursts,
  pickResurfacedMemory,
  splitFresh,
  type CountryBurst,
  type OwnCountryLite,
  type OwnEventLite,
} from "@/lib/feedSections";
import { loadThenMemory } from "@/lib/thenMemory";
import { ThenCard } from "@/components/ThenCard";
import { ArtistsOnTour, NearbyEventsRow } from "@/components/UpcomingShows";
import { TogetherSection } from "@/components/TogetherSection";
import { CountryBurstCard } from "@/components/CountryBurstCard";
import { stockPhotoFor } from "@/lib/stockPhotos";
import { artistsSeenLive } from "@/lib/concerts";
import { whereAmI } from "@/lib/location";
import { formatDate, formatMonthYear, formatRelative } from "@/lib/utils";
import type { CommentWithAuthor, FeedEvent, Profile } from "@/lib/types";
import { signMedia } from "@/lib/signedMedia";

export const metadata = { title: "Feed" };

const PAGE_SIZE = 30;

type RawMedia = FeedMediaItem & { displayOrder: number };


export default async function FeedPage({ searchParams }: { searchParams?: { limit?: string; tab?: string; q?: string } }) {
  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");

  const limit = Math.min(Math.max(Number(searchParams?.limit) || PAGE_SIZE, PAGE_SIZE), 300);
  const tab = searchParams?.tab === "explore" ? "explore" : "friends";
  // Safe inside a PostgREST filter: no commas, brackets or wildcards of its own.
  const q = (searchParams?.q ?? "").replace(/[%,()*\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

  const { data: followingRows } = await supabase.from("follows").select("followee_id").eq("follower_id", user.id);
  const followeeIds = (followingRows ?? []).map((r) => r.followee_id);

  const [{ data: viewerProfile }, { data: ownEventsRaw }, { data: ownCountriesRaw }] = await Promise.all([
    supabase.from("profiles").select("feed_last_seen_at, username, display_name, avatar_url, home_country_code").eq("id", user.id).single(),
    supabase
      .from("events")
      .select("id, title, event_date, event_type, spotify_artist_name, spotify_artist_image, cover_media_id, is_favourite, event_media!event_media_event_id_fkey(count)")
      .eq("user_id", user.id),
    supabase
      .from("visited_countries")
      .select(
        "id, country_code, country_name, cover_media_id, is_favourite, country_media!country_media_visited_country_id_fkey(count), country_visits(year, visited_from, visited_to, date_precision)"
      )
      .eq("user_id", user.id),
  ]);
  // Captured before the update below overwrites it — "new since your last
  // visit" has to compare against where you last left off, not against
  // the value this same page load is about to set.
  const previousLastSeenAt = viewerProfile?.feed_last_seen_at ?? null;
  const ownEvents: OwnEventLite[] = (ownEventsRaw ?? []).map(({ event_media, ...e }) => ({
    ...e,
    media_count: (event_media as unknown as { count: number }[])[0]?.count ?? 0,
  }));
  const ownCountries: OwnCountryLite[] = (ownCountriesRaw ?? []).map(({ country_media, ...c }) => ({
    ...(c as unknown as Omit<OwnCountryLite, "media_count">),
    media_count: (country_media as unknown as { count: number }[])[0]?.count ?? 0,
  }));

  const now = new Date();
  const picked = viewerProfile?.username ? pickResurfacedMemory(ownEvents, ownCountries, user.id, now, viewerProfile.username) : null;
  const then = picked ? await loadThenMemory(supabase, picked, now) : null;

  const liveArtists = artistsSeenLive(ownEventsRaw ?? []);
  const nearby = whereAmI(viewerProfile?.home_country_code ?? null);

  // EXPLORE — its own view, so discovery never interrupts your friends' posts
  // (and looking around doesn't count as having caught up on them).
  if (tab === "explore") {
    return (
      <div className="mx-auto max-w-2xl px-5 py-6">
        <FeedTabs tab="explore" />
        <SearchBox action="/explore" placeholder="Search places, people, or interests…" />
        <Suspense fallback={<p className="mt-10 text-center text-sm text-muted">Finding places and people…</p>}>
          <FeedExplore viewerId={user.id}>
            <section className="space-y-8" aria-labelledby="next-h">
              <h2 id="next-h" className="font-serif text-2xl">
                Coming up
              </h2>
              <Suspense fallback={null}>
                <ArtistsOnTour artists={liveArtists} homeCountry={viewerProfile?.home_country_code ?? null} />
              </Suspense>
              <Suspense fallback={null}>
                <NearbyEventsRow where={nearby?.where ?? null} place={nearby?.place ?? null} seenArtists={artistsSeenLive(ownEventsRaw ?? [], 50)} />
              </Suspense>
            </section>
          </FeedExplore>
        </Suspense>
      </div>
    );
  }

  // Your dreams, so each post's Dream it shows whether it's already one.
  const [{ data: dreamPlaces }, { data: dreamEvents }] = await Promise.all([
    supabase.from("want_to_go").select("country_code, place_name"),
    supabase.from("dream_events").select("name"),
  ]);
  const dreamedPlaces = new Set((dreamPlaces ?? []).map((d) => `${d.country_code}:${d.place_name.toLowerCase()}`));
  const dreamedEvents = new Set((dreamEvents ?? []).map((d) => liveKey(d.name)));

  // Searching your friends' posts: by place, title, words, or who.
  let searchActors: string[] = [];
  if (q && followeeIds.length) {
    const { data: who } = await supabase.from("profiles").select("id").in("id", followeeIds).or(`display_name.ilike.%${q}%,username.ilike.%${q}%`);
    searchActors = (who ?? []).map((p) => p.id);
  }


  let items: FeedEvent[] = [];
  let actors = new Map<string, Pick<Profile, "id" | "username" | "display_name" | "avatar_url" | "created_at">>();
  const likedByMe = new Set<string>();
  const commentsByKey = new Map<string, CommentWithAuthor[]>();
  const mediaByKey = new Map<string, RawMedia[]>();

  if (followeeIds.length > 0) {
    const { data: feedData } = await signMedia(await supabase
      .from("feed_events")
      .select("*")
      .in("actor_id", followeeIds)
      .or(
        q
          ? [
              ...["title", "country_name", "city", "venue", "body", "subtitle"].map((f) => `${f}.ilike.%${q}%`),
              ...(searchActors.length ? [`actor_id.in.(${searchActors.join(",")})`] : []),
            ].join(",")
          : "actor_id.not.is.null"
      )
      .order("created_at", { ascending: false })
      .limit(q ? 100 : limit));
    items = (feedData ?? []) as FeedEvent[];

    if (items.length > 0) {
      const actorIds = [...new Set(items.map((i) => i.actor_id))];
      const refIds = items.map((i) => i.ref_id);
      const countryRefIds = items.filter((i) => i.kind === "country").map((i) => i.ref_id);
      const eventRefIds = items.filter((i) => i.kind === "event").map((i) => i.ref_id);
      const [{ data: profiles }, { data: likeRows }, { data: commentRows }, { data: countryMediaRows }, { data: eventMediaRows }] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name, avatar_url, created_at").in("id", actorIds),
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
      ]).then((r) => signMedia(r));
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



  if (!q) await supabase.from("profiles").update({ feed_last_seen_at: new Date().toISOString() }).eq("id", user.id);

  // A country post with nothing but the country in it — part of a burst if several come at once.
  const isBareCountry = (item: FeedEvent) =>
    item.kind === "country" && !(mediaByKey.get(`country:${item.ref_id}`)?.length) && !item.cover_url && !item.body?.trim() && !item.spotify_track_id;

  // Group first, then split into new / earlier — so one person's burst of
  // countries is always a single card, never cut in two by the caught-up line.
  const entries = groupCountryBursts(items, isBareCountry, { joinedAt: (id) => actors.get(id)?.created_at });
  const timed = entries.map((entry) => ({ entry, created_at: entry.kind === "burst" ? entry.items[0].created_at : entry.created_at }));
  const split = splitFresh(timed, previousLastSeenAt);
  const fresh = split.fresh.map((t) => t.entry);
  const earlier = split.earlier.map((t) => t.entry);

  const renderEntry = (entry: FeedEvent | CountryBurst<FeedEvent>, index: number) => {
    if (entry.kind !== "burst") return renderPost(entry, index);
    const actor = actors.get(entry.actorId);
    if (!actor) return null;
    const newest = entry.items[0].created_at;
    // A burst within a week of joining is someone's first map — welcome them.
    const isNewMember = !!actor.created_at && Date.parse(newest) - Date.parse(actor.created_at) < 7 * 86_400_000;
    return (
      <li key={`burst:${entry.items[0].ref_id}`} className="card overflow-hidden">
        <CountryBurstCard actor={actor} codes={entry.items.map((i) => i.country_code)} isNewMember={isNewMember} when={formatRelative(newest)} />
      </li>
    );
  };

  const renderPost = (item: FeedEvent, index: number) => {
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
    const location =
      item.kind === "event"
        ? [item.venue, item.city || item.country_name].filter(Boolean).join(", ") || null
        : item.city || null;
    return (
      <li key={key} className="card overflow-hidden">
        <FeedMemoryCard
          href={href}
          kind={item.kind}
          eventType={item.event_type}
          flag={meta?.flag}
          countryName={meta?.name ?? item.country_name}
          title={item.title}
          subtitle={item.subtitle}
          body={item.body}
          dateLabel={dateLabel}
          location={location}
          track={
            item.spotify_track_name
              ? { name: item.spotify_track_name, artist: item.spotify_track_artist, spotifyId: item.spotify_track_id }
              : null
          }
          media={media}
          gradient={flagGradientColors(item.country_code)}
          stock={item.kind === "country" && media.length === 0 ? stockPhotoFor(item.country_code, item.actor_id) : null}
          priority={index === 0}
          actor={actor}
          actionLabel={item.kind === "country" ? "added a country" :`logged a ${typeLabel}`}
          when={formatRelative(item.created_at)}
          actions={
            <>
              <LikeButton kind={item.kind} targetId={item.ref_id} initialLiked={likedByMe.has(key)} />
              {item.kind === "event" ? (
                <DreamButton
                  variant="small"
                  target={{ kind: "event", name: item.title, eventType: item.event_type ?? "other" }}
                  initial={dreamedEvents.has(liveKey(item.title))}
                  label={item.title}
                />
              ) : (
                <DreamButton
                  variant="small"
                  target={{ kind: "place", countryCode: item.country_code, placeName: item.city ?? "" }}
                  initial={dreamedPlaces.has(`${item.country_code}:${(item.city ?? "").toLowerCase()}`)}
                  label={item.city || meta?.name || item.country_name || "this place"}
                />
              )}
            </>
          }
        />
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
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-6">
      <FeedTabs tab="friends" />
      <SearchBox action="/feed" placeholder="Search your friends' trips, places or moments…" defaultValue={q} />

      {q ? (
        <section className="mt-8" aria-labelledby="results-h">
          <div className="flex items-end justify-between gap-4">
            <h2 id="results-h" className="font-serif text-2xl">
              Results for &ldquo;{q}&rdquo;
            </h2>
            <Link href="/feed" className="shrink-0 text-sm font-medium text-accent hover:underline">
              Clear
            </Link>
          </div>
          {items.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nothing from people you follow matches &ldquo;{q}&rdquo;.</p>
          ) : (
            <ul className="mt-4 space-y-8">{items.map((item, i) => renderPost(item, i))}</ul>
          )}
        </section>
      ) : (
        <>
      {followeeIds.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Your feed is quiet."
            body="Follow other travellers to see the countries they pin and the events they log, right here."
            actionLabel="Find people in Explore"
            actionHref="/feed?tab=explore"
          />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Nothing yet." body="The people you follow haven't added anything public yet - check back soon." />
        </div>
      ) : null}

      {/* NEW — added by people you follow since your last visit */}
      {fresh.length > 0 && (
        <section className="mt-8" aria-labelledby="new-h">
          <h2 id="new-h" className="font-serif text-2xl">Latest from friends</h2>
          <ul className="mt-4 space-y-8">{fresh.map((entry, i) => renderEntry(entry, i))}</ul>
        </section>
      )}

      {/* The caught-up point: your own memory comes before older posts. */}
      {items.length > 0 && (
        <div className="mt-10 flex items-center gap-3" role="status">
          <span className="h-px flex-1 bg-line" aria-hidden />
          <span className="flex flex-col items-center text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
              <CheckCircle2 size={20} aria-hidden />
            </span>
            <span className="mt-2 font-serif text-lg">You&rsquo;re all caught up</span>
            <span className="text-xs text-muted">
              {fresh.length > 0 ? "That's everything new from people you follow." : "Nothing new since your last visit."}
            </span>
          </span>
          <span className="h-px flex-1 bg-line" aria-hidden />
        </div>
      )}

      {/* THEN — a memory resurfaced from your own past */}
      {then && (
        <section className="mt-10" aria-labelledby="then-h">
          <h2 id="then-h" className="flex items-center gap-1.5 text-sm font-medium text-muted">
            <Clock size={14} aria-hidden /> One to remember
          </h2>
          <ThenCard m={then} />
        </section>
      )}

      {/* TOGETHER — moments shared with people you follow */}
      {viewerProfile?.username && (
        <Suspense fallback={null}>
          <TogetherSection
            userId={user.id}
            followeeIds={followeeIds}
            homeCountry={viewerProfile.home_country_code ?? null}
            me={{ username: viewerProfile.username, display_name: viewerProfile.display_name, avatar_url: viewerProfile.avatar_url }}
          />
        </Suspense>
      )}

      {/* EARLIER — posts from before your last visit */}
      {earlier.length > 0 && (
        <section className="mt-12" aria-labelledby="earlier-h">
          <h2 id="earlier-h" className="text-sm font-medium text-muted">Earlier from people you follow</h2>
          <ul className="mt-4 space-y-8">{earlier.map((entry, i) => renderEntry(entry, fresh.length + i))}</ul>
          {items.length >= limit && (
            <div className="mt-8 flex justify-center">
              <Link href={`/feed?limit=${limit + PAGE_SIZE}#earlier-h`} className="btn-ghost">
                Load more
              </Link>
            </div>
          )}
        </section>
      )}
        </>
      )}
    </div>
  );
}

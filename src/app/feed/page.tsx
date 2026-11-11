import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { FeedExplore } from "@/components/network/FeedExplore";
import { FeedTabs, SearchBox } from "@/components/feed/FeedTabs";
import { LoadMore } from "@/components/LoadMore";
import { PersonCard } from "@/components/PersonCard";
import { searchPeople } from "@/lib/peopleSearch";
import { FirstFriends } from "@/components/FirstFriends";
import type { FeedMediaItem } from "@/components/FeedMemoryCard";
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
import { TogetherSection } from "@/components/TogetherSection";
import { CountryBurstCard } from "@/components/CountryBurstCard";
import { whereAmI } from "@/lib/location";
import { formatRelative } from "@/lib/utils";
import type { CommentWithAuthor, FeedEvent, Profile } from "@/lib/types";
import { signMedia } from "@/lib/signedMedia";
import { SuggestedPeopleRow } from "@/components/network/SuggestedPeopleRow";
import { FeedPost } from "@/components/FeedPost";
import { StickyTabs } from "@/components/feed/StickyTabs";

export const metadata = { title: "Feed" };

const PAGE_SIZE = 30;

type RawMedia = FeedMediaItem & { displayOrder: number };


export default async function FeedPage({ searchParams }: { searchParams?: { limit?: string; seen?: string; tab?: string; q?: string; city?: string; cc?: string; lat?: string; lng?: string; friends?: string; remember?: string } }) {
  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");

  const limit = Math.min(Math.max(Number(searchParams?.limit) || PAGE_SIZE, PAGE_SIZE), 300);
  const tab = searchParams?.tab === "explore" ? "explore" : "friends";
  // Safe inside a PostgREST filter: no commas, brackets or wildcards of its own.
  const q = (searchParams?.q ?? "").replace(/[%,()*\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

  // Everything that only needs who you are, in one round trip's time.
  const [{ data: followingRows }, { data: viewerProfile }, { data: ownEventsRaw }, { data: ownCountriesRaw }] = await Promise.all([
    supabase.from("follows").select("followee_id").eq("follower_id", user.id),
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
  const followeeIds = (followingRows ?? []).map((r) => r.followee_id);
  // Captured before the update below overwrites it — "new since your last
  // visit" has to compare against where you last left off, not against
  // the value this same page load is about to set.
  // "Load more" passes along the cut-off this visit started with, so posts
  // don't move from "new" to "Earlier" (and the page jump) as you page.
  const seenParam = searchParams?.seen && !Number.isNaN(Date.parse(searchParams.seen)) ? searchParams.seen : null;
  const previousLastSeenAt = searchParams?.limit && seenParam ? seenParam : viewerProfile?.feed_last_seen_at ?? null;
  const ownEvents: OwnEventLite[] = (ownEventsRaw ?? []).map(({ event_media, ...e }) => ({
    ...e,
    media_count: (event_media as unknown as { count: number }[])[0]?.count ?? 0,
  }));
  const ownCountries: OwnCountryLite[] = (ownCountriesRaw ?? []).map(({ country_media, ...c }) => ({
    ...(c as unknown as Omit<OwnCountryLite, "media_count">),
    media_count: (country_media as unknown as { count: number }[])[0]?.count ?? 0,
  }));

  // A city picked on the Explore tab rides along in the address.
  const here = whereAmI(viewerProfile?.home_country_code ?? null, searchParams);

  // EXPLORE — its own view, so discovery never interrupts your friends' posts
  // (and looking around doesn't count as having caught up on them).
  if (tab === "explore") {
    return (
      <div className="mx-auto max-w-2xl px-5 py-6">
        <StickyTabs>
          <FeedTabs tab="explore" />
        </StickyTabs>
        <SearchBox action="/explore" placeholder="Search people, places or artists…" />
        <Suspense fallback={<p className="mt-10 text-center text-sm text-muted">Finding places and people…</p>}>
          <FeedExplore
            viewerId={user.id}
            here={here}
            homeCountry={viewerProfile?.home_country_code ?? null}
            me={{ username: viewerProfile?.username ?? "", display_name: viewerProfile?.display_name ?? "You", avatar_url: viewerProfile?.avatar_url ?? null }}
          />
        </Suspense>
      </div>
    );
  }


  // Searching: people first (anyone you could find in Explore), then your
  // friends' posts by place, title, words, or who.
  const people = q ? await searchPeople(supabase, q, user.id, 6) : [];
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

  // The resurfaced memory loads alongside the posts, not after them.
  const now = new Date();
  // A memory reminder names the memory it was about ("country:<id>"); that one shows.
  const remembered = (() => {
    const [kind, id] = (searchParams?.remember ?? "").split(":");
    const me = viewerProfile?.username;
    if (!me || !id) return null;
    if (kind === "event") {
      const e = ownEvents.find((x) => x.id === id);
      return e ? { kind: "event" as const, id, title: e.title, subtitle: "One to remember", href: `/u/${me}/events/${id}`, isAnniversary: false } : null;
    }
    const c = kind === "country" ? ownCountries.find((x) => x.id === id) : null;
    return c ? { kind: "country" as const, id, title: c.country_name, subtitle: "One to remember", href: `/u/${me}/countries/${c.country_code.toLowerCase()}`, isAnniversary: false } : null;
  })();
  const picked = remembered ?? (viewerProfile?.username ? pickResurfacedMemory(ownEvents, ownCountries, user.id, now, viewerProfile.username) : null);
  const thenPending = picked ? loadThenMemory(supabase, picked, now, user.id) : Promise.resolve(null);

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



  // The memory (already on its way) and "seen up to now" finish together.
  const [then] = await Promise.all([
    thenPending,
    q ? Promise.resolve(null) : supabase.from("profiles").update({ feed_last_seen_at: new Date().toISOString() }).eq("id", user.id).then(() => null),
  ]);

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

  // "Suggested for you" sits a few posts in, like a post of its own (or under
  // the empty feed, where finding people matters most).
  const suggested = (
    <li key="suggested-people">
      <Suspense fallback={null}>
        <SuggestedPeopleRow viewerId={user.id} />
      </Suspense>
    </li>
  );
  const suggestInFresh = fresh.length >= 3;
  const suggestAt = suggestInFresh ? 3 : Math.min(earlier.length, Math.max(1, 3 - fresh.length));
  const withSuggested = (nodes: React.ReactNode[], here: boolean) => (here ? [...nodes.slice(0, suggestAt), suggested, ...nodes.slice(suggestAt)] : nodes);

  const renderEntry = (entry: FeedEvent | CountryBurst<FeedEvent>, index: number) => {
    if (entry.kind !== "burst") return renderPost(entry, index);
    const actor = actors.get(entry.actorId);
    if (!actor) return null;
    const newest = entry.items[0].created_at;
    // A burst within a week of joining is someone's first map — welcome them.
    const isNewMember = !!actor.created_at && Date.parse(newest) - Date.parse(actor.created_at) < 7 * 86_400_000;
    return (
      <li key={`burst:${entry.items[0].ref_id}`} data-feed-key={`burst:${entry.items[0].ref_id}`} className="card overflow-hidden">
        <CountryBurstCard actor={actor} codes={entry.items.map((i) => i.country_code)} isNewMember={isNewMember} when={formatRelative(newest)} />
      </li>
    );
  };

  // The same post card as everywhere else (FeedPost).
  const postCtx = { actors, likedByMe, commentsByKey, mediaByKey };
  const renderPost = (item: FeedEvent, index: number) => <FeedPost key={`${item.kind}:${item.ref_id}`} item={item} ctx={postCtx} index={index} />;

  return (
    <div className="mx-auto max-w-2xl px-5 py-6">
      <StickyTabs>
        <FeedTabs tab="friends" />
      </StickyTabs>
      <Suspense fallback={null}>
        <FirstFriends userId={user.id} force={searchParams?.friends === "1"} />
      </Suspense>
      <SearchBox action="/feed" placeholder="Search people and experiences…" defaultValue={q} />

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
          {people.length > 0 && (
            <div className="mt-5">
              <h3 className="eyebrow">People</h3>
              <ul className="mt-3 space-y-3">
                {people.map((p) => (
                  <li key={p.id}>
                    <PersonCard
                      p={p}
                      detail={`@${p.username} · ${p.countries} ${p.countries === 1 ? "country" : "countries"}${p.following ? " · Following" : ""}`}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {items.length > 0 ? (
            <div className="mt-8">
              {people.length > 0 && <h3 className="eyebrow">Trips, stays &amp; events</h3>}
              <ul className="mt-4 space-y-8">{items.map((item, i) => renderPost(item, i))}</ul>
            </div>
          ) : people.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nothing matches &ldquo;{q}&rdquo; yet.</p>
          ) : (
            <p className="mt-6 text-sm text-muted">No trips or events from people you follow match &ldquo;{q}&rdquo;.</p>
          )}
        </section>
      ) : (
        <>
      {followeeIds.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Your feed is quiet."
            body="Follow other travellers to see the countries they pin and the events they log, right here."
            actionLabel="Find friends"
            actionHref="/feed?friends=1"
          />
          <p className="mt-3 text-center text-sm">
            <Link href="/invite" className="font-medium text-accent">
              Or invite friends: you&rsquo;ll follow each other when they join →
            </Link>
          </p>
          <ul className="mt-8">{suggested}</ul>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Nothing yet." body="The people you follow haven't added anything public yet - check back soon." />
          <ul className="mt-8">{suggested}</ul>
        </div>
      ) : null}

      {/* NEW — added by people you follow since your last visit */}
      {fresh.length > 0 && (
        <section className="mt-8" aria-labelledby="new-h">
          <h2 id="new-h" className="font-serif text-2xl">Latest from people you follow</h2>
          <ul className="mt-4 space-y-8">{withSuggested(fresh.map((entry, i) => renderEntry(entry, i)), suggestInFresh)}</ul>
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
              {fresh.length > 0 ? "That's everything new from people you follow." : "More memories are being made."}
            </span>
          </span>
          <span className="h-px flex-1 bg-line" aria-hidden />
        </div>
      )}

      {/* THEN — a memory resurfaced from your own past */}
      {then && (
        <section id="one-to-remember" className="mt-10 scroll-mt-24" aria-labelledby="then-h">
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
          <ul className="mt-4 space-y-8">{withSuggested(earlier.map((entry, i) => renderEntry(entry, fresh.length + i)), !suggestInFresh && earlier.length > 0)}</ul>
          <LoadMore
            href={`/feed?limit=${limit + PAGE_SIZE}${previousLastSeenAt ? `&seen=${encodeURIComponent(previousLastSeenAt)}` : ""}`}
            shown={limit}
            more={items.length >= limit}
          />
        </section>
      )}
        </>
      )}
    </div>
  );
}

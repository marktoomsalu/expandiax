import Link from "next/link";
import { Suspense } from "react";
import Image from "next/image";
import { CheckCircle2, Clock, Compass, Globe2, Ticket, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { GreetingHeader } from "@/components/GreetingHeader";
import { LikeButton } from "@/components/LikeButton";
import { FollowButton } from "@/components/FollowButton";
import { CommentSection } from "@/components/CommentSection";
import { FeedMemoryCard, type FeedMediaItem } from "@/components/FeedMemoryCard";
import { IWasThereButton } from "@/components/IWasThereButton";
import { countryByCode } from "@/lib/countries";
import { eventTypeMeta } from "@/lib/events";
import { flagGradientColors } from "@/lib/flagColors";
import {
  buildNextSuggestions,
  buildTogetherCards,
  eventMatchKey,
  pickResurfacedMemory,
  splitFresh,
  type OwnCountryLite,
  type OwnEventLite,
} from "@/lib/feedSections";
import { loadThenMemory } from "@/lib/thenMemory";
import { ThenCard } from "@/components/ThenCard";
import { ArtistsOnTour, NearbyEventsRow } from "@/components/UpcomingShows";
import { artistsSeenLive, type NearbyWhere } from "@/lib/concerts";
import { formatDate, formatMonthYear, formatRelative } from "@/lib/utils";
import type { CommentWithAuthor, FeedEvent, Profile } from "@/lib/types";

export const metadata = { title: "Feed" };

const PAGE_SIZE = 30;

type RawMedia = FeedMediaItem & { displayOrder: number };

// "Near you" = the approximate city Vercel works out from the connection
// (no location permission, and it follows you when you travel), rounded
// before it leaves us; otherwise the home country from the profile.
function whereNearby(homeCountry: string | null): { where: NearbyWhere; place: string } | null {
  const h = headers();
  const lat = Number(h.get("x-vercel-ip-latitude"));
  const lng = Number(h.get("x-vercel-ip-longitude"));
  let city = "";
  try {
    city = decodeURIComponent(h.get("x-vercel-ip-city") ?? "").trim();
  } catch {}
  if (h.get("x-vercel-ip-latitude") && Number.isFinite(lat) && Number.isFinite(lng)) {
    const country = countryByCode(h.get("x-vercel-ip-country"));
    return { where: { lat, lng }, place: city || country?.name || "you" };
  }
  const home = countryByCode(homeCountry);
  return home ? { where: { countryCode: home.code }, place: home.name } : null;
}

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

  const ownEvents: OwnEventLite[] = (ownEventsRaw ?? []).map(({ event_media, ...e }) => ({
    ...e,
    media_count: (event_media as unknown as { count: number }[])[0]?.count ?? 0,
  }));
  const ownCountries: OwnCountryLite[] = (ownCountriesRaw ?? []).map(({ country_media, ...c }) => ({
    ...(c as unknown as Omit<OwnCountryLite, "media_count">),
    media_count: (country_media as unknown as { count: number }[])[0]?.count ?? 0,
  }));
  const ownEventsByKey = new Map(ownEvents.map((e) => [eventMatchKey(e.title, e.event_date), e.id]));
  const ownCountryCodes = new Set(ownCountries.map((c) => c.country_code));

  const now = new Date();
  const picked = viewerProfile?.username ? pickResurfacedMemory(ownEvents, ownCountries, user.id, now, viewerProfile.username) : null;
  const then = picked ? await loadThenMemory(supabase, picked, now) : null;

  const liveArtists = artistsSeenLive(ownEventsRaw ?? []);
  const nearby = whereNearby(viewerProfile?.home_country_code ?? null);

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

  const { fresh, earlier } = splitFresh(items, previousLastSeenAt);

  await supabase.from("profiles").update({ feed_last_seen_at: new Date().toISOString() }).eq("id", user.id);

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
          priority={index === 0}
          actor={actor}
          actionLabel={item.kind === "country" ? "added a country" :`logged a ${typeLabel}`}
          when={formatRelative(item.created_at)}
          actions={<LikeButton kind={item.kind} targetId={item.ref_id} initialLiked={likedByMe.has(key)} />}
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

      <div className="card mt-5 flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
        <p className="font-serif text-lg">What&rsquo;s worth remembering?</p>
        <div className="flex gap-2">
          <Link href="/my-world#country-search" className="btn-ghost !px-3.5 !py-2 text-sm">
            <Globe2 size={15} /> A place
          </Link>
          <Link href="/events/new" className="btn-accent !px-3.5 !py-2 text-sm">
            <Ticket size={15} /> An event
          </Link>
        </div>
      </div>

      {followeeIds.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Your feed is quiet."
            body="Follow other travellers to see the countries they pin and the events they log, right here."
            actionLabel="Explore travellers"
            actionHref="/explore"
          />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Nothing yet." body="The people you follow haven't added anything public yet - check back soon." />
        </div>
      ) : null}

      {/* NEW — added by people you follow since your last visit */}
      {fresh.length > 0 && (
        <section className="mt-6" aria-labelledby="new-h">
          <h2 id="new-h" className="text-sm font-medium text-muted">New</h2>
          <ul className="mt-4 space-y-8">{fresh.map((item, i) => renderPost(item, i))}</ul>
        </section>
      )}

      {/* The caught-up point: your own memory and what's next come before older posts. */}
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
            <Clock size={14} aria-hidden /> Then
          </h2>
          <ThenCard m={then} />
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
      <section className="mt-10 space-y-8" aria-labelledby="next-h">
        <h2 id="next-h" className="flex items-center gap-1.5 text-sm font-medium text-muted">
          <Globe2 size={14} aria-hidden /> Next
        </h2>

        <Suspense fallback={null}>
          <ArtistsOnTour artists={liveArtists} homeCountry={viewerProfile?.home_country_code ?? null} />
        </Suspense>

        <Suspense fallback={null}>
          <NearbyEventsRow where={nearby?.where ?? null} place={nearby?.place ?? null} seenArtists={artistsSeenLive(ownEventsRaw ?? [], 50)} />
        </Suspense>

        {next.length > 0 ? (
          <div>
            <h3 className="mb-3 font-serif text-xl">Where your friends have been</h3>
            <ul className="flex flex-wrap gap-2.5">
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
          </div>
        ) : (
          <Link href="/start" className="card block p-4 text-center transition-shadow hover:shadow-sm">
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
      {/* EARLIER — posts from before your last visit */}
      {earlier.length > 0 && (
        <section className="mt-12" aria-labelledby="earlier-h">
          <h2 id="earlier-h" className="text-sm font-medium text-muted">Earlier from people you follow</h2>
          <ul className="mt-4 space-y-8">{earlier.map((item, i) => renderPost(item, fresh.length + i))}</ul>
          {items.length >= limit && (
            <div className="mt-8 flex justify-center">
              <Link href={`/feed?limit=${limit + PAGE_SIZE}#earlier-h`} className="btn-ghost">
                Load more
              </Link>
            </div>
          )}
        </section>
      )}

    </div>
  );
}

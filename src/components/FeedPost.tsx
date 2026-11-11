import { CommentSection } from "@/components/CommentSection";
import { FeedMemoryCard, type FeedMediaItem } from "@/components/FeedMemoryCard";
import { LikeButton } from "@/components/LikeButton";
import { countryByCode } from "@/lib/countries";
import { eventTypeMeta } from "@/lib/events";
import { flagGradientColors } from "@/lib/flagColors";
import { postKey, type PostContext } from "@/lib/feedPosts";
import { stockPhotoFor } from "@/lib/stockPhotos";
import { formatDate, formatMonthYear, formatRelative } from "@/lib/utils";
import type { FeedEvent } from "@/lib/types";

/**
 * One trip or event post, exactly as the feed shows it: who posted it, the
 * photos, the words, Like, and the comments. The feed, a post's own page and
 * a profile's trips all use this, so a post is the same post everywhere.
 */
export function FeedPost({
  item,
  ctx,
  index = 0,
  children,
  media: ownMedia,
  dateLabel: ownDate,
  actionLabel: ownAction,
  hideWhen = false,
  href: ownHref,
}: {
  item: FeedEvent;
  ctx: PostContext;
  index?: number;
  children?: React.ReactNode;
  /** One trip of a country (lib/userTrips): its own photos, dates and wording. */
  media?: FeedMediaItem[];
  dateLabel?: string;
  actionLabel?: string;
  /** A single trip: when the country was first added says nothing about it. */
  hideWhen?: boolean;
  /** Where tapping it goes (a single trip's page); otherwise worked out below. */
  href?: string;
}) {
  const actor = ctx.actors.get(item.actor_id);
  if (!actor) return null;
  const meta = countryByCode(item.country_code);
  const key = postKey(item);
  // A trip post opens the trip itself (the country's latest one); an event, the event.
  const trip = ctx.latestTrip.get(item.ref_id);
  const href =
    ownHref ??
    (item.kind === "country"
      ? trip
        ? `/u/${actor.username}/trips/${trip}`
        : `/u/${actor.username}/countries/${item.country_code.toLowerCase()}`
      : `/u/${actor.username}/events/${item.ref_id}`);
  const typeLabel = item.event_type ? eventTypeMeta(item.event_type).label.toLowerCase() : "event";
  const dateLabel = ownDate ?? (item.visit_date
    ? item.visit_date_precision === "month"
      ? formatMonthYear(item.visit_date)
      : formatDate(item.visit_date)
    : item.visit_year
      ? String(item.visit_year)
      : null);
  const rawMedia = ctx.mediaByKey.get(key) ?? [];
  const media: FeedMediaItem[] = ownMedia ??
    (rawMedia.length > 0
      ? [...rawMedia].sort((a, b) => (a.url === item.cover_url ? -1 : b.url === item.cover_url ? 1 : 0))
      : item.cover_url
        ? [{ id: key, url: item.cover_url, type: item.cover_media_type ?? "image", alt: item.title }]
        : []);
  const location = item.kind === "event" ? [item.venue, item.city || item.country_name].filter(Boolean).join(", ") || null : item.city || null;
  return (
    <li key={key} data-feed-key={key} className="card overflow-hidden">
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
        track={item.spotify_track_name ? { name: item.spotify_track_name, artist: item.spotify_track_artist, spotifyId: item.spotify_track_id } : null}
        media={media}
        gradient={flagGradientColors(item.country_code)}
        stock={item.kind === "country" && media.length === 0 ? stockPhotoFor(item.country_code, item.actor_id) : null}
        priority={index === 0}
        actor={actor}
        actionLabel={ownAction ?? (item.kind === "country" ? "added a country" : `logged a ${typeLabel}`)}
        when={hideWhen ? "" : formatRelative(item.created_at)}
        actions={<LikeButton kind={item.kind} targetId={item.ref_id} initialLiked={ctx.likedByMe.has(key)} />}
      />
      <div className="border-t border-line px-4 py-3 sm:px-5">
        <CommentSection kind={item.kind} targetId={item.ref_id} posterId={item.actor_id} initialComments={ctx.commentsByKey.get(key) ?? []} />
      </div>
      {children}
    </li>
  );
}

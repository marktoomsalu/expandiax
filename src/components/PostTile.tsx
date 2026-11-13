import Image from "next/image";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { StockImage } from "@/components/StockImage";
import { StockCredit } from "@/components/StockCredit";
import { countryByCode } from "@/lib/countries";
import { eventTypeMeta } from "@/lib/events";
import { postKey, type PostContext } from "@/lib/feedPosts";
import { focalPosition } from "@/lib/media";
import { stockPhotoFor } from "@/lib/stockPhotos";
import { formatDate, formatMonthYear } from "@/lib/utils";
import type { FeedEvent } from "@/lib/types";

/** A post in small, for a profile's recent trips and events: tapping it opens the post itself. */
export function PostTile({
  post,
  ctx,
  href,
  photo: ownPhoto,
  eyebrow: ownEyebrow,
  comments: showComments = true,
}: {
  post: FeedEvent;
  ctx: PostContext;
  href: string;
  /** One trip of a country: its own cover photo (null: none) and dates. */
  photo?: { url: string; alt: string; focalX?: number | null; focalY?: number | null } | null;
  eyebrow?: string;
  comments?: boolean;
}) {
  const key = postKey(post);
  const first = (ctx.mediaByKey.get(key) ?? []).find((m) => m.type === "image");
  const cover = ownPhoto !== undefined ? ownPhoto : ((ctx.mediaByKey.get(key) ?? []).find((m) => m.url === post.cover_url && m.type === "image") ?? first);
  const coverUrl = cover?.url ?? (ownPhoto === undefined && post.cover_media_type !== "video" ? post.cover_url : null);
  // Only a video (no photo, no artist picture): its first frame stands in.
  const videoUrl = !coverUrl && ownPhoto === undefined && post.cover_media_type === "video" ? post.cover_url : null;
  const stock = !coverUrl && !videoUrl && post.kind === "country" ? stockPhotoFor(post.country_code, post.actor_id) : null;
  const meta = countryByCode(post.country_code);
  const comments = showComments ? (ctx.commentsByKey.get(key)?.length ?? 0) : 0;
  const when = post.visit_date ? (post.visit_date_precision === "month" ? formatMonthYear(post.visit_date) : formatDate(post.visit_date)) : post.visit_year ? String(post.visit_year) : null;
  const eyebrow = ownEyebrow ?? (post.kind === "event" ? [post.event_type ? eventTypeMeta(post.event_type).label : "Event", when].filter(Boolean).join(" · ") : when);
  const place = post.kind === "event" ? [post.venue, post.city || post.country_name].filter(Boolean).join(", ") : null;

  return (
    <li>
      <Link href={href} className="card group block h-full overflow-hidden">
        <div className="relative aspect-[16/9] w-full bg-ink/90">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={cover?.alt || post.title}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              style={cover ? { objectPosition: focalPosition({ focal_x: cover.focalX ?? null, focal_y: cover.focalY ?? null }) } : undefined}
            />
          ) : videoUrl ? (
            <video src={`${videoUrl}#t=0.1`} preload="metadata" muted playsInline className="pointer-events-none absolute inset-0 h-full w-full object-cover" aria-hidden />
          ) : stock ? (
            <div className="absolute inset-0" style={{ backgroundColor: stock.color }}>
              <StockImage photo={stock} aspect="2:1" sizes="(min-width: 640px) 50vw, 100vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" aria-hidden />
              <StockCredit photo={stock} linked={false} corner className="absolute bottom-2.5 right-3" />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center font-serif text-2xl italic text-canvas/90 dark:text-ink/90">{post.title}</div>
          )}
        </div>
        <div className="px-5 py-4">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <p className="mt-1 font-serif text-xl">
            {post.kind === "country" && meta ? `${meta.flag} ` : ""}
            {post.title}
          </p>
          {place && <p className="mt-0.5 truncate text-xs text-muted">{place}</p>}
          {post.body && <p className="mt-1.5 line-clamp-2 text-sm italic leading-relaxed text-muted">&ldquo;{post.body}&rdquo;</p>}
          {comments > 0 && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted">
              <MessageCircle size={13} aria-hidden /> {comments} {comments === 1 ? "comment" : "comments"}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}

"use client";

import type { StockPhoto } from "@/lib/stockPhotos";
import { cn } from "@/lib/utils";
import { ExternalLink } from "./ExternalLink";

/**
 * "Photo: Name / Unsplash". `linked` credits with links (the photographer
 * and Unsplash, as Unsplash asks); inside a card that is itself a link,
 * use plain text instead, since links can't sit inside links.
 */
export function StockCredit({ photo, linked = true, corner = false, className }: { photo: StockPhoto; linked?: boolean; corner?: boolean; className?: string }) {
  // A long name wraps neatly onto at most two tight lines (a touch smaller
  // when it's very long) instead of one awkward stretch. Credits in a photo's
  // corner pass `corner`: right-aligned, never wider than two thirds of it.
  const long = photo.author.length > 22;
  const cls = cn(
    "line-clamp-2 leading-[1.25] text-white/80 drop-shadow [overflow-wrap:anywhere]",
    long ? "text-[9px]" : "text-[10px]",
    corner && "max-w-[66%] text-right",
    className
  );
  if (!linked) return <span className={cls}>Photo: {photo.author} / Unsplash</span>;
  return (
    <span className={cls}>
      Photo:{" "}
      <ExternalLink href={photo.authorUrl} className="underline-offset-2 hover:underline">
        {photo.author}
      </ExternalLink>{" "}
      /{" "}
      <ExternalLink href={photo.unsplashUrl} className="underline-offset-2 hover:underline">
        Unsplash
      </ExternalLink>
    </span>
  );
}

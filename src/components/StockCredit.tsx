"use client";

import type { StockPhoto } from "@/lib/stockPhotos";
import { cn } from "@/lib/utils";
import { ExternalLink } from "./ExternalLink";

/**
 * "Photo: Name / Unsplash". `linked` credits with links (the photographer
 * and Unsplash, as Unsplash asks); inside a card that is itself a link,
 * use plain text instead, since links can't sit inside links.
 */
export function StockCredit({ photo, linked = true, className }: { photo: StockPhoto; linked?: boolean; className?: string }) {
  const cls = cn("text-[10px] leading-none text-white/80 drop-shadow", className);
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

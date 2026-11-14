"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export type CardPhoto = { id: string; url: string; alt: string };

/**
 * A card's photos, swiped through sideways like the country cards (one at a
 * time, with dots for which one this is). One photo: just that photo.
 */
export function CardPhotos({ photos, sizes, dotsClassName = "top-3" }: { photos: CardPhoto[]; sizes: string; dotsClassName?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  return (
    <>
      <div
        ref={scrollRef}
        onScroll={() => {
          const el = scrollRef.current;
          if (el) setActive(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="flex h-full snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((p, i) => (
          <div key={p.id} className="relative h-full w-full shrink-0 snap-start">
            <Image src={p.url} alt={p.alt} fill sizes={sizes} loading={i === 0 ? undefined : "lazy"} className="object-cover" />
          </div>
        ))}
      </div>
      {photos.length > 1 && (
        <div className={cn("pointer-events-none absolute left-1/2 flex -translate-x-1/2 gap-1", dotsClassName)} aria-hidden>
          {photos.slice(0, 10).map((p, i) => (
            <span key={p.id} className={cn("h-1.5 w-1.5 rounded-full shadow-sm", i === Math.min(active, 9) ? "bg-white" : "bg-white/45")} />
          ))}
        </div>
      )}
    </>
  );
}

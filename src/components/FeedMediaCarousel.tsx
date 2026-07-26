"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type FeedMediaItem = { id: string; url: string; type: "image" | "video"; alt: string };

export function FeedMediaCarousel({ items }: { items: FeedMediaItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  if (items.length === 0) return null;

  function scrollToIndex(i: number) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
  }

  function onScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    setActive(Math.round(track.scrollLeft / track.clientWidth));
  }

  return (
    <div className="relative aspect-[4/3] w-full bg-raised">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth"
      >
        {items.map((m) => (
          <div key={m.id} className="relative h-full w-full shrink-0 snap-center">
            {m.type === "video" ? (
              <video src={m.url} controls preload="metadata" className="h-full w-full bg-black object-contain" />
            ) : (
              <Image src={m.url} alt={m.alt} fill sizes="(min-width: 640px) 640px, 100vw" className="object-cover" />
            )}
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous"
            onClick={() => scrollToIndex(Math.max(0, active - 1))}
            disabled={active === 0}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white transition-opacity hover:bg-black/60 disabled:opacity-0"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => scrollToIndex(Math.min(items.length - 1, active + 1))}
            disabled={active === items.length - 1}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white transition-opacity hover:bg-black/60 disabled:opacity-0"
          >
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {items.map((m, i) => (
              <span key={m.id} className={cn("h-1.5 w-1.5 rounded-full", i === active ? "bg-white" : "bg-white/40")} aria-hidden />
            ))}
          </div>
          <span className="absolute right-2 top-2 z-10 rounded-full bg-black/40 px-2 py-0.5 text-[0.625rem] font-medium text-white">
            {active + 1}/{items.length}
          </span>
        </>
      )}
    </div>
  );
}

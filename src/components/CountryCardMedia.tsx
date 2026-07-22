"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type MediaItem = { id: string; public_url: string; caption: string };

export function CountryCardMedia({
  media,
  alt,
  flag,
  name,
  detail,
}: {
  media: MediaItem[];
  alt: string;
  flag?: string;
  name: string;
  detail: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex h-full snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {media.map((m) => (
          <div key={m.id} className="relative h-full w-full shrink-0 snap-start">
            <Image
              src={m.public_url}
              alt={m.caption || alt}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" aria-hidden />
      {media.length > 1 && (
        <div className="pointer-events-none absolute right-3 top-3 flex gap-1">
          {media.map((m, i) => (
            <span key={m.id} className={cn("h-1.5 w-1.5 rounded-full", i === active ? "bg-white" : "bg-white/40")} />
          ))}
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-4 pt-12 text-white">
        <p className="font-serif text-xl drop-shadow-sm">{flag} {name}</p>
        <p className="mt-0.5 text-xs text-white/75">{detail}</p>
      </div>
    </>
  );
}

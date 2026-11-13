"use client";

import { useState } from "react";
import Image from "next/image";
import { Image as ImageIcon } from "lucide-react";
import { MediaViewer, type ViewerItem } from "@/components/MediaViewer";
import { StockImage } from "@/components/StockImage";
import type { StockPhoto } from "@/lib/stockPhotos";

export type PlaceCard = {
  id: string;
  name: string;
  range: string | null;
  /** This place's own photos and videos, in the trip's order. */
  items: ViewerItem[];
  /** Shown when the place has no photo of its own. */
  stock: StockPhoto | null;
};

/**
 * The cities, towns and regions of a trip as cards. Tapping one opens its
 * own photos and videos full screen (swipe between them); a place without
 * any just shows its picture.
 */
export function TripPlaceCards({ places }: { places: PlaceCard[] }) {
  const [open, setOpen] = useState<PlaceCard | null>(null);

  return (
    <>
      <ul className="no-scrollbar -mx-5 mt-3 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
        {places.map((p) => {
          const pic = p.items.find((m) => m.type !== "video");
          const inner = (
            <>
              {pic ? (
                <Image src={pic.url} alt="" fill sizes="208px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : p.stock ? (
                <StockImage photo={p.stock} aspect="1:1" sizes="208px" className="opacity-80" />
              ) : null}
              <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" aria-hidden />
              <span className="absolute inset-x-0 bottom-0 p-3 text-left text-white">
                <span className="block truncate font-serif text-lg leading-tight">{p.name}</span>
                {p.range && <span className="block text-xs text-white/80">{p.range}</span>}
                {p.items.length > 0 && (
                  <span className="mt-1 flex items-center gap-1 text-xs text-white/80">
                    <ImageIcon size={12} aria-hidden /> {p.items.length}
                  </span>
                )}
              </span>
            </>
          );
          const box = "group relative block h-44 w-full overflow-hidden rounded-2xl bg-[#14110d] shadow-sm ring-1 ring-black/5";
          return (
            <li key={p.id} id={`place-${p.id}`} className="w-44 shrink-0 snap-start scroll-mt-24 sm:w-52">
              {p.items.length > 0 ? (
                <button type="button" onClick={() => setOpen(p)} className={`${box} cursor-zoom-in`} aria-label={`${p.name}: see ${p.items.length} ${p.items.length === 1 ? "photo" : "photos"}`}>
                  {inner}
                </button>
              ) : (
                <div className={box}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
      {open && <MediaViewer items={open.items} start={0} onClose={() => setOpen(null)} />}
    </>
  );
}

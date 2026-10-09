"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { MediaViewer, type ViewerItem } from "./MediaViewer";

export type GalleryPhoto = ViewerItem;

/** A grid of photos and videos; tapping one opens it full screen (MediaViewer). */
export function PhotoGallery({
  photos,
  gridClassName,
  itemClassName,
  sizes,
  coverId,
}: {
  photos: GalleryPhoto[];
  gridClassName: string;
  itemClassName: string;
  sizes: string;
  /** Shows a small "Cover" badge on the matching photo. */
  coverId?: string | null;
}) {
  const [index, setIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  return (
    <>
      <div className={gridClassName}>
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setIndex(i)}
            className={cn(itemClassName, "group cursor-zoom-in")}
            aria-label={`View ${p.type === "video" ? "video" : "photo"} ${i + 1} of ${photos.length}`}
          >
            {p.type === "video" ? (
              <>
                {/* The first frame stands in for a poster. */}
                <video src={`${p.url}#t=0.1`} preload="metadata" muted playsInline className="pointer-events-none h-full w-full bg-black object-cover" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white ring-1 ring-white/40 backdrop-blur">
                    <Play size={17} className="translate-x-px fill-white" aria-hidden />
                  </span>
                </span>
              </>
            ) : (
              <Image src={p.url} alt={p.alt} fill sizes={sizes} loading="lazy" className="object-cover transition-opacity group-hover:opacity-90" />
            )}
            {coverId === p.id && (
              <span className="absolute left-1.5 top-1.5 rounded-full bg-canvas/90 px-2 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wide text-accent">
                Cover
              </span>
            )}
          </button>
        ))}
      </div>

      {index !== null && <MediaViewer items={photos} start={index} onClose={() => setIndex(null)} />}
    </>
  );
}

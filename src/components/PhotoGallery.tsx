"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type GalleryPhoto = { id: string; url: string; alt: string };

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

  useEffect(() => {
    if (index === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIndex(null);
      if (e.key === "ArrowLeft") setIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
      if (e.key === "ArrowRight") setIndex((i) => (i === null ? null : (i + 1) % photos.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length]);

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
            aria-label={`View photo ${i + 1} of ${photos.length}`}
          >
            <Image src={p.url} alt={p.alt} fill sizes={sizes} loading="lazy" className="object-cover transition-opacity group-hover:opacity-90" />
            {coverId === p.id && (
              <span className="absolute left-1.5 top-1.5 rounded-full bg-canvas/90 px-2 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wide text-accent">
                Cover
              </span>
            )}
          </button>
        ))}
      </div>

      {index !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setIndex(null)}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 top-4 z-10 text-white/80 hover:text-white"
            onClick={() => setIndex(null)}
          >
            <X size={28} />
          </button>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 p-2 text-white/80 hover:text-white sm:left-4"
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
                }}
              >
                <ChevronLeft size={32} />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 p-2 text-white/80 hover:text-white sm:right-4"
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex((i) => (i === null ? null : (i + 1) % photos.length));
                }}
              >
                <ChevronRight size={32} />
              </button>
            </>
          )}
          <div className="relative h-full max-h-[85vh] w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <Image src={photos[index].url} alt={photos[index].alt} fill sizes="100vw" className="object-contain" />
          </div>
        </div>
      )}
    </>
  );
}

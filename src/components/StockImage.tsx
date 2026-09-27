"use client";

import Image from "next/image";
import type { StockPhoto } from "@/lib/stockPhotos";
import { stockUrl } from "@/lib/stockPhotos";
import { cn } from "@/lib/utils";

/**
 * A stock photo that fills its box, sharp on any screen: the browser picks
 * a width from `sizes` and the screen's pixel density, and Unsplash sends
 * exactly that — cropped to `aspect` when the box has a fixed shape.
 */
export function StockImage({
  photo,
  sizes,
  aspect,
  priority,
  alt = "",
  className,
}: {
  photo: StockPhoto;
  sizes: string;
  aspect?: string; // e.g. "3:4", the box's width:height
  priority?: boolean;
  alt?: string;
  className?: string;
}) {
  return (
    <Image
      src={photo.raw}
      loader={({ src, width, quality }) => stockUrl(src, width, aspect, quality ?? 80)}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes}
      className={cn("object-cover", className)}
      style={{ backgroundColor: photo.color }}
    />
  );
}

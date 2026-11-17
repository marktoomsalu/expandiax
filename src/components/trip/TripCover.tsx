"use client";

import { useState } from "react";
import Image from "next/image";
import { MediaViewer, type ViewerItem } from "@/components/MediaViewer";

/**
 * A trip's cover photo, filling the top of the page. Tapping it opens the
 * trip's photos full screen on the cover, the same viewer as the "Photos &
 * videos" grid below, so you can swipe on through the rest.
 */
export function TripCover({ src, items, startId }: { src: string; items: ViewerItem[]; startId: string }) {
  const [open, setOpen] = useState(false);
  const start = Math.max(0, items.findIndex((m) => m.id === startId));
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Open the cover photo full screen" className="absolute inset-0 cursor-zoom-in">
        <Image src={src} alt="" fill priority sizes="100vw" className="object-cover" />
      </button>
      {open && <MediaViewer items={items} start={start} onClose={() => setOpen(false)} />}
    </>
  );
}

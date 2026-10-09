"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type ViewerItem = { id: string; url: string; alt: string; type?: "image" | "video" };

const SWIPE_PX = 60;
const FLICK_PX_S = 450;
const DISMISS_PX = 110;
// Room left for the media once the safe areas and the counter/X row are taken.
const AVAILABLE_H = "(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 7rem)";
// Until a photo or video has loaded, assume an upright phone shot.
const DEFAULT_RATIO = 3 / 4;

/**
 * Full-screen photos and videos: swipe sideways between them, swipe down
 * (or X, or Esc) to close. The counter and X sit just above the media's own
 * corners — in reach of a thumb, clear of the status bar — rather than in
 * the screen's far corner.
 */
export function MediaViewer({ items, start, onClose }: { items: ViewerItem[]; start: number; onClose: () => void }) {
  const [[index, dir], setPage] = useState<[number, number]>([start, 0]);
  const y = useMotionValue(0);
  const backdrop = useTransform(y, [0, 320], [1, 0.25]);
  const many = items.length > 1;
  // Each item's real width/height, learned as it loads, so the frame (and
  // the X above its corner) fits the picture without waiting on it.
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const learn = (id: string, w: number, h: number) => w && h && setRatios((r) => (r[id] ? r : { ...r, [id]: w / h }));

  function go(step: number) {
    if (!many) return;
    setPage(([i]) => [(i + step + items.length) % items.length, step]);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    // The page underneath shouldn't scroll while the viewer is open.
    const { overflow } = document.documentElement.style;
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = overflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onDragEnd(_: unknown, { offset, velocity }: PanInfo) {
    if (Math.abs(offset.y) > Math.abs(offset.x)) {
      if (offset.y > DISMISS_PX || velocity.y > 900) onClose();
      return;
    }
    if (offset.x < -SWIPE_PX || velocity.x < -FLICK_PX_S) go(1);
    else if (offset.x > SWIPE_PX || velocity.x > FLICK_PX_S) go(-1);
  }

  const item = items[index];
  const ratio = ratios[item.id] ?? DEFAULT_RATIO;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-50 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div aria-hidden className="absolute inset-0 bg-black" style={{ opacity: backdrop }} />

      <AnimatePresence initial={false} custom={dir}>
        <motion.div
          key={item.id}
          custom={dir}
          variants={{
            enter: (d: number) => ({ x: d === 0 ? 0 : `${d * 100}%`, opacity: d === 0 ? 1 : 0.4 }),
            center: { x: 0, opacity: 1 },
            exit: (d: number) => ({ x: `${d * -100}%`, opacity: 0.4 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 380, damping: 38 }}
          className="absolute inset-0 flex items-center justify-center px-3 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
        >
          <motion.div
            drag
            dragDirectionLock
            dragSnapToOrigin
            dragElastic={0.7}
            onDragEnd={onDragEnd}
            style={{ y, width: `min(100%, calc(${AVAILABLE_H} * ${ratio}))` }}
            className="flex touch-none flex-col"
          >
            <div className="flex items-center justify-between pb-2">
              <span className="pl-1 text-sm tabular-nums text-white/70">{many ? `${index + 1} / ${items.length}` : ""}</span>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"
              >
                <X size={22} aria-hidden />
              </button>
            </div>
            <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: ratio }}>
              {item.type === "video" ? (
                <video
                  src={item.url}
                  controls
                  playsInline
                  autoPlay
                  onLoadedMetadata={(e) => learn(item.id, e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
                  className="h-full w-full bg-black object-contain"
                />
              ) : (
                <Image
                  src={item.url}
                  alt={item.alt}
                  fill
                  sizes="100vw"
                  loading="eager"
                  draggable={false}
                  onLoad={(e) => learn(item.id, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
                  className="pointer-events-none select-none object-contain"
                />
              )}
            </div>
            {/* Same height as the top row, so the media sits in the middle. */}
            <div className="h-[3.25rem]" aria-hidden />
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* The photos either side load ahead, so a swipe lands on a picture. */}
      {[index - 1, index + 1]
        .map((i) => items[(i + items.length) % items.length])
        .filter((n) => many && n.type !== "video" && n.id !== item.id)
        .map((n) => (
          <Image key={`ahead-${n.id}`} src={n.url} alt="" width={1600} height={1600} sizes="100vw" loading="eager" className="hidden" aria-hidden />
        ))}

      {many && (
        <>
          <button
            type="button"
            aria-label="Previous"
            onClick={() => go(-1)}
            className="absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 p-2 text-white/80 hover:text-white sm:block"
          >
            <ChevronLeft size={32} />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => go(1)}
            className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 p-2 text-white/80 hover:text-white sm:block"
          >
            <ChevronRight size={32} />
          </button>
        </>
      )}
    </motion.div>
  );
}

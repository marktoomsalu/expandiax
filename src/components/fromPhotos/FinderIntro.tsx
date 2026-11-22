"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarCheck2, ImageOff, Lock, Plus, Sparkles } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import { stockPhotoFor, stockUrl } from "@/lib/stockPhotos";
import { openAppSettings, photoAccess } from "@/lib/photoScan";

const EASE = [0.22, 1, 0.36, 1] as const;
const screen = "mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(4.5rem+env(safe-area-inset-top))]";

/** Three of their own countries, fanned out like prints on a table, gently afloat. */
function PhotoFan({ codes }: { codes: string[] }) {
  const reduce = useReducedMotion();
  const picks = [...codes, "IT", "JP", "PT", "IS", "MA"].filter((c, i, all) => all.indexOf(c) === i && stockPhotoFor(c, "fan")).slice(0, 3);
  const cards = [
    { code: picks[1], x: -92, y: 18, r: -11, z: 1, delay: 0.1 },
    { code: picks[2], x: 92, y: 14, r: 10, z: 1, delay: 0.18 },
    { code: picks[0], x: 0, y: 0, r: -1.5, z: 2, delay: 0 },
  ];
  return (
    <div className="relative mx-auto h-[min(15.5rem,30dvh)] w-full" aria-hidden>
      {cards.map((c, i) => {
        const photo = stockPhotoFor(c.code, "fan");
        const country = countryByCode(c.code);
        return (
          // Centred by a flex box, not a translate: framer-motion owns this card's transform.
          <div key={c.code ?? i} className="absolute inset-0 flex items-center justify-center" style={{ zIndex: c.z }}>
          <motion.div
            className="h-[min(13rem,25dvh)] w-[min(9.75rem,19dvh)]"
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 0, y: 40, rotate: 0, scale: 0.9 }}
            animate={{ opacity: 1, x: c.x, y: c.y, rotate: c.r, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.15 + c.delay, ease: EASE }}
          >
            <motion.div
              className="relative h-full w-full overflow-hidden rounded-[22px] bg-[#3a1240] shadow-[0_22px_40px_-18px_rgba(43,11,46,0.55)] ring-4 ring-surface"
              animate={reduce ? undefined : { y: [0, -6, 0] }}
              transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.6 }}
            >
              {photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={stockUrl(photo.raw, 400, "3:4", 75)} alt="" className="h-full w-full object-cover" />
              )}
              <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              {country && <span className="absolute bottom-2.5 left-3 text-xl drop-shadow">{country.flag}</span>}
              {c.z === 2 && (
                <motion.span
                  className="absolute right-2.5 top-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#fa51a2] to-[#fb7822] text-white shadow-lg"
                  initial={reduce ? false : { scale: 0, rotate: -40 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.9 }}
                >
                  <Sparkles size={19} />
                </motion.span>
              )}
            </motion.div>
          </motion.div>
          </div>
        );
      })}
    </div>
  );
}

export function FinderIntro({ countryCodes, error, onStart }: { countryCodes: string[]; error: string | null; onStart: () => void }) {
  const reduce = useReducedMotion();
  const rise = (delay: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay: reduce ? 0 : delay, ease: EASE },
  });

  return (
    <div className={screen}>
      <PhotoFan codes={countryCodes} />

      <motion.p {...rise(0.45)} className="eyebrow mt-[min(2.25rem,4dvh)]">
        From my photos
      </motion.p>
      <motion.h1 {...rise(0.55)} className="mt-2 font-serif text-[2.1rem] leading-[1.08]">
        Your photos remember <span className="italic text-accent">more than your map.</span>
      </motion.h1>

      <motion.ul {...rise(0.7)} className="mt-6 space-y-4">
        <li className="flex items-start gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Plus size={19} strokeWidth={2.4} aria-hidden />
          </span>
          <span className="pt-0.5 text-[15px] leading-snug">
            <span className="font-semibold">Trips and events you haven&apos;t added</span>
            <span className="block text-muted">Concerts, matches and races too</span>
          </span>
        </li>
        <li className="flex items-start gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-3-soft text-accent-3">
            <CalendarCheck2 size={19} aria-hidden />
          </span>
          <span className="pt-0.5 text-[15px] leading-snug">
            <span className="font-semibold">Exact days and places</span>
            <span className="block text-muted">For the memories you&apos;ve already saved</span>
          </span>
        </li>
        <li className="flex items-start gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-raised text-ink/70">
            <Lock size={18} aria-hidden />
          </span>
          <span className="pt-0.5 text-[15px] leading-snug">
            <span className="font-semibold">Only when and where</span>
            <span className="block text-muted">Each photo&apos;s date and place, read on your phone. Never what&apos;s in it, and no photos uploaded.</span>
          </span>
        </li>
      </motion.ul>

      <motion.div {...rise(0.85)} className="mt-auto pt-8">
        {error && <p className="mb-3 text-center text-sm text-accent">{error}</p>}
        <p className="mb-3.5 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
          <Lock size={13} aria-hidden /> Stays on your phone · You approve every change
        </p>
        <button type="button" onClick={onStart} className="btn-accent w-full !rounded-full py-4 text-lg shadow-[0_14px_30px_-12px_rgba(250,81,162,0.75)]">
          Look through my photos
        </button>
      </motion.div>
    </div>
  );
}

/** Photos are off: one way to turn them on, and it carries on by itself when they come back. */
export function FinderDenied({ restricted, onRetry }: { restricted: boolean; onRetry: () => void }) {
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void photoAccess()
        .then((s) => {
          if (s === "full" || s === "limited") onRetry();
        })
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [onRetry]);

  return (
    <div className={screen}>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-soft text-accent">
          <ImageOff size={34} aria-hidden />
        </span>
        <h1 className="mt-6 font-serif text-3xl">Photos are off for ExpandiaX</h1>
        <p className="mt-2 max-w-xs text-muted">{restricted ? "This phone doesn't allow it." : "Allow them in Settings and we'll carry on from here."}</p>
      </div>
      {!restricted && (
        <button type="button" onClick={() => void openAppSettings()} className="btn-accent w-full !rounded-full py-4 text-lg">
          Open Settings
        </button>
      )}
    </div>
  );
}

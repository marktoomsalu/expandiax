"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { holdSplash } from "@/lib/splash";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";

const WorldGlobeInner = dynamic(() => import("@/components/WorldGlobeInner").then((m) => m.WorldGlobeInner), {
  ssr: false,
  loading: () => <div className="h-[280px] w-full sm:h-[380px]" />,
});

// WorldGlobeInner sizes itself from its container's width (height =
// min(width * 0.8, 680)) rather than filling an arbitrary box — the same
// model it uses everywhere else in the app (/my-world, /stats). Stacking
// it above the copy, rather than trying to force it into a full-bleed
// absolute background, works with that model instead of fighting it.
// The first thing anyone sees: the globe turning, and one button. (The
// launch film that used to play first is gone: it was a detour before the
// real start, and confused more than it explained.)
export function ColdOpenStep({ onStart, leaving = false, onGlobeReady }: { onStart: () => void; leaving?: boolean; onGlobeReady?: () => void }) {
  // The app's launch screen stays until the globe is drawn: no empty space where it'll be.
  const [release] = useState(() => (typeof window === "undefined" ? () => {} : holdSplash()));
  useEffect(() => release, [release]);
  const reduce = useReducedMotion();
  // Leaving for "Find my world": the words fade, the globe gathers into a point (where the photos then burst out of).
  // The purple stays put underneath, so nothing flashes between the two screens.
  const EASE = [0.4, 0, 0.2, 1] as const;
  return (
    <>
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-brand-purple px-6 pt-[env(safe-area-inset-top)] text-center text-white">
        <motion.div
          className="w-full max-w-xl opacity-90"
          animate={leaving ? { opacity: 0, scale: reduce ? 1 : 0.15 } : { opacity: 0.9, scale: 1 }}
          transition={leaving ? { duration: 0.45, ease: [0.6, 0, 0.8, 0.4] } : { duration: 0.55, ease: EASE }}
        >
          <WorldGlobeInner
            visitedCodes={[]}
            interactive={false}
            labels={false}
            autoRotate
            onReady={() => {
              release();
              onGlobeReady?.();
            }}
          />
        </motion.div>
        <motion.div
          className="flex flex-col items-center"
          animate={leaving ? { opacity: 0, y: reduce ? 0 : 16 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
        <Image src="/wordmark.svg" alt="ExpandiaX" width={1780} height={522} priority className="mt-4 h-8 w-auto" />
        <p className="mt-6 font-serif text-2xl leading-snug sm:text-3xl">
          Your world, <span className="italic">remembered.</span>
        </p>
        <button type="button" onClick={onStart} className="btn-accent mt-10 px-8">
          Start my journey
        </button>
        <Link href="/sign-in" className="mt-5 pb-8 text-sm text-white/60 hover:text-white">
          I already have an account
        </Link>
        </motion.div>
      </div>
    </>
  );
}

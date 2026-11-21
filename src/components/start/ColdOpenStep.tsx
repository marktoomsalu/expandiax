"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { holdSplash } from "@/lib/splash";
import Link from "next/link";
import dynamic from "next/dynamic";

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
export function ColdOpenStep({ onStart }: { onStart: () => void }) {
  // The app's launch screen stays until the globe is drawn: no empty space where it'll be.
  const [release] = useState(() => (typeof window === "undefined" ? () => {} : holdSplash()));
  useEffect(() => release, [release]);
  return (
    <>
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-brand-purple px-6 pt-[env(safe-area-inset-top)] text-center text-white">
        <div className="w-full max-w-xl opacity-90">
          <WorldGlobeInner visitedCodes={[]} interactive={false} labels={false} autoRotate onReady={release} />
        </div>
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
      </div>
    </>
  );
}

"use client";

import Image from "next/image";
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
export function ColdOpenStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-brand-purple px-6 pt-[env(safe-area-inset-top)] text-center text-white">
      <div className="w-full max-w-xl opacity-90">
        <WorldGlobeInner visitedCodes={[]} interactive={false} autoRotate />
      </div>
      <Image src="/wordmark.svg" alt="ExpandiaX" width={1780} height={522} priority className="mt-4 h-8 w-auto" />
      <p className="mt-6 font-serif text-2xl leading-snug sm:text-3xl">Your world, remembered.</p>
      <button type="button" onClick={onStart} className="btn-accent mt-10 px-8">
        Start my world
      </button>
      <Link href="/sign-in" className="mt-5 pb-8 text-sm text-white/60 hover:text-white">
        I already have an account
      </Link>
    </div>
  );
}

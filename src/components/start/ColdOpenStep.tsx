"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Play } from "lucide-react";
import { WelcomeFilm, welcomeFilmSeen } from "@/components/film/WelcomeFilm";
import { useAutoplayOk } from "@/components/film/useAutoplayOk";
import { Rise } from "./StepTransition";

const WorldGlobeInner = dynamic(() => import("@/components/WorldGlobeInner").then((m) => m.WorldGlobeInner), {
  ssr: false,
  loading: () => <div className="h-[280px] w-full sm:h-[380px]" />,
});

// "intro" asks first, then the film plays with sound; "home" is the globe.
type Phase = "unknown" | "intro" | "film" | "home";

// WorldGlobeInner sizes itself from its container's width (height =
// min(width * 0.8, 680)) rather than filling an arbitrary box — the same
// model it uses everywhere else in the app (/my-world, /stats). Stacking
// it above the copy, rather than trying to force it into a full-bleed
// absolute background, works with that model instead of fighting it.
export function ColdOpenStep({ onStart }: { onStart: () => void }) {
  // The launch film comes first, once per device, after an "are you ready"
  // tap — not for reduced motion or data saving.
  const autoplay = useAutoplayOk();
  const [phase, setPhase] = useState<Phase>("unknown");
  useEffect(() => {
    if (autoplay !== null) setPhase(autoplay && !welcomeFilmSeen() ? "intro" : "home");
  }, [autoplay]);

  return (
    <>
      {phase === "intro" && <ReadyIntro onReady={() => setPhase("film")} />}
      {phase === "film" && <WelcomeFilm withSound onDone={() => setPhase("home")} />}
      {/* Rendered under the intro and film so the globe has loaded by the
          time it's revealed; hidden until we know which comes first. */}
      <div
        className={`flex min-h-[100dvh] flex-col items-center justify-center bg-brand-purple px-6 pt-[env(safe-area-inset-top)] text-center text-white transition-opacity duration-700 ${
          phase === "unknown" ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="w-full max-w-xl opacity-90">
          <WorldGlobeInner visitedCodes={[]} interactive={false} labels={false} autoRotate />
        </div>
        <Image src="/wordmark.svg" alt="ExpandiaX" width={1780} height={522} priority className="mt-4 h-8 w-auto" />
        <p className="mt-6 font-serif text-2xl leading-snug sm:text-3xl">
          Your life, <span className="italic">remembered.</span>
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

function ReadyIntro({ onReady }: { onReady: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-brand-purple px-8 text-center text-white">
      <Rise>
        <Image src="/wordmark.svg" alt="ExpandiaX" width={1780} height={522} priority className="mx-auto h-7 w-auto opacity-80" />
      </Rise>
      <Rise delay={0.25}>
        <h1 className="mt-10 max-w-sm font-serif text-4xl leading-tight sm:text-5xl">
          Are you ready to explore the <span className="italic">world?</span>
        </h1>
      </Rise>
      <Rise delay={0.55}>
        <button
          type="button"
          onClick={onReady}
          className="btn-accent mt-12 flex items-center gap-2 !px-9 !py-3.5 !text-base shadow-lg shadow-accent/30"
        >
          <Play size={17} fill="currentColor" aria-hidden /> I&rsquo;m ready
        </button>
      </Rise>
    </div>
  );
}

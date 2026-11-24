"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { Compass, Images, Users } from "lucide-react";
import { AppleSignInButton } from "@/components/AppleSignInButton";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { LegalLink } from "@/components/LegalConsent";
import { OdometerCounter } from "@/components/start/OdometerCounter";
import { countryByCode, TOTAL_COUNTRIES } from "@/lib/countries";
import { MIN_AGE } from "@/lib/legal";
import { keptCountries, loadKeptWorld, type KeptEvent, type KeptWorld } from "@/lib/worldScan";

const WorldGlobeInner = dynamic(() => import("@/components/WorldGlobeInner").then((m) => m.WorldGlobeInner), {
  ssr: false,
  loading: () => <div className="aspect-[5/4] w-full" />,
});

const EASE = [0.22, 1, 0.36, 1] as const;

// A sky of small stars behind it all.
const STARS = [
  [12, 8, 1], [28, 18, 1.5], [46, 6, 1], [64, 14, 1], [82, 9, 1.5], [91, 26, 1], [7, 34, 1], [94, 48, 1], [5, 62, 1.5], [90, 70, 1], [16, 78, 1], [72, 84, 1], [38, 92, 1], [58, 30, 1], [22, 52, 1],
]
  .map(([x, y, r]) => `radial-gradient(${r}px ${r}px at ${x}% ${y}%, #fff, transparent)`)
  .join(",");

/** What's ahead once they've joined: what their world becomes. */
const AHEAD = [
  { icon: Images, title: "Keep every memory", line: "Photos, songs and stories" },
  { icon: Users, title: "Share it with friends", line: "See where they've been" },
  { icon: Compass, title: "Discover what's next", line: "Events and dream places" },
];

/** A memory they found, floating by the globe: "🇳🇴 Luna Vale". */
function MemoryChip({ e, className, delay }: { e: KeptEvent; className: string; delay: number }) {
  const reduce = useReducedMotion();
  const name = e.artist || e.title;
  return (
    <motion.span
      aria-hidden
      className={`absolute z-10 max-w-[46%] truncate [@media(max-height:700px)]:hidden rounded-full bg-white/[0.12] px-3 py-1.5 text-xs font-medium text-white shadow-[0_8px_24px_-10px_rgba(0,0,0,0.6)] ring-1 ring-white/20 backdrop-blur-md ${className}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={reduce ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1, y: [0, -6, 0] }}
      transition={reduce ? { delay, duration: 0.5 } : { opacity: { delay, duration: 0.6 }, scale: { delay, duration: 0.6 }, y: { delay, duration: 4.5, repeat: Infinity, ease: "easeInOut" } }}
    >
      {countryByCode(e.code)?.flag} {name}
    </motion.span>
  );
}

/**
 * Signing up, right after Find my world (iPhone app builds with it): not a
 * form, the start of what comes next. Their world, counted and turning; a
 * couple of the memories they found; what joining opens up (keeping it,
 * sharing it, finding what's next); then Apple and Google, email smaller.
 *
 * One screen, over the whole app in the night purple of Find my world (so
 * the story carries straight on), nothing to scroll: the globe takes the
 * room the rest leaves, smaller on a small phone.
 */
export function SignUpWelcome({ onEmail }: { onEmail: () => void }) {
  const reduce = useReducedMotion();
  const [world, setWorld] = useState<KeptWorld | null>(null);
  useEffect(() => setWorld(loadKeptWorld()), []);
  const codes = useMemo(() => (world ? keptCountries(world) : []), [world]);
  const memories = world?.events ?? [];
  const theirs = codes.length > 0;
  const pct = Math.round((codes.length / TOTAL_COUNTRIES) * 1000) / 10;
  const rise = (delay: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay: reduce ? 0 : delay, ease: EASE },
  });

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden bg-[radial-gradient(circle_at_50%_30%,#5a1758_0%,#2b0b2e_55%,#14051a_100%)] text-white">
      <div aria-hidden className="absolute inset-0 opacity-60" style={{ backgroundImage: STARS }} />
      <div className="relative mx-auto flex h-[100dvh] max-w-md flex-col px-6 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-[calc(0.5rem+env(safe-area-inset-top))]">
        {/* A quiet top: the name, and the way in for members. */}
        <div className="flex h-11 shrink-0 items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/wordmark.svg" alt="ExpandiaX" className="h-6 w-auto" />
          <Link href="/sign-in" className="text-sm font-medium text-white/75 hover:text-white">
            Sign in
          </Link>
        </div>

        <motion.p {...rise(0.05)} className="mt-3 shrink-0 text-center text-[11px] font-semibold uppercase tracking-[0.26em] text-[#ff8cc6]">
          Join the Experience Network
        </motion.p>
        <motion.h1 {...rise(0.15)} className="mt-2 shrink-0 text-center font-serif text-[2.35rem] leading-[1.05] [@media(max-height:700px)]:text-[1.9rem]">
          {theirs ? (
            <>
              <OdometerCounter value={codes.length} /> {codes.length === 1 ? "country." : "countries."}
              <br />
              <span className="italic text-[#ff8cc6]">Just the beginning.</span>
            </>
          ) : (
            <>
              Your world,
              <br />
              <span className="italic text-[#ff8cc6]">it starts here.</span>
            </>
          )}
        </motion.h1>

        {/* Their world, turning, with a couple of the memories they found beside it. */}
        <motion.div {...rise(0.3)} className="relative mt-1 flex min-h-0 flex-1 items-center justify-center [container-type:size]">
          <div aria-hidden className="absolute left-1/2 top-1/2 h-[80cqmin] w-[80cqmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(250,81,162,0.35)_0%,rgba(250,81,162,0)_65%)]" />
          <div className="relative w-[min(100%,125cqh)]">
            <WorldGlobeInner visitedCodes={codes} homeCode={world?.homeCode ?? undefined} interactive={false} labels={false} autoRotate />
          </div>
          {memories[0] && <MemoryChip e={memories[0]} className="left-0 top-[14%]" delay={1.1} />}
          {memories[1] && <MemoryChip e={memories[1]} className="bottom-[14%] right-0" delay={1.5} />}
        </motion.div>
        {theirs && (
          <motion.p {...rise(0.45)} className="shrink-0 text-center text-sm text-white/70">
            {pct}% of the world{memories.length ? ` · ${memories.length} ${memories.length === 1 ? "memory" : "memories"}` : ""}, ready to keep
          </motion.p>
        )}

        {/* What joining opens up. */}
        <motion.ul {...rise(0.6)} className="mt-4 grid shrink-0 grid-cols-3 gap-2 [@media(max-height:700px)]:mt-3">
          {AHEAD.map(({ icon: Icon, title, line }) => (
            <li key={title} className="flex flex-col items-center rounded-2xl bg-white/[0.07] px-1.5 py-3 text-center ring-1 ring-white/10">
              <span className="gradient-travel flex h-9 w-9 items-center justify-center rounded-full shadow-[0_6px_16px_-6px_rgba(250,81,162,0.9)]">
                <Icon size={17} aria-hidden />
              </span>
              <span className="mt-2 text-[12.5px] font-semibold leading-tight">{title}</span>
              <span className="mt-0.5 text-[11px] leading-tight text-white/55 [@media(max-height:700px)]:hidden">{line}</span>
            </li>
          ))}
        </motion.ul>

        <motion.div {...rise(0.75)} className="mt-5 shrink-0 space-y-2.5">
          <AppleSignInButton
            next="/onboarding"
            label="Sign up with Apple"
            className="btn w-full gap-2.5 !rounded-full bg-white !py-[0.95rem] text-base font-semibold text-black shadow-[0_14px_40px_-12px_rgba(250,81,162,0.75)] hover:opacity-90 disabled:opacity-50"
          />
          <GoogleSignInButton
            next="/onboarding"
            label="Sign up with Google"
            className="btn w-full gap-2.5 !rounded-full bg-white/[0.08] !py-[0.95rem] text-base font-medium text-white ring-1 ring-white/25 hover:bg-white/15 disabled:opacity-50"
          />
          <div className="text-center">
            <button type="button" onClick={onEmail} className="py-1 text-sm font-medium text-white/75 underline-offset-4 hover:text-white hover:underline">
              Sign up with email
            </button>
          </div>
        </motion.div>

        <p className="mt-2 shrink-0 text-center text-[11px] leading-relaxed text-white/45">
          By continuing, you confirm you&rsquo;re {MIN_AGE} or older and agree to the{" "}
          <LegalLink href="/terms" className="text-white/70 underline underline-offset-2">
            Terms
          </LegalLink>{" "}
          and{" "}
          <LegalLink href="/privacy" className="text-white/70 underline underline-offset-2">
            Privacy Policy
          </LegalLink>
          .
        </p>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, Plane } from "lucide-react";
import { AppleSignInButton } from "@/components/AppleSignInButton";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { LegalLink } from "@/components/LegalConsent";
import { countryByCode } from "@/lib/countries";
import { MIN_AGE } from "@/lib/legal";
import { photoThumbs } from "@/lib/photoScan";
import { keptCountries, loadKeptWorld, type KeptWorld } from "@/lib/worldScan";

const WorldGlobeInner = dynamic(() => import("@/components/WorldGlobeInner").then((m) => m.WorldGlobeInner), {
  ssr: false,
  loading: () => <div className="aspect-square w-full" />,
});

// Where the three bubbles sit on the globe: a big one in the middle, two small on the path.
const BUBBLES = [
  { left: "8%", top: "18%", size: 64, delay: 0.5 },
  { left: "50%", top: "46%", size: 116, delay: 0.2, center: true },
  { left: "74%", top: "64%", size: 72, delay: 0.8 },
];

/**
 * The first look of signing up (iPhone app, builds with Find my world):
 * their own world turning, their own photos on it, and the two quick ways
 * in. Email is there, smaller.
 */
export function SignUpWelcome({ onEmail }: { onEmail: () => void }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [world, setWorld] = useState<KeptWorld | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => setWorld(loadKeptWorld()), []);
  const codes = useMemo(() => (world ? keptCountries(world) : []), [world]);

  // Three of their trips' best photos, from different countries.
  useEffect(() => {
    if (!world) return;
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const t of world.trips) {
      if (seen.has(t.code) || !t.covers[0]) continue;
      seen.add(t.code);
      ids.push(t.covers[0]);
      if (ids.length === 3) break;
    }
    if (!ids.length) return;
    void photoThumbs(ids, 360).then((got) => setPhotos(ids.map((id) => got[id]).filter(Boolean)));
  }, [world]);

  const flags = codes.slice(0, 3).map((c) => countryByCode(c)?.flag ?? "");
  const theirs = codes.length > 0;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col overflow-y-auto bg-[radial-gradient(circle_at_50%_45%,#24123a_0%,#0b0616_60%,#05030b_100%)] text-white">
      <div className="px-5 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/15">
          <ChevronLeft size={22} aria-hidden />
        </button>
      </div>

      <motion.h1
        className="mt-6 px-8 text-center text-[1.9rem] font-semibold leading-tight tracking-tight"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        Hi there! <span aria-hidden>👋</span> {theirs ? "Let's keep your world." : "Let's get you started."}
      </motion.h1>
      {theirs && (
        <p className="mt-2 text-center text-sm text-white/60">
          {codes.length} {codes.length === 1 ? "country" : "countries"}, ready to save
        </p>
      )}

      {/* Their world, turning, with their photos on it */}
      <div className="relative mx-auto mt-2 w-full max-w-sm flex-1 px-4">
        <div className="pointer-events-none relative">
          <WorldGlobeInner visitedCodes={codes} homeCode={world?.homeCode ?? undefined} interactive={false} labels={false} autoRotate />
          <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
            <motion.path
              d="M -4 14 C 8 22, 12 20, 18 26 S 30 40, 46 46 S 62 58, 72 60 S 88 70, 104 62"
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="0.5"
              strokeDasharray="1.6 1.6"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2.2, ease: "easeInOut", delay: 0.3 }}
            />
          </svg>
          <motion.span
            aria-hidden
            className="absolute text-white/80"
            style={{ left: "90%", top: "60%" }}
            initial={reduce ? false : { opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 2.2, duration: 0.6 }}
          >
            <Plane size={22} className="rotate-[20deg]" />
          </motion.span>
          {BUBBLES.map((b, i) => {
            const src = photos[i === 1 ? 0 : i === 0 ? 1 : 2] ?? null;
            return (
              <motion.span
                key={i}
                aria-hidden
                className="absolute flex items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-gradient-to-br from-[#fa51a2] to-[#7c5cff] shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
                style={{ left: b.left, top: b.top, width: b.size, height: b.size, marginLeft: b.center ? -b.size / 2 : 0, marginTop: b.center ? -b.size / 2 : 0 }}
                initial={reduce ? false : { scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, y: reduce ? 0 : [0, -6, 0] }}
                transition={{ scale: { type: "spring", stiffness: 220, damping: 15, delay: b.delay }, opacity: { delay: b.delay }, y: { duration: 4 + i, repeat: Infinity, ease: "easeInOut", delay: b.delay } }}
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span style={{ fontSize: b.size * 0.45 }}>{flags[i] || ["🇮🇹", "🇯🇵", "🇵🇹"][i]}</span>
                )}
              </motion.span>
            );
          })}
        </div>
      </div>

      <motion.div
        className="mx-auto w-full max-w-sm space-y-3 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
      >
        <AppleSignInButton
          next="/onboarding"
          label="Sign up with Apple"
          className="flex w-full items-center justify-center gap-3 rounded-full bg-white py-4 text-lg font-semibold text-black disabled:opacity-50"
        />
        <GoogleSignInButton
          next="/onboarding"
          label="Sign up with Google"
          className="flex w-full items-center justify-center gap-3 rounded-full py-4 text-lg font-semibold text-white ring-2 ring-white/30 disabled:opacity-50"
        />
        <div className="pt-2 text-center">
          <button type="button" onClick={onEmail} className="text-lg font-semibold text-[#ff8cc6]">
            Sign up with email
          </button>
        </div>
        <p className="px-2 pt-3 text-center text-xs leading-relaxed text-white/55">
          By continuing, you confirm you&rsquo;re {MIN_AGE} or older and agree to our{" "}
          <LegalLink href="/terms" className="underline underline-offset-2">
            Terms
          </LegalLink>{" "}
          and{" "}
          <LegalLink href="/privacy" className="underline underline-offset-2">
            Privacy Policy
          </LegalLink>
          .
        </p>
      </motion.div>
    </div>
  );
}

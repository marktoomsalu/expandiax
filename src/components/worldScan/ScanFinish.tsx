"use client";

import { useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { Globe2 } from "lucide-react";
import { TOTAL_COUNTRIES, continentCounts } from "@/lib/countries";
import { startBadges } from "@/lib/startBadges";
import { keptCountries, type KeptWorld } from "@/lib/worldScan";
import { tapSuccess } from "@/lib/haptics";
import { EarnedBadges } from "@/components/start/EarnedBadges";
import { Burst, CountUp } from "./Burst";

const WorldGlobeInner = dynamic(() => import("@/components/WorldGlobeInner").then((m) => m.WorldGlobeInner), {
  ssr: false,
  loading: () => <div className="h-[280px] w-full" />,
});

/** "You built your world": everything they kept, on one globe, and what's next. */
export function ScanFinish({
  mode,
  kept: world,
  limited,
  saving,
}: {
  mode: "new" | "member";
  kept: KeptWorld;
  limited: boolean;
  saving: boolean;
}) {
  const reduce = useReducedMotion();
  const homeCode = world.homeCode;
  const kept = world.trips;
  const eventCount = world.events?.length ?? 0;
  const codes = keptCountries(world);
  const continents = continentCounts(codes).filter((c) => c.visited > 0).length;
  const pct = Math.round((codes.length / TOTAL_COUNTRIES) * 1000) / 10;
  const years = [...kept.map((t) => Number(t.from.slice(0, 4))), ...(world.events ?? []).map((e) => Number(e.date.slice(0, 4)))];
  const span = years.length ? (Math.min(...years) === Math.max(...years) ? `${years[0]}` : `${Math.min(...years)}–${Math.max(...years)}`) : null;
  const badges = startBadges({ countryCodes: codes });

  useEffect(() => {
    const t = setTimeout(() => tapSuccess(), reduce ? 0 : 900);
    return () => clearTimeout(t);
  }, [reduce]);

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(3.5rem+env(safe-area-inset-top))] text-center">
      {/* A medal for building it */}
      <div className="relative flex h-28 w-28 items-center justify-center">
        <Burst delay={0.6} />
        <motion.div
          className="relative flex h-24 w-24 items-center justify-center rounded-full shadow-[0_16px_50px_-8px_rgba(250,81,162,0.75)]"
          style={{ background: "linear-gradient(135deg,#fa51a2 0%,#f43f5e 50%,#fb7822 100%)" }}
          initial={reduce ? { opacity: 0 } : { y: -140, rotateY: 540, scale: 0.4, opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { y: 0, rotateY: 0, scale: [0.4, 1.15, 0.95, 1], opacity: 1 }}
          transition={reduce ? { duration: 0.4 } : { y: { type: "spring", stiffness: 140, damping: 13 }, rotateY: { duration: 0.85 }, scale: { duration: 0.9, times: [0, 0.6, 0.8, 1] } }}
        >
          <span aria-hidden className="absolute inset-2 rounded-full border-2 border-white/35" />
          <Globe2 size={44} strokeWidth={1.75} aria-hidden />
        </motion.div>
      </div>

      <motion.h1
        className="mt-5 font-serif text-[2.3rem] leading-tight"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : 0.9 }}
      >
        You built <span className="italic text-[#ff8cc6]">your world.</span>
      </motion.h1>
      <motion.p className="mt-2 text-base text-white/75" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 1.1 }}>
        {[kept.length ? `${kept.length} ${kept.length === 1 ? "trip" : "trips"}` : null, eventCount ? `${eventCount} ${eventCount === 1 ? "event" : "events"}` : null].filter(Boolean).join(" · ")}
        {span ? ` · ${span}` : ""}
      </motion.p>

      <motion.div className="mt-2 w-full" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: reduce ? 0 : 1.2, duration: 0.8 }}>
        <WorldGlobeInner visitedCodes={codes} homeCode={homeCode ?? undefined} interactive={false} labels={false} autoRotate />
      </motion.div>

      <div className="grid w-full grid-cols-3 gap-2">
        <Stat value={<CountUp value={codes.length} delay={reduce ? 0 : 1.4} />} label={codes.length === 1 ? "country" : "countries"} />
        {eventCount > 0 ? (
          <Stat value={<CountUp value={eventCount} delay={reduce ? 0 : 1.5} />} label={eventCount === 1 ? "event" : "events"} />
        ) : (
          <Stat value={<CountUp value={continents} delay={reduce ? 0 : 1.5} />} label={continents === 1 ? "continent" : "continents"} />
        )}
        <Stat value={`${pct}%`} label="of the world" />
      </div>

      <div className="w-full text-white [&_*]:text-inherit">
        <EarnedBadges {...badges} />
      </div>

      <div className="mt-8 w-full">
        {mode === "new" ? (
          <>
            {/* What they kept is waiting on the phone; signing up just gives it a home. */}
            <Link href="/sign-up" className="btn-accent w-full py-4 text-lg">
              Create my free account
            </Link>
            <p className="mt-3 text-xs text-white/50">So your world is kept safe.</p>
          </>
        ) : (
          <>
            {saving ? (
              <span className="btn-accent w-full py-4 text-lg opacity-70" aria-live="polite">
                Saving…
              </span>
            ) : (
              <Link href="/my-world" className="btn-accent w-full py-4 text-lg">
                See my world
              </Link>
            )}
            <p className="mt-3 text-xs text-white/50">Photos follow in the background.</p>
          </>
        )}
        {limited && <p className="mt-2 text-xs text-white/40">Only the photos you shared were looked at.</p>}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.08] px-2 py-3 ring-1 ring-white/10">
      <p className="font-serif text-2xl font-semibold">{value}</p>
      <p className="mt-0.5 text-xs text-white/65">{label}</p>
    </div>
  );
}

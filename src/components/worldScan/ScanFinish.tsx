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
  onStartOver,
}: {
  mode: "new" | "member";
  kept: KeptWorld;
  limited: boolean;
  saving: boolean;
  /** Back here from sign-up: forget it and look again from the start. */
  onStartOver?: () => void;
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

  const earned = badges.earned.slice(0, 5);
  const next = badges.next;

  return (
    // One screen, nothing to scroll: the globe takes the room that's left.
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col items-center overflow-hidden px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] text-center">
      {/* A medal for building it */}
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
        <Burst delay={0.6} />
        <motion.div
          className="relative flex h-16 w-16 items-center justify-center rounded-full shadow-[0_12px_40px_-8px_rgba(250,81,162,0.75)]"
          style={{ background: "linear-gradient(135deg,#fa51a2 0%,#f43f5e 50%,#fb7822 100%)" }}
          initial={reduce ? { opacity: 0 } : { y: -120, rotateY: 540, scale: 0.4, opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { y: 0, rotateY: 0, scale: [0.4, 1.15, 0.95, 1], opacity: 1 }}
          transition={reduce ? { duration: 0.4 } : { y: { type: "spring", stiffness: 140, damping: 13 }, rotateY: { duration: 0.85 }, scale: { duration: 0.9, times: [0, 0.6, 0.8, 1] } }}
        >
          <span aria-hidden className="absolute inset-1.5 rounded-full border-2 border-white/35" />
          <Globe2 size={30} strokeWidth={1.75} aria-hidden />
        </motion.div>
      </div>

      <motion.h1 className="mt-3 shrink-0 font-serif text-[2rem] leading-tight" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : 0.9 }}>
        You built <span className="italic text-[#ff8cc6]">your world.</span>
      </motion.h1>
      <motion.p className="mt-1 shrink-0 text-sm text-white/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 1.1 }}>
        {[kept.length ? `${kept.length} ${kept.length === 1 ? "trip" : "trips"}` : null, eventCount ? `${eventCount} ${eventCount === 1 ? "event" : "events"}` : null].filter(Boolean).join(" · ")}
        {span ? ` · ${span}` : ""}
      </motion.p>

      <motion.div className="flex min-h-0 w-full flex-1 items-center justify-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: reduce ? 0 : 1.2, duration: 0.8 }}>
        <div className="w-[min(100%,36dvh)]">
          <WorldGlobeInner visitedCodes={codes} homeCode={homeCode ?? undefined} interactive={false} labels={false} autoRotate />
        </div>
      </motion.div>

      <div className="grid w-full shrink-0 grid-cols-3 gap-2">
        <Stat value={<CountUp value={codes.length} delay={reduce ? 0 : 1.4} />} label={codes.length === 1 ? "country" : "countries"} />
        {eventCount > 0 ? (
          <Stat value={<CountUp value={eventCount} delay={reduce ? 0 : 1.5} />} label={eventCount === 1 ? "event" : "events"} />
        ) : (
          <Stat value={<CountUp value={continents} delay={reduce ? 0 : 1.5} />} label={continents === 1 ? "continent" : "continents"} />
        )}
        <Stat value={`${pct}%`} label="of the world" />
      </div>

      {/* The badges earned, in one row, and the next one */}
      {earned.length > 0 && (
        <div className="mt-3 w-full shrink-0">
          <p className="text-xs font-semibold text-white/80">
            {badges.earned.length} {badges.earned.length === 1 ? "badge" : "badges"} earned
          </p>
          <div className="mt-2 flex justify-center gap-3">
            {earned.map((b, i) => (
              <motion.div
                key={b.id}
                className="flex w-14 flex-col items-center"
                initial={reduce ? false : { scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: reduce ? 0 : 1.6 + i * 0.12, type: "spring", stiffness: 300, damping: 16 }}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#fa51a2] to-[#fb7822] shadow-[0_8px_20px_-6px_rgba(250,81,162,0.7)]">
                  <b.icon size={20} aria-hidden />
                </span>
                <span className="mt-1 line-clamp-1 text-[10px] font-medium leading-tight text-white/85">{b.label}</span>
              </motion.div>
            ))}
          </div>
          {next && (
            <div className="mx-auto mt-2.5 flex max-w-xs items-center gap-2 rounded-full bg-white/[0.08] px-3 py-1.5 text-left ring-1 ring-white/10">
              <next.icon size={14} className="shrink-0 text-[#ffb3d6]" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-xs text-white/80">
                Next: <span className="font-semibold text-white">{next.label}</span> · {next.current}/{next.target}
              </span>
              <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-white/15">
                <span className="block h-full rounded-full bg-gradient-to-r from-[#fa51a2] to-[#fb7822]" style={{ width: `${Math.round((next.current / next.target) * 100)}%` }} />
              </span>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 w-full shrink-0">
        {mode === "new" ? (
          <>
            {/* What they kept is waiting on the phone; signing up just gives it a home. */}
            <Link href="/sign-up" className="btn-accent w-full py-4 text-lg">
              Save my world
            </Link>
            <p className="mt-2 text-xs text-white/50">
              So your world is kept safe.
              {onStartOver && (
                <>
                  {" "}
                  <button type="button" onClick={onStartOver} className="underline underline-offset-2 hover:text-white">
                    Start again
                  </button>
                </>
              )}
            </p>
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
            <p className="mt-2 text-xs text-white/50">Add your own photos to any trip, from its days.</p>
          </>
        )}
        {limited && <p className="mt-1 text-xs text-white/50">Only the photos you chose were looked at. Share more any time in Settings › ExpandiaX › Photos.</p>}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.08] px-2 py-2 ring-1 ring-white/10">
      <p className="font-serif text-xl font-semibold">{value}</p>
      <p className="text-[11px] text-white/65">{label}</p>
    </div>
  );
}

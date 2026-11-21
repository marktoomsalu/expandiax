"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Home } from "lucide-react";
import { TOTAL_COUNTRIES, continentCounts, countryByCode } from "@/lib/countries";
import type { FoundWorld } from "@/lib/tripFinder";
import type { FoundEvent } from "@/lib/worldStory";
import { tapLight, tapSuccess } from "@/lib/haptics";
import { Burst, CountUp } from "./Burst";
import { warmUpWall } from "./CountriesWall";

/** The big moment: how much of the world they've already seen. */
export function ScanReveal({
  world,
  events,
  canChangeHome,
  onChangeHome,
  onNext,
}: {
  world: FoundWorld;
  /** Null while still looking. */
  events: FoundEvent[] | null;
  canChangeHome: boolean;
  onChangeHome: (code: string) => void;
  onNext: () => void;
}) {
  const reduce = useReducedMotion();
  const [pickHome, setPickHome] = useState(false);
  const codes = [...new Set([...(world.homeCode ? [world.homeCode] : []), ...world.countries.map((c) => c.code)])];
  const continents = continentCounts(codes).filter((c) => c.visited > 0).length;
  const pct = Math.round((codes.length / TOTAL_COUNTRIES) * 1000) / 10;
  const home = countryByCode(world.homeCode);
  const trips = world.trips.filter((t) => t.sure).length;
  const eventCount = events?.filter((e) => e.sure).length ?? null;

  // The next screen's first photos load while this one is being looked at.
  useEffect(() => warmUpWall(world), [world]);

  useEffect(() => {
    const t = setTimeout(() => tapSuccess(), reduce ? 0 : 450);
    return () => clearTimeout(t);
  }, [reduce]);

  const rise = (delay: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay: reduce ? 0 : delay },
  });

  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col overflow-hidden px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(3rem+env(safe-area-inset-top))] text-center">
      <div className="flex flex-1 flex-col justify-center">
        <motion.p {...rise(0.1)} className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ffb3d6]">
          You&apos;ve been to
        </motion.p>

        <div className="relative mx-auto mt-2">
          <Burst delay={0.35} />
          <motion.p
            className="relative font-serif text-[min(6.75rem,13dvh)] font-semibold leading-none tracking-tight"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduce ? { duration: 0.3 } : { type: "spring", stiffness: 160, damping: 14, delay: 0.25 }}
          >
            <CountUp value={codes.length} duration={1.2} delay={0.25} />
          </motion.p>
        </div>
        <motion.p {...rise(0.5)} className="font-serif text-3xl italic text-[#ff8cc6]">
          {codes.length === 1 ? "country" : "countries"}
        </motion.p>

        <motion.div {...rise(1)} className="mx-auto mt-8 grid w-full max-w-sm grid-cols-3 gap-2">
          <Stat value={trips} label={trips === 1 ? "trip" : "trips"} />
          {eventCount === null ? (
            <Stat value={<motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }}>🎫</motion.span>} label="events" />
          ) : eventCount > 0 ? (
            <Stat value={eventCount} label={eventCount === 1 ? "event" : "events"} />
          ) : (
            <Stat value={continents} label={continents === 1 ? "continent" : "continents"} />
          )}
          <Stat value={`${pct}%`} label="of the world" />
        </motion.div>

        {world.firstYear && (
          <motion.p {...rise(1.25)} className="mt-5 text-sm text-white/60">
            Since <span className="font-semibold text-white">{world.firstYear}</span>
          </motion.p>
        )}

        {home && (
          <motion.div {...rise(1.45)} className="mt-6">
            <p className="inline-flex items-center gap-1.5 text-sm text-white/70">
              <Home size={14} aria-hidden /> Home: {home.flag} {home.name}
              {canChangeHome && world.homeCandidates.length > 1 && (
                <button type="button" onClick={() => setPickHome((v) => !v)} className="ml-1 underline decoration-white/30 underline-offset-2 hover:text-white">
                  Not right?
                </button>
              )}
            </p>
            {pickHome && (
              <div className="mt-3 flex flex-wrap justify-center gap-2" role="group" aria-label="Your home country">
                {world.homeCandidates.map((code) => {
                  const c = countryByCode(code);
                  if (!c) return null;
                  const on = code === world.homeCode;
                  return (
                    <button
                      key={code}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        tapLight();
                        setPickHome(false);
                        onChangeHome(code);
                      }}
                      className={`rounded-full px-3 py-1.5 text-sm ring-1 ${on ? "bg-white text-[#2b0b2e] ring-white" : "bg-white/10 text-white ring-white/20 hover:bg-white/20"}`}
                    >
                      {c.flag} {c.name}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </div>

      <motion.div {...rise(1.7)} className="pt-8">
        <button type="button" onClick={onNext} className="btn-accent w-full py-4 text-lg">
          See my countries
        </button>
      </motion.div>
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

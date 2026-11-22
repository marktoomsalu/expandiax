"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { TOTAL_COUNTRIES, countryByCode } from "@/lib/countries";
import { CountUp } from "@/components/worldScan/Burst";
import { formatEventDates } from "@/lib/utils";
import type { WelcomeWorld } from "@/lib/welcomeWorld";

const WorldGlobeInner = dynamic(() => import("@/components/WorldGlobeInner").then((m) => m.WorldGlobeInner), {
  ssr: false,
  loading: () => <div className="h-full w-full" />,
});

const EASE = [0.22, 1, 0.36, 1] as const;
const ICON: Record<string, string> = { concert: "🎤", festival: "🎪", sport: "⚽", conference: "🎓", personal: "💛", other: "✨" };

/**
 * Someone new on ExpandiaX: one card, made to feel like the moment it is. A
 * globe with their countries lit, the count rising, their flags drifting by,
 * the memories they started with, and the way into their world. Only what
 * the viewer may see (see welcomeWorld.ts); their onboarding posts are in
 * here instead of flooding the feed.
 */
export function WelcomeCard({
  actor,
  world,
  when,
  isYou,
}: {
  actor: { username: string; display_name: string; avatar_url: string | null };
  world: WelcomeWorld;
  when: string;
  isYou: boolean;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  // The globe and the count start when the card comes into view, not before (and only once).
  const inView = useInView(ref, { once: true, margin: "120px 0px" });
  // A safety net: on screen but no word from the browser yet, it plays anyway (a card must never stay blank).
  const [forced, setForced] = useState(false);
  useEffect(() => {
    if (inView) return;
    const t = setInterval(() => {
      const r = ref.current?.getBoundingClientRect();
      if (r && r.top < window.innerHeight && r.bottom > 0) setForced(true);
    }, 900);
    return () => clearInterval(t);
  }, [inView]);
  const seen = inView || forced;
  const first = actor.display_name.trim().split(" ")[0] || actor.username;
  const n = world.countries.length;
  const pct = Math.round((n / TOTAL_COUNTRIES) * 1000) / 10;
  const flags = world.countries.map((c) => countryByCode(c)).filter((c): c is NonNullable<typeof c> => !!c);
  // Started with a memory (built by hand: one night they'll never forget, its country on the map): the memory is the star.
  const memory = world.events[0];
  const memoryFirst = !!memory && n <= 2;
  const otherEvents = memoryFirst ? world.events.slice(1) : world.events;
  const rise = (i: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 14 },
    animate: seen ? { opacity: 1, y: 0 } : undefined,
    transition: { duration: 0.6, delay: reduce ? 0 : 0.35 + i * 0.12, ease: EASE },
  });

  return (
    <div ref={ref}>
      {memoryFirst ? (
        <MemoryHero memory={memory} photo={world.memoryPhoto} when={when} seen={seen} reduce={!!reduce} />
      ) : (
      /* The globe, their countries lit, on the night sky */
      <div className="relative h-60 overflow-hidden bg-[radial-gradient(circle_at_50%_40%,#5a1758_0%,#2b0b2e_55%,#14051a_100%)] text-white">
        {/* A few stars */}
        <div aria-hidden className="absolute inset-0 opacity-70 [background-image:radial-gradient(1px_1px_at_12%_18%,white,transparent),radial-gradient(1px_1px_at_80%_12%,white,transparent),radial-gradient(1.5px_1.5px_at_65%_70%,white,transparent),radial-gradient(1px_1px_at_25%_80%,white,transparent),radial-gradient(1px_1px_at_92%_55%,white,transparent),radial-gradient(1px_1px_at_40%_35%,white,transparent)]" />
        <motion.div
          className="pointer-events-none absolute inset-x-0 -bottom-24 top-2 mx-auto w-[min(100%,26rem)]"
          initial={{ opacity: 0, scale: reduce ? 1 : 0.85 }}
          animate={seen ? { opacity: 1, scale: 1 } : undefined}
          transition={{ duration: 1.2, ease: EASE }}
        >
          {seen && n > 0 && <WorldGlobeInner visitedCodes={world.countries} homeCode={world.homeCode ?? undefined} interactive={false} labels={false} autoRotate />}
        </motion.div>
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold ring-1 ring-white/20 backdrop-blur-sm">
          <Sparkles size={13} className="text-[#ffb3d6]" aria-hidden /> New on ExpandiaX
        </span>
        <span className="absolute right-4 top-4 text-xs text-white/60">{when}</span>
        {/* Who */}
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 bg-gradient-to-t from-[#14051a] via-[#14051a]/70 to-transparent px-4 pb-3 pt-10">
          <motion.span
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#fa51a2] to-[#fb7822] font-serif text-2xl ring-4 ring-[#14051a]"
            initial={reduce ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
            animate={seen ? { scale: 1, opacity: 1 } : undefined}
            transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.2 }}
          >
            {actor.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={actor.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              actor.display_name.charAt(0).toUpperCase()
            )}
          </motion.span>
          <p className="pb-1 font-serif text-xl leading-tight">
            {isYou ? "You" : first} just joined <span className="italic text-[#ff8cc6]">ExpandiaX</span>
          </p>
        </div>
      </div>
      )}

      <div className="px-4 pb-5 pt-4 sm:px-5">
        {memoryFirst && (
          <motion.div {...rise(0)} className="mb-3 flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#fa51a2] to-[#fb7822] font-serif text-lg text-white">
              {actor.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={actor.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                actor.display_name.charAt(0).toUpperCase()
              )}
            </span>
            <p className="font-serif text-xl leading-tight">
              {isYou ? "You" : first} just joined <span className="italic text-accent">ExpandiaX</span>
            </p>
          </motion.div>
        )}
        {n > 0 && !memoryFirst && (
          <motion.p {...rise(0)} className="font-serif text-[2rem] leading-none">
            <span className="text-accent">{seen ? <CountUp value={n} duration={1.4} delay={0.3} /> : 0}</span>{" "}
            <span className="text-2xl">{n === 1 ? "country" : "countries"}</span>
            <span className="ml-2 align-middle font-sans text-sm text-muted">{pct}% of the world</span>
          </motion.p>
        )}

        {(world.trips > 0 || world.eventCount > 0 || memoryFirst) && (
          <motion.div {...rise(1)} className="mt-3 flex flex-wrap gap-2 text-sm">
            {memoryFirst && n > 0 && (
              <span className="rounded-full bg-raised px-3 py-1">
                <span className="font-semibold">{n}</span> {n === 1 ? "country" : "countries"}
              </span>
            )}
            {world.trips > 0 && (
              <span className="rounded-full bg-raised px-3 py-1">
                <span className="font-semibold">{world.trips}</span> {world.trips === 1 ? "trip" : "trips"}
              </span>
            )}
            {world.eventCount > 0 && (
              <span className="rounded-full bg-raised px-3 py-1">
                <span className="font-semibold">{world.eventCount}</span> {world.eventCount === 1 ? "memory" : "memories"}
              </span>
            )}
          </motion.div>
        )}

        {/* Their flags, drifting by */}
        {flags.length > (memoryFirst ? 2 : 0) && (
          <motion.div {...rise(2)} className="relative mt-4 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]" aria-label={flags.map((f) => f.name).join(", ")}>
            <motion.div
              className="flex w-max gap-2"
              animate={!reduce && flags.length > 5 ? { x: ["0%", "-50%"] } : undefined}
              transition={{ duration: Math.max(18, flags.length * 2.4), repeat: Infinity, ease: "linear" }}
            >
              {(flags.length > 5 ? [...flags, ...flags] : flags).map((f, i) => (
                <span key={`${f.code}-${i}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-raised text-2xl" title={f.name} aria-hidden>
                  {f.flag}
                </span>
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* The memories they started with */}
        {otherEvents.length > 0 && (
          <motion.ul {...rise(3)} className="mt-4 space-y-1.5">
            {otherEvents.map((e, i) => (
              <li key={i} className="flex items-center gap-2.5 text-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft" aria-hidden>
                  {ICON[e.type] ?? "✨"}
                </span>
                <span className="min-w-0 truncate">
                  <span className="font-medium">{e.title}</span>
                  {e.city && <span className="text-muted"> · {e.city}</span>}
                </span>
              </li>
            ))}
          </motion.ul>
        )}

        <motion.div {...rise(4)}>
          <Link
            href={`/u/${actor.username}`}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-[15px] font-semibold text-white shadow-[0_12px_26px_-12px_rgba(250,81,162,0.8)] transition-transform active:scale-[0.98]"
          >
            {isYou ? "See your world" : `Explore ${first}'s world`} <ArrowRight size={17} aria-hidden />
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

/** For someone who started with a memory: that night, big, with their photo of it (or the artist's). */
function MemoryHero({ memory, photo, when, seen, reduce }: { memory: WelcomeWorld["events"][number]; photo: string | null; when: string; seen: boolean; reduce: boolean }) {
  const place = [memory.venue, memory.city].filter(Boolean).join(", ");
  return (
    <div className="relative h-64 overflow-hidden bg-[radial-gradient(circle_at_30%_30%,#7a2276_0%,#2b0b2e_60%,#14051a_100%)] text-white">
      {photo ? (
        <motion.img
          src={photo}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ opacity: 0, scale: reduce ? 1 : 1.12 }}
          animate={seen ? { opacity: 1, scale: 1 } : undefined}
          transition={{ duration: 1.4, ease: EASE }}
        />
      ) : (
        <motion.span
          aria-hidden
          className="absolute right-6 top-10 text-[7rem] leading-none opacity-80"
          initial={{ opacity: 0, rotate: -12, scale: 0.6 }}
          animate={seen ? { opacity: 0.85, rotate: 0, scale: 1 } : undefined}
          transition={{ type: "spring", stiffness: 120, damping: 12 }}
        >
          {ICON[memory.type] ?? "✨"}
        </motion.span>
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-[#14051a] via-[#14051a]/40 to-transparent" aria-hidden />
      <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-xs font-semibold ring-1 ring-white/20 backdrop-blur-sm">
        <Sparkles size={13} className="text-[#ffb3d6]" aria-hidden /> New on ExpandiaX
      </span>
      <span className="absolute right-4 top-4 rounded-full bg-black/25 px-2 py-0.5 text-xs text-white/80">{when}</span>
      <motion.div
        className="absolute inset-x-0 bottom-0 px-4 pb-4"
        initial={{ opacity: 0, y: reduce ? 0 : 16 }}
        animate={seen ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ffb3d6]">
          {ICON[memory.type] ?? "✨"} First memory
        </p>
        <p className="mt-1 font-serif text-[1.75rem] leading-tight">{memory.title}</p>
        <p className="mt-0.5 text-sm text-white/75">
          {formatEventDates(memory.date, memory.endDate)}
          {place ? ` · ${place}` : ""}
        </p>
      </motion.div>
    </div>
  );
}

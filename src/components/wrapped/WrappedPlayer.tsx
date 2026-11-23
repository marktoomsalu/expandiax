"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { Check, ImagePlus, Loader2, Pause, RotateCcw, Share2, Sparkles, X } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import { formatEventDates } from "@/lib/utils";
import { tapLight, tapSuccess } from "@/lib/haptics";
import { Burst, CountUp } from "@/components/worldScan/Burst";
import { hasStory, type WrappedPhoto, type WrappedYear } from "@/lib/wrapped";

const WorldGlobeInner = dynamic(() => import("@/components/WorldGlobeInner").then((m) => m.WorldGlobeInner), { ssr: false, loading: () => <div className="h-full w-full" /> });

const EASE = [0.22, 1, 0.36, 1] as const;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ICON: Record<string, string> = { concert: "🎤", festival: "🎪", sport: "⚽", conference: "🎓", personal: "💛", other: "✨" };
const TYPE: Record<string, string> = { concert: "Concert", festival: "Festival", sport: "Sport", conference: "Conference", personal: "A day to remember", other: "A moment" };
const MAX_PHOTOS = 12;

type SlideKey = "intro" | "numbers" | "journey" | "quiz" | "photos" | "moments" | "finale" | "empty";

const dayLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" });

/** A shuffle that's the same every time for the same year (the quiz doesn't change on replay). */
function seeded<T>(list: T[], seed: number): T[] {
  const out = [...list];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type Quiz = { question: string; options: { id: string; label: string; flag?: string }[]; answer: string; reveal: string };

/** One question from their own year (never about something they didn't save). */
export function makeQuiz(w: WrappedYear): Quiz | null {
  const first = w.journey.find((s) => s.kind === "trip") ?? null;
  if (first && w.countries.length >= 3) {
    const others = seeded(w.countries.filter((c) => c !== first.code), w.year).slice(0, 3);
    const options = seeded([first.code, ...others], w.year + 1).map((c) => ({ id: c, label: countryByCode(c)?.name ?? c, flag: countryByCode(c)?.flag }));
    const more = w.countries.length - 1;
    return {
      question: `Which country did your ${w.year} start with?`,
      options,
      answer: first.code,
      reveal: `${countryByCode(first.code)?.name}, on ${dayLabel(first.date)}. ${more === 1 ? "One more" : `${more} more`} followed.`,
    };
  }
  if (w.events.length >= 2) {
    const evs = w.events.slice(0, 4);
    return {
      question: `Which moment came first in ${w.year}?`,
      options: seeded(evs.map((e) => ({ id: e.id, label: e.title, flag: ICON[e.type] })), w.year),
      answer: w.events[0].id,
      reveal: `${w.events[0].title}, on ${dayLabel(w.events[0].date)}. The year had begun.`,
    };
  }
  if (w.countries.length >= 2) {
    const n = w.countries.length;
    const opts = seeded([...new Set([n, n + 2, Math.max(1, n - 1), n + 4])].slice(0, 4), w.year);
    return {
      question: `How many countries did ${w.year} take you to?`,
      options: opts.map((x) => ({ id: String(x), label: String(x) })),
      answer: String(n),
      reveal: `${n} countries: ${w.countries.map((c) => countryByCode(c)?.flag).join(" ")}`,
    };
  }
  return null;
}

function usePicks(year: number) {
  const key = `expandiax:wrapped:${year}`;
  const [hidden, setHidden] = useState<string[]>([]);
  const [cover, setCover] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? "{}") as { hidden?: string[]; cover?: string | null };
      setHidden(raw.hidden ?? []);
      setCover(raw.cover ?? null);
    } catch {
      // nothing saved
    }
  }, [key]);
  const save = (h: string[], c: string | null) => {
    setHidden(h);
    setCover(c);
    try {
      localStorage.setItem(key, JSON.stringify({ hidden: h, cover: c }));
    } catch {
      // only for this time
    }
  };
  return { hidden, cover, setHidden: (h: string[]) => save(h, cover), setCover: (c: string | null) => save(hidden, c) };
}

/**
 * ExpandiaX Year Wrapped: someone's year as a short film they can tap
 * through, built only from what they've saved. It adapts to the year they
 * had: twenty countries or one country and three nights out, each chapter
 * only when there's something true to show.
 */
export function WrappedPlayer({ w, startAt = 0 }: { w: WrappedYear; startAt?: number }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const picks = usePicks(w.year);
  const chosen = useMemo(() => w.photos.filter((p) => !picks.hidden.includes(p.id)).slice(0, MAX_PHOTOS), [w.photos, picks.hidden]);
  const quiz = useMemo(() => makeQuiz(w), [w]);
  const slides: SlideKey[] = useMemo(() => {
    if (!hasStory(w)) return ["intro", "empty"];
    return [
      "intro",
      "numbers",
      ...(w.journey.length >= 2 ? (["journey"] as const) : []),
      ...(quiz ? (["quiz"] as const) : []),
      ...(chosen.length >= 3 ? (["photos"] as const) : []),
      ...(w.events.length ? (["moments"] as const) : []),
      "finale",
    ];
  }, [w, quiz, chosen.length]);
  const durations: Record<SlideKey, number | null> = {
    intro: 7000,
    numbers: 11000,
    journey: Math.min(32000, 2600 + w.journey.length * 2000),
    quiz: null,
    // The pile, the mosaic, and a moment to take it in.
    photos: 5200 + Math.min(chosen.length, MAX_PHOTOS) * 480,
    moments: Math.min(26000, 1800 + Math.min(w.events.length, 8) * 3000),
    finale: null,
    empty: null,
  };

  const [index, setIndex] = useState(startAt);
  const [held, setHeld] = useState(false);
  const [sheet, setSheet] = useState<null | "photos" | "cover">(null);
  const paused = held || sheet !== null;
  const [progress, setProgress] = useState(0);
  const slide = slides[Math.min(index, slides.length - 1)];
  const duration = durations[slide];

  const go = useCallback(
    (to: number) => {
      const next = Math.max(0, Math.min(slides.length - 1, to));
      if (next !== index) tapLight();
      setIndex(next);
      setProgress(0);
    },
    [index, slides.length]
  );

  // The clock: each chapter its own time; quiz and finale wait for them.
  useEffect(() => {
    if (!duration || paused) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setProgress((p) => {
        const np = p + dt / duration;
        if (np >= 1) {
          setTimeout(() => go(index + 1), 0);
          return 1;
        }
        return np;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration, paused, index, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function close() {
    if (window.history.length > 1) router.back();
    else router.push("/stats");
  }

  // Tap: left third back, the rest forward; hold to pause; a swipe sideways too.
  const press = useRef<{ x: number; y: number; t: number; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-own-taps]")) return;
    const timer = setTimeout(() => setHeld(true), 220);
    press.current = { x: e.clientX, y: e.clientY, t: Date.now(), timer };
  };
  const onUp = (e: React.PointerEvent) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    clearTimeout(p.timer);
    if (held) return setHeld(false);
    const dx = e.clientX - p.x;
    if (Math.abs(dx) > 50) return go(index + (dx < 0 ? 1 : -1));
    if (Date.now() - p.t > 400) return;
    go(e.clientX < window.innerWidth * 0.3 ? index - 1 : index + 1);
  };

  return (
    <div
      className="fixed inset-0 z-[90] select-none overflow-hidden bg-[#0d0412] text-white"
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={() => {
        if (press.current) clearTimeout(press.current.timer);
        press.current = null;
        setHeld(false);
      }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,#4a1347_0%,#1c0820_55%,#0d0412_100%)]" />

      {/* Chapters: where you are */}
      <div className="absolute inset-x-0 top-0 z-30 px-3 pt-[calc(0.6rem+env(safe-area-inset-top))]">
        <div className="flex gap-1">
          {slides.map((s, i) => (
            <div key={s} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white" style={{ width: `${i < index ? 100 : i === index ? (duration ? progress * 100 : 100) : 0}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wide text-white/70">
            ExpandiaX <span className="text-[#ff8cc6]">Wrapped</span> · {w.year}
          </span>
          <div className="flex items-center gap-1" data-own-taps>
            {held && <Pause size={16} className="text-white/70" aria-label="Paused" />}
            <button type="button" onClick={close} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full text-white/85 hover:bg-white/10">
              <X size={22} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={slide}
          className="absolute inset-0"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          {slide === "intro" && <Intro w={w} />}
          {slide === "numbers" && <Numbers w={w} />}
          {slide === "journey" && <Journey w={w} paused={paused} />}
          {slide === "quiz" && quiz && <QuizSlide quiz={quiz} onNext={() => go(index + 1)} />}
          {slide === "photos" && <Photos w={w} photos={chosen} onChoose={() => setSheet("photos")} />}
          {slide === "moments" && <Moments w={w} paused={paused} />}
          {slide === "finale" && <Finale w={w} cover={picks.cover ?? chosen[0]?.id ?? null} onChangeCover={() => setSheet("cover")} onReplay={() => go(0)} />}
          {slide === "empty" && <Empty w={w} />}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {sheet && (
          <PhotoChooser
            photos={w.photos}
            mode={sheet}
            hidden={picks.hidden}
            cover={picks.cover ?? chosen[0]?.id ?? null}
            onDone={(r) => {
              if (sheet === "photos" && r.hidden) picks.setHidden(r.hidden);
              if (sheet === "cover" && r.cover !== undefined) picks.setCover(r.cover);
              setSheet(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------- chapters

const page = "absolute inset-0 flex flex-col px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(5rem+env(safe-area-inset-top))]";

function Stars() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(1px_1px_at_12%_18%,white,transparent),radial-gradient(1px_1px_at_80%_12%,white,transparent),radial-gradient(1.5px_1.5px_at_65%_70%,white,transparent),radial-gradient(1px_1px_at_25%_80%,white,transparent),radial-gradient(1px_1px_at_92%_55%,white,transparent),radial-gradient(1px_1px_at_40%_35%,white,transparent),radial-gradient(1px_1px_at_55%_8%,white,transparent),radial-gradient(1.5px_1.5px_at_8%_60%,white,transparent)]"
    />
  );
}

function Intro({ w }: { w: WrappedYear }) {
  const reduce = useReducedMotion();
  const line = (delay: number) => ({ initial: { opacity: 0, y: reduce ? 0 : 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.9, delay, ease: EASE } });
  return (
    <div className={page}>
      <Stars />
      {/* The year, huge and faint, slowly coming closer */}
      <motion.p
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[14%] text-center font-serif text-[38vw] font-semibold leading-none text-transparent [-webkit-text-stroke:1px_rgba(255,179,214,0.25)] sm:text-[18rem]"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: reduce ? 1 : 1.08 }}
        transition={{ duration: 7, ease: "easeOut" }}
      >
        {w.year}
      </motion.p>
      <motion.div className="pointer-events-none mx-auto mt-[8vh] w-[min(80vw,24rem)]" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.6, ease: EASE }}>
        <WorldGlobeInner visitedCodes={[]} interactive={false} labels={false} autoRotate />
      </motion.div>
      <div className="mt-auto text-center">
        {w.firstName && (
          <motion.p {...line(0.5)} className="text-lg text-[#ffb3d6]">
            {w.firstName},
          </motion.p>
        )}
        <motion.p {...line(1.1)} className="mt-1 font-serif text-[2.4rem] leading-[1.08]">
          {w.year} was a year
        </motion.p>
        <motion.p {...line(1.9)} className="font-serif text-[2.4rem] italic leading-[1.08] text-[#ff8cc6]">
          you&apos;ll never live again.
        </motion.p>
        <motion.p {...line(3.6)} className="mt-5 text-base text-white/70">
          {hasStory(w) ? "Let's see where it took you." : "Let's look back."}
        </motion.p>
      </div>
    </div>
  );
}

function Numbers({ w }: { w: WrappedYear }) {
  const reduce = useReducedMotion();
  const prev = w.previous;
  const stats: { value: number; label: string; note?: string }[] = [];
  if (w.countries.length)
    stats.push({ value: w.countries.length, label: w.countries.length === 1 ? "country" : "countries", note: w.newCountries.length ? `${w.newCountries.length} new to you` : prev ? `${prev.year}: ${prev.countries}` : undefined });
  if (w.trips) stats.push({ value: w.trips, label: w.trips === 1 ? "trip" : "trips", note: prev && prev.trips ? `${prev.year}: ${prev.trips}` : undefined });
  if (w.events.length) stats.push({ value: w.events.length, label: w.events.length === 1 ? "moment" : "moments", note: prev && prev.events ? `${prev.year}: ${prev.events}` : "concerts, matches & more" });
  if (w.places.length) stats.push({ value: w.places.length, label: w.places.length === 1 ? "place" : "places", note: w.places.slice(0, 2).join(", ") });
  if (w.daysAway) stats.push({ value: w.daysAway, label: "days away", note: "on trips with dates" });
  if (w.continents >= 2) stats.push({ value: w.continents, label: "continents" });
  return (
    <div className={page}>
      <Stars />
      <motion.p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-[#ffb3d6]" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {w.year}, at a glance
      </motion.p>
      <motion.div className="pointer-events-none mx-auto -mt-2 h-[36dvh] w-[min(88vw,26rem)]" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, ease: EASE }}>
        <WorldGlobeInner visitedCodes={w.countries} homeCode={w.homeCode ?? undefined} interactive={false} labels={false} autoRotate />
      </motion.div>
      <div className="mx-auto mt-2 grid w-full max-w-md grid-cols-2 gap-2.5">
        {stats.slice(0, 6).map((s, i) => (
          <motion.div
            key={s.label}
            className="rounded-[20px] bg-white/[0.07] px-4 py-3 ring-1 ring-white/10 backdrop-blur-sm"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 20, delay: 0.8 + i * 0.35 }}
          >
            <p className="font-serif text-[2.1rem] font-semibold leading-none">
              <CountUp value={s.value} duration={1.2} delay={0.9 + i * 0.35} />
            </p>
            <p className="mt-1 text-sm text-white/80">{s.label}</p>
            {s.note && <p className="mt-0.5 truncate text-xs text-[#ffb3d6]">{s.note}</p>}
          </motion.div>
        ))}
      </div>
      {w.partial && <p className="mx-auto mt-auto max-w-sm pt-3 text-center text-[11px] text-white/45">Some trips this year have no exact dates: these are the ones you&apos;ve saved.</p>}
    </div>
  );
}

function Journey({ w, paused }: { w: WrappedYear; paused: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (paused || step >= w.journey.length - 1) return;
    const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 2400 : 2000);
    return () => clearTimeout(t);
  }, [step, paused, w.journey.length]);
  const sofar = w.journey.slice(0, step + 1);
  const route = useMemo(() => sofar.map((s) => s.code), [sofar]);
  const lit = useMemo(() => [...new Set(route)], [route]);
  const stop = w.journey[step];
  const country = countryByCode(stop.code);
  return (
    <div className={page}>
      <Stars />
      <motion.p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-[#ffb3d6]" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        Your {w.year}, as it unfolded
      </motion.p>
      <div className="pointer-events-none mx-auto mt-2 h-[52dvh] w-full max-w-lg">
        <WorldGlobeInner visitedCodes={lit} homeCode={w.homeCode ?? undefined} interactive={false} labels={false} focusCode={stop.code} focusMs={1500} route={route} />
      </div>
      <div className="mx-auto mt-auto w-full max-w-md">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="flex items-center gap-4 rounded-[24px] bg-white/[0.08] px-5 py-4 ring-1 ring-white/10 backdrop-blur-md"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            <span className="relative text-5xl leading-none" aria-hidden>
              {country?.flag}
              {stop.kind === "event" && <span className="absolute -bottom-1 -right-2 rounded-full bg-[#2b0b2e] text-lg">🎟️</span>}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-[#ffb3d6]">{MONTHS[Number(stop.date.slice(5, 7)) - 1]}</span>
              <span className="block truncate font-serif text-2xl">{stop.label}</span>
              {stop.kind === "event" && country && <span className="block truncate text-sm text-white/65">{country.name}</span>}
            </span>
          </motion.div>
        </AnimatePresence>
        <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
          {w.journey.slice(0, 16).map((s, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i <= step ? "w-4 bg-gradient-to-r from-[#fa51a2] to-[#fb7822]" : "w-1.5 bg-white/25"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function QuizSlide({ quiz, onNext }: { quiz: Quiz; onNext: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const right = picked === quiz.answer;
  const controls = useAnimationControls();
  return (
    <div className={page} data-own-taps>
      <Stars />
      <motion.p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-[#ffb3d6]" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        A little quiz
      </motion.p>
      <motion.h2 className="mt-6 text-center font-serif text-[2.1rem] leading-[1.1]" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7, ease: EASE }}>
        {quiz.question}
      </motion.h2>
      <motion.div animate={controls} className="mx-auto mt-8 w-full max-w-md space-y-3">
        {quiz.options.map((o, i) => {
          const isAnswer = o.id === quiz.answer;
          const state = !picked ? "idle" : isAnswer ? "right" : o.id === picked ? "wrong" : "other";
          return (
            <motion.button
              key={o.id}
              type="button"
              disabled={!!picked}
              onClick={() => {
                setPicked(o.id);
                if (o.id === quiz.answer) tapSuccess();
                else {
                  tapLight();
                  void controls.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.45 } });
                }
              }}
              className={`relative flex w-full items-center gap-3 rounded-[20px] px-5 py-4 text-left text-lg ring-1 transition-colors ${
                state === "right" ? "bg-emerald-500/25 ring-emerald-400" : state === "wrong" ? "bg-red-500/20 ring-red-400/70" : state === "other" ? "bg-white/[0.04] text-white/50 ring-white/10" : "bg-white/[0.08] ring-white/15 hover:bg-white/[0.12]"
              }`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0, scale: state === "right" ? 1.03 : 1 }}
              transition={{ delay: picked ? 0 : 0.4 + i * 0.12, type: "spring", stiffness: 260, damping: 22 }}
            >
              {o.flag && (
                <span className="text-2xl" aria-hidden>
                  {o.flag}
                </span>
              )}
              <span className="flex-1 font-medium">{o.label}</span>
              {state === "right" && <Check size={22} className="text-emerald-300" aria-hidden />}
            </motion.button>
          );
        })}
      </motion.div>
      <div className="relative mx-auto mt-6 min-h-[7rem] w-full max-w-md text-center">
        {right && <Burst />}
        <AnimatePresence>
          {picked && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <p className="font-serif text-2xl">{right ? "You remembered." : "Not quite."}</p>
              <p className="mt-1 text-white/75">{quiz.reveal}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {picked && (
        <motion.button type="button" onClick={onNext} className="btn-accent mx-auto mt-auto w-full max-w-md !rounded-full py-4 text-lg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          Keep going
        </motion.button>
      )}
    </div>
  );
}

/** One photo of the mosaic: first onto a pile in the middle, one by one, then all into place. */
function MosaicTile({ photo, i, n }: { photo: WrappedPhoto; i: number; n: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();
  const reduce = useReducedMotion();
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement?.getBoundingClientRect();
    if (!el || !box || reduce) {
      controls.set({ opacity: 1 });
      return;
    }
    const r = el.getBoundingClientRect();
    const dx = box.left + box.width / 2 - (r.left + r.width / 2);
    const dy = box.top + box.height / 2 - (r.top + r.height / 2);
    const turn = ((i * 37) % 24) - 12;
    const pileAt = 0.3 + i * 0.32;
    const settleAt = 0.6 + n * 0.32 + i * 0.04;
    let alive = true;
    controls.set({ x: dx, y: dy, scale: 1.9, rotate: turn, opacity: 0, zIndex: i });
    void (async () => {
      await controls.start({ opacity: 1, scale: 1.55, transition: { delay: pileAt, duration: 0.45, ease: EASE } });
      if (!alive) return;
      await controls.start({ x: 0, y: 0, scale: 1, rotate: 0, transition: { type: "spring", stiffness: 110, damping: 17, delay: Math.max(0, settleAt - pileAt - 0.45) } });
    })();
    return () => {
      alive = false;
    };
  }, [controls, i, n, reduce]);
  return (
    <motion.div ref={ref} animate={controls} initial={{ opacity: 0 }} className="relative aspect-square overflow-hidden rounded-xl shadow-[0_12px_30px_-10px_rgba(0,0,0,0.7)] ring-2 ring-white/90">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt="" className="h-full w-full object-cover" />
    </motion.div>
  );
}

function Photos({ w, photos, onChoose }: { w: WrappedYear; photos: WrappedPhoto[]; onChoose: () => void }) {
  const cols = photos.length <= 4 ? 2 : 3;
  return (
    <div className={page}>
      <Stars />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#ffb3d6]">Your year in photos</p>
          <p className="mt-1 font-serif text-2xl">{w.year}, in your own pictures</p>
        </div>
        <button type="button" data-own-taps onClick={onChoose} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold ring-1 ring-white/20 hover:bg-white/15">
          <ImagePlus size={14} aria-hidden /> Choose
        </button>
      </div>
      <div className="relative mx-auto mt-6 grid w-full max-w-md gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {photos.map((p, i) => (
          <MosaicTile key={p.id} photo={p} i={i} n={photos.length} />
        ))}
      </div>
      <p className="mt-auto pt-4 text-center text-xs text-white/50">From the photos you&apos;ve saved in ExpandiaX this year.</p>
    </div>
  );
}

function Moments({ w, paused }: { w: WrappedYear; paused: boolean }) {
  const deck = w.events.slice(0, 8);
  const [at, setAt] = useState(0);
  useEffect(() => {
    if (paused || at >= deck.length - 1) return;
    const t = setTimeout(() => setAt((a) => a + 1), 3000);
    return () => clearTimeout(t);
  }, [at, paused, deck.length]);
  return (
    <div className={page}>
      <Stars />
      <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-[#ffb3d6]">{deck.length === 1 ? "The moment that made your year" : "The moments that made your year"}</p>
      <div className="relative mx-auto mt-6 h-[60dvh] w-full max-w-sm">
        <AnimatePresence initial={false}>
          {deck.map((e, i) => {
            const depth = i - at;
            if (depth < 0 || depth > 2) return null;
            const country = e.code ? countryByCode(e.code) : null;
            const place = [e.venue, e.city].filter(Boolean).join(", ");
            return (
              <motion.div
                key={e.id}
                className="absolute inset-0 overflow-hidden rounded-[28px] bg-[#2b0b2e] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/15"
                style={{ zIndex: 10 - depth }}
                initial={{ opacity: 0, x: 120, rotate: 8, scale: 0.9 }}
                animate={{ opacity: depth === 0 ? 1 : 0.6, x: 0, y: depth * 16, rotate: depth === 0 ? 0 : depth % 2 ? 3 : -3, scale: 1 - depth * 0.05 }}
                exit={{ opacity: 0, x: -260, rotate: -12, transition: { duration: 0.5 } }}
                transition={{ type: "spring", stiffness: 140, damping: 20 }}
              >
                <div className="relative h-[62%] bg-[linear-gradient(135deg,#7a2276,#2b0b2e)]">
                  {e.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-[6rem]" aria-hidden>
                      {ICON[e.type] ?? "✨"}
                    </span>
                  )}
                  <span className="absolute inset-0 bg-gradient-to-t from-[#2b0b2e] via-transparent to-transparent" aria-hidden />
                  <span className="absolute left-4 top-4 rounded-full bg-black/35 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                    {ICON[e.type] ?? "✨"} {TYPE[e.type] ?? "A moment"}
                  </span>
                </div>
                <div className="px-5 pt-3">
                  <p className="font-serif text-[1.9rem] leading-tight">{e.title}</p>
                  <p className="mt-1 text-sm text-[#ffb3d6]">{formatEventDates(e.date, e.endDate)}</p>
                  {(place || country) && (
                    <p className="mt-0.5 truncate text-sm text-white/70">
                      {country?.flag} {place || country?.name}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      {deck.length > 1 && (
        <p className="mt-auto pt-4 text-center text-sm text-white/60">
          {at + 1} of {deck.length}
          {w.events.length > deck.length ? ` (and ${w.events.length - deck.length} more)` : ""}
        </p>
      )}
    </div>
  );
}

function Finale({ w, cover, onChangeCover, onReplay }: { w: WrappedYear; cover: string | null; onChangeCover: () => void; onReplay: () => void }) {
  const wide = `/api/wrapped/poster?year=${w.year}&format=wide${cover ? `&photo=${cover}` : ""}`;
  const story = `/api/wrapped/poster?year=${w.year}&format=story${cover ? `&photo=${cover}` : ""}`;
  const [loaded, setLoaded] = useState(false);
  const files = useRef(new Map<string, Promise<File | null>>());
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "wide" | "story">(null);
  const get = useCallback((url: string, name: string) => {
    let p = files.current.get(url);
    if (!p) {
      p = fetch(url)
        .then((r) => (r.ok ? r.blob() : null))
        .then((b) => (b ? new File([b], name, { type: "image/png" }) : null))
        .catch(() => null);
      files.current.set(url, p);
    }
    return p;
  }, []);
  // Both made ahead, so Share opens at once.
  useEffect(() => {
    setLoaded(false);
    void get(wide, `expandiax-${w.year}.png`);
    void get(story, `expandiax-${w.year}-story.png`);
  }, [wide, story, get, w.year]);

  async function share(which: "wide" | "story") {
    setNote(null);
    setBusy(which);
    const f = await get(which === "wide" ? wide : story, which === "wide" ? `expandiax-${w.year}.png` : `expandiax-${w.year}-story.png`);
    setBusy(null);
    if (!f) return setNote("Couldn't make the picture. Try again?");
    try {
      if (navigator.canShare?.({ files: [f] })) return void (await navigator.share({ files: [f] }));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      if ((e as Error).name === "NotAllowedError") return setNote("Ready: tap again to share.");
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    a.click();
  }

  return (
    <div className={page} data-own-taps>
      <Stars />
      <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-[#ffb3d6]">Your {w.year}, in one picture</p>
      <motion.div
        className="relative mx-auto mt-5 aspect-video w-full max-w-xl overflow-hidden rounded-[18px] bg-white/5 shadow-[0_30px_80px_-20px_rgba(250,81,162,0.45)] ring-1 ring-white/15"
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, ease: EASE }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={wide} src={wide} alt={`Your ${w.year} on ExpandiaX`} onLoad={() => setLoaded(true)} className={`h-full w-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`} />
        {!loaded && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="animate-spin text-white/60" aria-hidden />
          </span>
        )}
      </motion.div>
      {w.photos.length > 1 && (
        <button type="button" onClick={onChangeCover} className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-[#ffb3d6] hover:bg-white/10">
          <ImagePlus size={15} aria-hidden /> Change photo
        </button>
      )}
      <div className="mx-auto mt-auto w-full max-w-md space-y-3">
        {note && <p className="text-center text-sm text-white/70">{note}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={() => void share("story")} disabled={!!busy} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#7c3aed] via-[#fa51a2] to-[#fb7822] py-4 text-base font-semibold shadow-[0_12px_30px_-12px_rgba(250,81,162,0.9)]">
            {busy === "story" ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Sparkles size={18} aria-hidden />} Story
          </button>
          <button type="button" onClick={() => void share("wide")} disabled={!!busy} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-4 text-base font-semibold text-[#2b0b2e]">
            {busy === "wide" ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Share2 size={18} aria-hidden />} Share
          </button>
        </div>
        <button type="button" onClick={onReplay} className="mx-auto flex items-center gap-1.5 text-sm text-white/60 hover:text-white">
          <RotateCcw size={14} aria-hidden /> Watch again
        </button>
        <p className="text-center text-[11px] text-white/40">Made from what you&apos;ve saved in ExpandiaX{w.partial ? " (some trips without exact dates)" : ""}.</p>
      </div>
    </div>
  );
}

function Empty({ w }: { w: WrappedYear }) {
  return (
    <div className={page} data-own-taps>
      <Stars />
      <div className="my-auto text-center">
        <p className="text-6xl" aria-hidden>
          🌍
        </p>
        <h2 className="mt-5 font-serif text-[2.2rem] leading-tight">
          Your {w.year} story is <span className="italic text-[#ff8cc6]">still being written.</span>
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-white/70">Add the places and the moments from this year, and your Wrapped will tell their story.</p>
      </div>
      <div className="mx-auto w-full max-w-md space-y-3">
        <Link href="/my-world" className="btn-accent flex w-full items-center justify-center !rounded-full py-4 text-lg">
          Add this year&apos;s countries
        </Link>
        <Link href="/events/new" className="flex w-full items-center justify-center rounded-full py-3.5 text-base font-medium ring-1 ring-white/30 hover:bg-white/10">
          Add a moment
        </Link>
      </div>
    </div>
  );
}

function PhotoChooser({
  photos,
  mode,
  hidden,
  cover,
  onDone,
}: {
  photos: WrappedPhoto[];
  mode: "photos" | "cover";
  hidden: string[];
  cover: string | null;
  onDone: (r: { hidden?: string[]; cover?: string | null }) => void;
}) {
  const [off, setOff] = useState<Set<string>>(new Set(hidden));
  const [pick, setPick] = useState<string | null>(cover);
  const shown = photos.filter((p) => !off.has(p.id)).length;
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end bg-black/60" data-own-taps initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="flex max-h-[85dvh] w-full flex-col rounded-t-[28px] bg-[#1c0820] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 ring-1 ring-white/10"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
      >
        <div className="flex items-center justify-between px-1">
          <p className="font-serif text-xl">{mode === "cover" ? "The photo for your year" : "Photos in your Wrapped"}</p>
          <button
            type="button"
            onClick={() => onDone(mode === "cover" ? { cover: pick } : { hidden: [...off] })}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#2b0b2e]"
          >
            Done
          </button>
        </div>
        <p className="mt-1 px-1 text-xs text-white/55">{mode === "cover" ? "Tap one." : `Tap to leave one out. Up to ${MAX_PHOTOS} are used (${Math.min(shown, MAX_PHOTOS)} now).`}</p>
        <div className="mt-3 grid flex-1 grid-cols-4 gap-1.5 overflow-y-auto">
          {photos.map((p) => {
            const on = mode === "cover" ? pick === p.id : !off.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  tapLight();
                  if (mode === "cover") setPick(p.id);
                  else
                    setOff((o) => {
                      const n = new Set(o);
                      if (n.has(p.id)) n.delete(p.id);
                      else n.add(p.id);
                      return n;
                    });
                }}
                aria-pressed={on}
                className={`relative aspect-square overflow-hidden rounded-lg ${on ? "ring-2 ring-[#fa51a2]" : "opacity-40"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.label} className="h-full w-full object-cover" />
                {on && (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#fa51a2]">
                    <Check size={12} strokeWidth={3} aria-hidden />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

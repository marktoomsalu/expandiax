"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { ArrowRight, CalendarDays, Camera, Check, Globe2, ImagePlus, Loader2, MapPin, Mountain, Pause, Plane, Sparkles, Ticket, X } from "lucide-react";
import { TOTAL_COUNTRIES, countryByCode } from "@/lib/countries";
import { tapLight, tapSuccess } from "@/lib/haptics";
import { Burst, CountUp } from "@/components/worldScan/Burst";
import { hasStory, type WrappedPhoto, type WrappedYear } from "@/lib/wrapped";

import { GlobePicture } from "./GlobePicture";

const EASE = [0.22, 1, 0.36, 1] as const;
const MAX_PHOTOS = 12;
const ICON: Record<string, string> = { concert: "🎤", festival: "🎪", sport: "⚽", conference: "🎓", personal: "💛", other: "✨" };

// Unsplash, credited on the slide (the opening and the achievements).
const HERO = {
  url: "https://images.unsplash.com/photo-1613713569254-7fee3cbb1afa?ixid=M3wxMDgzNTIzfDB8MXxzZWFyY2h8NHx8cGVyc29uJTIwc2l0dGluZyUyMG1vdW50YWluJTIwc3Vuc2V0fGVufDF8MXx8fDE3OTU0MjY2OTZ8MA&ixlib=rb-4.1.0&w=1200&q=80&auto=format",
  author: "Mohammad Alizade",
  authorUrl: "https://unsplash.com/@mohamadaz?utm_source=expandiax&utm_medium=referral",
};
const PEAKS = {
  url: "https://images.unsplash.com/photo-1773328937923-c00e0372af4f?ixid=M3wxMDgzNTIzfDB8MXxzZWFyY2h8N3x8bW91bnRhaW4lMjByYW5nZSUyMHN1bnNldCUyMHB1cnBsZXxlbnwxfDF8fHwxNzk1NDI2Njk3fDA&ixlib=rb-4.1.0&w=1200&q=80&auto=format",
  author: "Bruno van der Kraan",
  authorUrl: "https://unsplash.com/@brunovdkraan?utm_source=expandiax&utm_medium=referral",
};

type SlideKey = "intro" | "glance" | "world" | "highlights" | "quiz" | "memories" | "achievements" | "finale" | "empty";

const shortRange = (from: string | null, to: string | null) => {
  if (!from) return "";
  const f = new Date(`${from}T00:00:00`);
  const t = to ? new Date(`${to}T00:00:00`) : f;
  const d = (x: Date, month: boolean) => x.toLocaleDateString("en-GB", month ? { day: "numeric", month: "short" } : { day: "numeric" });
  if (+f === +t) return d(f, true);
  return f.getMonth() === t.getMonth() ? `${d(f, false)} – ${d(t, true)}` : `${d(f, true)} – ${d(t, true)}`;
};

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

type Quiz = { question: string; photo?: string; options: { id: string; label: string; flag?: string }[]; answer: string; reveal: string };

/** One question from their own year: best, one of their own photos ("where did you see this?"). */
export function makeQuiz(w: WrappedYear): Quiz | null {
  const others = (code: string, n: number) => seeded(w.countries.filter((c) => c !== code), w.year).slice(0, n);
  const opt = (c: string) => ({ id: c, label: countryByCode(c)?.name ?? c, flag: countryByCode(c)?.flag });
  if (w.countries.length >= 3) {
    const pics = w.photos.filter((p) => p.code && w.countries.includes(p.code) && p.code !== w.homeCode);
    const pic = pics.length ? pics[w.year % pics.length] : null;
    if (pic?.code) {
      return {
        question: `In which country did you see this view in ${w.year}?`,
        photo: pic.url,
        options: seeded([pic.code, ...others(pic.code, 2)], w.year + 3).map(opt),
        answer: pic.code,
        reveal: `${countryByCode(pic.code)?.name}${pic.takenAt ? `, ${new Date(pic.takenAt).toLocaleDateString("en-GB", { month: "long" })}` : ""}.`,
      };
    }
    const first = w.journey.find((s) => s.kind === "trip");
    if (first) {
      return {
        question: `Which country did your ${w.year} start with?`,
        options: seeded([first.code, ...others(first.code, 2)], w.year + 1).map(opt),
        answer: first.code,
        reveal: `${countryByCode(first.code)?.name}. ${w.countries.length - 1} more followed.`,
      };
    }
  }
  if (w.events.length >= 2) {
    return {
      question: `Which moment came first in ${w.year}?`,
      options: seeded(w.events.slice(0, 3).map((e) => ({ id: e.id, label: e.title, flag: ICON[e.type] })), w.year),
      answer: w.events[0].id,
      reveal: `${w.events[0].title} opened your year.`,
    };
  }
  if (w.countries.length >= 2) {
    const n = w.countries.length;
    const opts = seeded([...new Set([n, n + 2, Math.max(1, n - 1)])], w.year);
    return { question: `How many countries did ${w.year} take you to?`, options: opts.map((x) => ({ id: String(x), label: String(x) })), answer: String(n), reveal: w.countries.map((c) => countryByCode(c)?.flag).join(" ") };
  }
  return null;
}

type Badge = { key: string; title: string; note: string; icon: typeof Mountain; from: string; to: string };

/** What they did, as badges (only what's true). */
function achievements(w: WrappedYear): Badge[] {
  const out: Badge[] = [];
  if (w.newCountries.length) out.push({ key: "explorer", title: "Explorer", note: `+${w.newCountries.length} ${w.newCountries.length === 1 ? "country" : "countries"}`, icon: Mountain, from: "#fbbf24", to: "#fb7822" });
  if (w.events.length) out.push({ key: "events", title: "Event Lover", note: `${w.events.length} ${w.events.length === 1 ? "event" : "events"}`, icon: Ticket, from: "#fa51a2", to: "#c026d3" });
  if (w.trips) out.push({ key: "trips", title: "Globetrotter", note: `${w.trips} ${w.trips === 1 ? "trip" : "trips"}`, icon: Plane, from: "#a78bfa", to: "#7c3aed" });
  if (w.continents >= 2) out.push({ key: "continents", title: "Continent Hopper", note: `${w.continents} continents`, icon: Globe2, from: "#38bdf8", to: "#6366f1" });
  if (w.photos.length >= 10) out.push({ key: "photos", title: "Storyteller", note: `${w.photos.length} photos`, icon: Camera, from: "#fb7822", to: "#fa51a2" });
  return out.slice(0, 3);
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
 * ExpandiaX Year Wrapped: someone's year as a short film to tap through,
 * built only from what they've saved, each chapter only when there's
 * something true to show: twenty countries, or one country and three
 * nights out, both get a year worth celebrating.
 */
export function WrappedPlayer({ w, startAt = 0 }: { w: WrappedYear; startAt?: number }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const picks = usePicks(w.year);
  const chosen = useMemo(() => w.photos.filter((p) => !picks.hidden.includes(p.id)).slice(0, MAX_PHOTOS), [w.photos, picks.hidden]);
  const quiz = useMemo(() => makeQuiz(w), [w]);
  const badges = useMemo(() => achievements(w), [w]);
  const slides: SlideKey[] = useMemo(() => {
    if (!hasStory(w)) return ["intro", "empty"];
    return [
      "intro",
      "glance",
      ...(w.countries.length ? (["world"] as const) : []),
      ...(w.highlights.length ? (["highlights"] as const) : []),
      ...(quiz ? (["quiz"] as const) : []),
      ...(chosen.length >= 3 ? (["memories"] as const) : []),
      ...(badges.length ? (["achievements"] as const) : []),
      "finale",
    ];
  }, [w, quiz, chosen.length, badges.length]);
  const durations: Record<SlideKey, number | null> = {
    intro: null,
    glance: 7500,
    world: 7000,
    highlights: 7000,
    quiz: null,
    memories: 4800 + Math.min(chosen.length, 7) * 500,
    achievements: 6500,
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

  // The clock: each chapter its own time; the opening, quiz and finale wait for them.
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
  const press = useRef<{ x: number; t: number; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-own-taps]")) return;
    const timer = setTimeout(() => setHeld(true), 220);
    press.current = { x: e.clientX, t: Date.now(), timer };
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

  const cover = picks.cover ?? w.highlights[0]?.id ?? null;
  // The Story picture, made while they watch (after their saved cover has loaded).
  useEffect(() => {
    if (!hasStory(w)) return;
    const t = setTimeout(() => void storyFile(storyUrl(w, cover), w.year), 1500);
    return () => clearTimeout(t);
  }, [w, cover]);

  return (
    <div
      className="fixed inset-0 z-[90] select-none overflow-hidden bg-[#120818] text-white"
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={() => {
        if (press.current) clearTimeout(press.current.timer);
        press.current = null;
        setHeld(false);
      }}
    >
      {/* ExpandiaX night: deep purple, a pink glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_0%,#3d1240_0%,#1f0a25_50%,#120818_100%)]" />

      {/* Where you are, and the way out */}
      <div className="absolute inset-x-0 top-0 z-30 px-4 pt-[calc(0.6rem+env(safe-area-inset-top))]">
        <div className="flex gap-1">
          {slides.map((s, i) => (
            <div key={s} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white" style={{ width: `${i < index ? 100 : i === index ? (duration ? progress * 100 : 100) : 0}%` }} />
            </div>
          ))}
        </div>
        <div className="relative mt-3 flex h-8 items-center justify-center">
          <Image src="/wordmark.svg" alt="ExpandiaX" width={1780} height={522} className="h-6 w-auto" priority />
          <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-1" data-own-taps>
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
          {slide === "intro" && <Intro w={w} onGo={() => go(index + 1)} />}
          {slide === "glance" && <Glance w={w} />}
          {slide === "world" && <World w={w} />}
          {slide === "highlights" && <Highlights w={w} />}
          {slide === "quiz" && quiz && <QuizSlide w={w} quiz={quiz} onNext={() => go(index + 1)} />}
          {slide === "memories" && <Memories w={w} photos={chosen} onChoose={() => setSheet("photos")} />}
          {slide === "achievements" && <Achievements w={w} badges={badges} />}
          {slide === "finale" && <Finale w={w} cover={cover} onChangeCover={() => setSheet("cover")} onReplay={() => go(0)} />}
          {slide === "empty" && <Empty w={w} />}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {sheet && (
          <PhotoChooser
            photos={sheet === "cover" ? coverChoices(w) : w.photos}
            mode={sheet}
            hidden={picks.hidden}
            cover={cover}
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

/** What the finale can show: their highlights first, then any photo of the year. */
function coverChoices(w: WrappedYear): WrappedPhoto[] {
  const hl = w.highlights.map((h) => ({ id: h.id, url: h.photo, takenAt: h.from, label: h.title, code: h.code }));
  return [...hl, ...w.photos.filter((p) => !hl.some((h) => h.url === p.url))];
}

// ---------------------------------------------------------------- pieces

const page = "absolute inset-0 flex flex-col px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(6rem+env(safe-area-inset-top))]";

function Title({ children, delay = 0.1 }: { children: React.ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.h2
      className="text-center font-sans text-[2.15rem] font-bold leading-[1.08] tracking-tight"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.h2>
  );
}

function Credit({ who, href }: { who: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" data-own-taps className="absolute bottom-[calc(0.4rem+env(safe-area-inset-bottom))] right-3 z-10 text-[9px] text-white/40">
      Photo: {who} / Unsplash
    </a>
  );
}

function Delta({ now, before, year, unit = "" }: { now: number; before: number | null | undefined; year: number; unit?: string }) {
  if (before == null) return null;
  const d = now - before;
  if (d > 0)
    return (
      <p className="mt-1 text-xs font-semibold text-emerald-300">
        ↑ +{d}
        {unit} vs {year}
      </p>
    );
  return (
    <p className="mt-1 text-xs text-white/50">
      {year}: {before}
      {unit}
    </p>
  );
}

// ---------------------------------------------------------------- chapters

function Intro({ w, onGo }: { w: WrappedYear; onGo: () => void }) {
  const reduce = useReducedMotion();
  const word = (delay: number) => ({ initial: { opacity: 0, y: reduce ? 0 : 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, delay, ease: EASE } });
  return (
    <div className="absolute inset-0">
      {/* Someone on a mountain at dusk, slowly coming closer */}
      <motion.div className="absolute inset-0" initial={{ scale: 1.15 }} animate={{ scale: reduce ? 1.15 : 1.02 }} transition={{ duration: 12, ease: "easeOut" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HERO.url} alt="" className="h-full w-full object-cover object-[60%_center]" />
      </motion.div>
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,#120818_0%,rgba(45,12,52,0.85)_22%,rgba(122,34,118,0.35)_48%,rgba(251,120,34,0.12)_62%,rgba(18,8,24,0.75)_88%,#120818_100%)] mix-blend-normal" />
      <div aria-hidden className="absolute inset-0 bg-[#5a1758]/25 mix-blend-color" />

      <div className="absolute inset-x-0 top-[calc(7rem+env(safe-area-inset-top))] flex flex-col items-center px-6">
        <div className="relative w-full max-w-sm">
          <motion.p {...word(0.3)} className="pl-[8%] font-serif text-[4.4rem] font-semibold italic leading-[0.92] bg-gradient-to-b from-[#ffe4f1] to-[#ff8cc6] bg-clip-text text-transparent">
            Your
          </motion.p>
          <div className="relative">
            <motion.p {...word(0.6)} className="pl-[26%] font-serif text-[4.4rem] font-semibold italic leading-[0.92] bg-gradient-to-b from-white to-[#ffc2df] bg-clip-text text-transparent">
              Year
            </motion.p>
            {/* The swoosh round it, drawn in; and a little star */}
            <svg aria-hidden viewBox="0 0 400 150" className="pointer-events-none absolute -left-[4%] -top-[48%] h-[210%] w-[108%] overflow-visible">
              <motion.path
                d="M60 120 C 0 95, 30 40, 200 28 C 350 18, 400 60, 340 92 C 290 118, 160 128, 70 112"
                fill="none"
                stroke="url(#swoosh)"
                strokeWidth="2.2"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.6, delay: 1.2, ease: "easeInOut" }}
              />
              <defs>
                <linearGradient id="swoosh" x1="0" x2="1">
                  <stop offset="0" stopColor="#ffb3d6" />
                  <stop offset="1" stopColor="#fb7822" />
                </linearGradient>
              </defs>
            </svg>
            <motion.span
              aria-hidden
              className="absolute right-[6%] top-[-18%] text-[#ffd1e8]"
              initial={{ scale: 0, rotate: -45 }}
              animate={reduce ? { scale: 1, rotate: 0 } : { scale: [0, 1.2, 1], rotate: 0, opacity: [0, 1, 0.85, 1] }}
              transition={{ duration: 1, delay: 2.4 }}
            >
              <Sparkles size={30} />
            </motion.span>
          </div>
          <motion.p {...word(0.9)} className="pl-[4%] font-serif text-[4.4rem] font-semibold italic leading-[0.92] bg-gradient-to-b from-[#ffd1e8] to-[#fa51a2] bg-clip-text text-transparent">
            Wrapped
          </motion.p>
        </div>
        <motion.p {...word(1.8)} className="mt-10 text-center text-xl leading-snug text-white/90">
          {w.firstName ? `${w.firstName}, your` : "Your"} {w.year}
          <br />
          in experiences
        </motion.p>
      </div>

      <motion.div className="absolute inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] flex justify-center" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.6, duration: 0.7 }}>
        <button type="button" data-own-taps onClick={onGo} className="inline-flex items-center gap-2 rounded-full bg-[#ffe4f1] px-8 py-3.5 text-lg font-semibold text-[#2b0b2e] shadow-[0_14px_40px_-10px_rgba(250,81,162,0.8)] transition-transform active:scale-95">
          Let&apos;s go <ArrowRight size={19} aria-hidden />
        </button>
      </motion.div>
      <Credit who={HERO.author} href={HERO.authorUrl} />
    </div>
  );
}

function Glance({ w }: { w: WrappedYear }) {
  const reduce = useReducedMotion();
  const prev = w.previous;
  const cards = [
    { icon: Globe2, value: w.countries.length, label: w.countries.length === 1 ? "country" : "countries", before: prev?.countries },
    { icon: CalendarDays, value: w.events.length, label: w.events.length === 1 ? "event" : "events", before: prev?.events },
    { icon: Plane, value: w.trips, label: w.trips === 1 ? "trip" : "trips", before: prev?.trips },
    { icon: MapPin, value: w.places.length, label: w.places.length === 1 ? "place" : "places", before: null },
  ].filter((c) => c.value > 0);
  return (
    <div className={page}>
      <Title>
        Your year
        <br />
        at a glance
      </Title>
      <div className="relative z-10 mx-auto mt-7 grid w-full max-w-sm grid-cols-2 gap-3">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            className="rounded-[22px] bg-[#2a1336]/80 p-4 ring-1 ring-white/12"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 22, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 20, delay: 0.5 + i * 0.2 }}
          >
            <c.icon size={22} className="text-[#ff8cc6]" aria-hidden />
            <p className="mt-3 text-[2.4rem] font-bold leading-none">
              <CountUp value={c.value} duration={1.1} delay={0.7 + i * 0.2} />
            </p>
            <p className="mt-1 text-white/85">{c.label}</p>
            <Delta now={c.value} before={c.before} year={prev?.year ?? w.year - 1} />
          </motion.div>
        ))}
      </div>
      {/* The Earth at night, rising from below */}
      <motion.div
        className="pointer-events-none absolute inset-x-[-30%] bottom-[-62%]"
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, delay: 0.2, ease: EASE }}
      >
        <GlobePicture countries={w.countries} home={w.homeCode} route={w.journey.map((s) => s.code)} tilt={-22} drawDelay={1.2} className="w-full" />
      </motion.div>
    </div>
  );
}

function World({ w }: { w: WrappedYear }) {
  // The whole year's route at once: a picture, drawn in line by line.
  const route = useMemo(() => w.journey.map((s) => s.code), [w.journey]);
  const pct = Math.round((w.countries.length / TOTAL_COUNTRIES) * 1000) / 10;
  const prevPct = w.previous ? Math.round((w.previous.countries / TOTAL_COUNTRIES) * 1000) / 10 : null;
  // The continent with the most of their countries, and the first new one.
  const continent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of w.countries) {
      const k = countryByCode(c)?.continent;
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [w.countries]);
  const fresh = w.newCountries[0] ? countryByCode(w.newCountries[0]) : null;
  return (
    <div className={page}>
      <Title>
        Your world
        <br />
        in {w.year}
      </Title>
      <motion.p className="mt-3 text-center text-white/85" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        You explored {pct}% of the world
      </motion.p>
      {prevPct != null && pct > prevPct && (
        <motion.p className="text-center text-xs font-semibold text-emerald-300" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          ↑ +{Math.round((pct - prevPct) * 10) / 10} pp vs {w.previous?.year}
        </motion.p>
      )}
      <motion.div
        className="pointer-events-none -mx-6 my-auto w-[calc(100%+3rem)] max-w-[34rem] self-center"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: EASE }}
      >
        <GlobePicture countries={w.countries} home={w.homeCode} route={route} drawDelay={0.5} className="w-full" />
      </motion.div>
      <div className="mx-auto grid w-full max-w-sm grid-cols-2 gap-3">
        {continent && (
          <motion.div className="flex items-center gap-3 rounded-[20px] bg-white/[0.07] px-4 py-3 ring-1 ring-white/12" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}>
            <Globe2 size={22} className="shrink-0 text-[#ff8cc6]" aria-hidden />
            <span className="min-w-0">
              <span className="block text-[11px] text-white/60">Most visited</span>
              <span className="block truncate font-semibold">{continent}</span>
            </span>
          </motion.div>
        )}
        {fresh && (
          <motion.div className="flex items-center gap-3 rounded-[20px] bg-white/[0.07] px-4 py-3 ring-1 ring-white/12" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
            <span className="text-2xl leading-none" aria-hidden>
              {fresh.flag}
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] text-white/60">New this year</span>
              <span className="block truncate font-semibold">{fresh.name}</span>
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

const RANK = ["from-[#fbbf24] to-[#fb7822]", "from-[#fa51a2] to-[#c026d3]", "from-[#a78bfa] to-[#7c3aed]"];

function Highlights({ w }: { w: WrappedYear }) {
  const reduce = useReducedMotion();
  return (
    <div className={page}>
      <Title>
        Your
        <br />
        highlights
      </Title>
      <div className="mx-auto mt-7 w-full max-w-sm space-y-3.5">
        {w.highlights.map((h, i) => (
          <motion.div
            key={h.id}
            className="relative h-[19dvh] min-h-[118px] overflow-hidden rounded-[22px] shadow-[0_20px_40px_-18px_rgba(0,0,0,0.8)] ring-1 ring-white/15"
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: i % 2 ? -90 : 90, rotate: i % 2 ? -6 : 6 }}
            animate={{ opacity: 1, x: 0, rotate: i % 2 ? 1.5 : -1.5 }}
            transition={{ type: "spring", stiffness: 120, damping: 16, delay: 0.5 + i * 0.35 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={h.photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" aria-hidden />
            <span className={`absolute right-3 top-3 rounded-full bg-gradient-to-br px-2.5 py-1 text-sm font-bold text-white shadow ${RANK[i]}`}>#{i + 1}</span>
            <div className="absolute inset-x-4 bottom-3">
              <p className="truncate text-xl font-bold">{h.title}</p>
              {h.from && (
                <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-white/85">
                  <CalendarDays size={14} aria-hidden /> {shortRange(h.from, h.to)}
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function QuizSlide({ w, quiz, onNext }: { w: WrappedYear; quiz: Quiz; onNext: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const right = picked === quiz.answer;
  const controls = useAnimationControls();
  return (
    <div className={page} data-own-taps>
      <Title>
        Your
        <br />
        travel quiz
      </Title>
      <motion.p className="mt-2 text-center text-white/75" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        How well do you remember your year?
      </motion.p>
      <motion.div
        animate={controls}
        className="relative mx-auto mt-6 w-full max-w-sm rounded-[26px] bg-white/[0.07] p-3 ring-1 ring-white/12 backdrop-blur-md"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6, ease: EASE }}
      >
        {quiz.photo && (
          <div className="relative h-[20dvh] min-h-[120px] overflow-hidden rounded-[18px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={quiz.photo} alt="One of your photos from this year" className="h-full w-full object-cover" />
          </div>
        )}
        <p className="mt-4 px-2 text-center text-lg font-semibold leading-snug">{quiz.question}</p>
        <div className="mt-4 space-y-2.5">
          {quiz.options.map((o, i) => {
            const isAnswer = o.id === quiz.answer;
            const state = !picked ? "idle" : isAnswer ? "right" : o.id === picked ? "wrong" : "other";
            return (
              <button
                key={o.id}
                type="button"
                disabled={!!picked}
                onClick={() => {
                  setPicked(o.id);
                  if (isAnswer) tapSuccess();
                  else {
                    tapLight();
                    void controls.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.45 } });
                  }
                }}
                className={`flex w-full items-center gap-3 rounded-full px-3 py-2.5 text-left ring-1 transition-colors ${
                  state === "right"
                    ? "bg-[#fa51a2]/20 ring-2 ring-[#fa51a2]"
                    : state === "wrong"
                      ? "bg-white/[0.04] text-white/60 ring-white/20"
                      : state === "other"
                        ? "bg-white/[0.03] text-white/45 ring-white/10"
                        : "bg-white/[0.06] ring-white/15 hover:bg-white/[0.1]"
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 ${state === "right" ? "bg-[#fa51a2] ring-[#fa51a2]" : "ring-white/40"}`}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1 font-medium">
                  {o.flag && <span className="mr-1.5">{o.flag}</span>}
                  {o.label}
                </span>
                {state === "right" && <Check size={20} className="mr-1 text-[#ffb3d6]" aria-hidden />}
              </button>
            );
          })}
        </div>
        <div className="relative mt-3 min-h-[3rem] text-center">
          {right && <Burst />}
          <AnimatePresence>
            {picked && (
              <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="text-sm text-white/80">
                <span className="font-semibold text-white">{right ? "You remembered! " : "Not quite: "}</span>
                {quiz.reveal}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      {picked && (
        <motion.button type="button" onClick={onNext} className="mx-auto mt-auto inline-flex items-center gap-2 rounded-full bg-[#ffe4f1] px-8 py-3.5 text-lg font-semibold text-[#2b0b2e]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
          Keep going <ArrowRight size={18} aria-hidden />
        </motion.button>
      )}
      <span className="sr-only">{w.year}</span>
    </div>
  );
}

// Where each print lands on the table, and how it's turned.
const PRINTS = [
  { x: -24, y: 0, r: -7, w: 50 },
  { x: 26, y: 4, r: 5, w: 48 },
  { x: -28, y: 31, r: 4, w: 40 },
  { x: 2, y: 29, r: -3, w: 34 },
  { x: 30, y: 33, r: 6, w: 40 },
  { x: -22, y: 61, r: -4, w: 46 },
  { x: 25, y: 62, r: 5, w: 44 },
];

function Memories({ w, photos, onChoose }: { w: WrappedYear; photos: WrappedPhoto[]; onChoose: () => void }) {
  const reduce = useReducedMotion();
  const shown = photos.slice(0, PRINTS.length);
  return (
    <div className={page}>
      <div className="relative">
        <Title>A year in memories</Title>
        <button
          type="button"
          data-own-taps
          onClick={onChoose}
          className="absolute -right-2 -top-10 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/20 hover:bg-white/15"
        >
          <ImagePlus size={13} aria-hidden /> Choose
        </button>
      </div>
      {/* Prints dropped on a table, one after another */}
      <div className="relative mx-auto mt-6 w-full max-w-sm flex-1">
        {shown.map((p, i) => {
          const at = PRINTS[i];
          return (
            <motion.div
              key={p.id}
              className="absolute bg-white p-[5px] pb-[18px] shadow-[0_16px_30px_-10px_rgba(0,0,0,0.75)]"
              style={{ left: `calc(50% + ${at.x}% - ${at.w / 2}%)`, top: `${at.y}%`, width: `${at.w}%`, zIndex: i }}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.6, rotate: at.r * 3, y: -40 }}
              animate={{ opacity: 1, scale: 1, rotate: at.r, y: 0 }}
              transition={{ type: "spring", stiffness: 160, damping: 17, delay: 0.5 + i * 0.45 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="aspect-[4/3] w-full object-cover" />
            </motion.div>
          );
        })}
      </div>
      <motion.p
        className="mt-2 text-center font-serif text-3xl italic text-white/90"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 + shown.length * 0.45, duration: 0.8 }}
      >
        Thank you, {w.year} <span className="not-italic text-[#ff8cc6]">♡</span>
      </motion.p>
    </div>
  );
}

function Hexagon({ badge, i }: { badge: Badge; i: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="flex flex-col items-center text-center"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.6 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.5 + i * 0.25 }}
    >
      <div className="relative h-[92px] w-[82px]">
        <svg viewBox="0 0 82 92" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <linearGradient id={`hex-${badge.key}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={badge.from} />
              <stop offset="1" stopColor={badge.to} />
            </linearGradient>
          </defs>
          <path d="M41 3 L77 23.5 L77 68.5 L41 89 L5 68.5 L5 23.5 Z" fill={`url(#hex-${badge.key})`} fillOpacity="0.28" stroke={`url(#hex-${badge.key})`} strokeWidth="3" strokeLinejoin="round" />
        </svg>
        <badge.icon size={34} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ color: badge.from }} aria-hidden />
      </div>
      <p className="mt-2 text-sm font-semibold">{badge.title}</p>
      <p className="text-xs text-white/60">{badge.note}</p>
    </motion.div>
  );
}

function Achievements({ w, badges }: { w: WrappedYear; badges: Badge[] }) {
  const line = w.newCountries.length
    ? `You explored ${w.newCountries.length} new ${w.newCountries.length === 1 ? "country" : "countries"} this year!`
    : w.events.length
      ? `${w.events.length} ${w.events.length === 1 ? "moment" : "moments"} worth remembering this year!`
      : `${w.countries.length} ${w.countries.length === 1 ? "country" : "countries"} this year!`;
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-x-0 bottom-0 h-[48%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PEAKS.url} alt="" className="h-full w-full object-cover" />
        <span className="absolute inset-0 bg-gradient-to-b from-[#120818] via-[#120818]/40 to-[#120818]/30" aria-hidden />
      </div>
      <div className={page}>
        <Title>
          Your
          <br />
          achievements
        </Title>
        <div className="mx-auto mt-8 flex w-full max-w-sm justify-center gap-5">
          {badges.map((b, i) => (
            <Hexagon key={b.key} badge={b} i={i} />
          ))}
        </div>
        <motion.div
          className="mx-auto mt-8 flex w-full max-w-sm items-center gap-4 rounded-[22px] bg-white/[0.08] px-5 py-4 ring-1 ring-white/12 backdrop-blur-md"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 + badges.length * 0.25, duration: 0.7, ease: EASE }}
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#fbbf24]/30 to-[#fa51a2]/30 text-2xl ring-1 ring-white/20" aria-hidden>
            👑
          </span>
          <p className="text-lg font-semibold leading-snug">
            {line} <span aria-hidden>👏</span>
          </p>
        </motion.div>
      </div>
      <Credit who={PEAKS.author} href={PEAKS.authorUrl} />
    </div>
  );
}

// The Story picture: made once per cover, ahead of time, so the finale shows it at once.
const storyFiles = new Map<string, Promise<File | null>>();
function storyUrl(w: WrappedYear, cover: string | null) {
  const hl = w.highlights.find((h) => h.id === cover);
  const photo = hl ? w.photos.find((p) => p.url === hl.photo)?.id ?? null : cover;
  return `/api/wrapped/poster?year=${w.year}${photo ? `&photo=${photo}` : ""}`;
}
function storyFile(url: string, year: number) {
  let p = storyFiles.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => (b ? new File([b], `expandiax-${year}-wrapped.png`, { type: "image/png" }) : null))
      .catch(() => null);
    p.then((f) => !f && storyFiles.delete(url));
    storyFiles.set(url, p);
  }
  return p;
}

function Finale({ w, cover, onChangeCover, onReplay }: { w: WrappedYear; cover: string | null; onChangeCover: () => void; onReplay: () => void }) {
  const url = storyUrl(w, cover);
  const [shown, setShown] = useState<{ url: string; src: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    setFailed(false);
    void storyFile(url, w.year).then((f) => {
      if (!alive) return;
      if (!f) return setFailed(true);
      made = URL.createObjectURL(f);
      setShown({ url, src: made });
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [url, w.year, attempt]);
  const ready = shown?.url === url;

  async function share() {
    setNote(null);
    setBusy(true);
    const f = await storyFile(url, w.year);
    setBusy(false);
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
    <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#3b1660_0%,#1a0b2c_55%,#120818_100%)]" data-own-taps>
      <div className={page}>
        <p className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-white/60">Your {w.year}, in one picture</p>
        <div className="relative mx-auto mt-4 aspect-[9/16] h-[min(58dvh,calc((100vw-3rem)*16/9))] overflow-hidden rounded-[1.4rem] bg-white/5 shadow-[0_30px_80px_-20px_rgba(250,81,162,0.55)] ring-1 ring-white/15">
          {shown && (
            // eslint-disable-next-line @next/next/no-img-element
            <motion.img key={shown.src} src={shown.src} alt={`My ${w.year} Wrapped`} className="h-full w-full object-cover" initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: ready ? 1 : 0.5, scale: 1 }} transition={{ duration: 0.45 }} />
          )}
          {!ready && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white/70">
              {failed ? (
                <button type="button" onClick={() => setAttempt((a) => a + 1)} className="rounded-full px-4 py-2 ring-1 ring-white/30">
                  Couldn&apos;t make it. Try again
                </button>
              ) : (
                <>
                  <Loader2 size={22} className="animate-spin" aria-hidden /> Making your picture…
                </>
              )}
            </div>
          )}
        </div>
        <div className="mx-auto mt-auto w-full max-w-sm pt-4">
          {note && <p className="mb-3 text-center text-sm text-white/80">{note}</p>}
          <button
            type="button"
            onClick={() => void share()}
            disabled={busy || failed}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#ffe4f1] py-4 text-lg font-semibold text-[#2b0b2e] shadow-[0_14px_40px_-12px_rgba(250,81,162,0.8)] disabled:opacity-70"
          >
            {busy ? <Loader2 size={19} className="animate-spin" aria-hidden /> : <InstagramGlyph />} Share to Instagram
          </button>
          <div className="mt-3 flex gap-3">
            {w.photos.length > 1 && (
              <button type="button" onClick={onChangeCover} className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-3.5 font-medium ring-1 ring-white/40 hover:bg-white/10">
                <ImagePlus size={16} aria-hidden /> Change photo
              </button>
            )}
            <Link href="/my-world" className="flex flex-1 items-center justify-center rounded-full py-3.5 font-medium ring-1 ring-white/40 hover:bg-white/10">
              Keep exploring
            </Link>
          </div>
          <button type="button" onClick={onReplay} className="mx-auto mt-3 block text-sm text-white/60 hover:text-white">
            Watch again
          </button>
        </div>
      </div>
    </div>
  );
}

function InstagramGlyph() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="17.4" cy="6.6" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Empty({ w }: { w: WrappedYear }) {
  return (
    <div className={page} data-own-taps>
      <div className="my-auto text-center">
        <p className="text-6xl" aria-hidden>
          🌍
        </p>
        <h2 className="mt-5 font-sans text-[2.1rem] font-bold leading-tight">
          Your {w.year} story is <span className="font-serif italic text-[#ff8cc6]">still being written.</span>
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-white/70">Add the places and the moments from this year, and your Wrapped will tell their story.</p>
      </div>
      <div className="mx-auto w-full max-w-sm space-y-3">
        <Link href="/my-world" className="flex w-full items-center justify-center rounded-full bg-[#ffe4f1] py-4 text-lg font-semibold text-[#2b0b2e]">
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
        className="flex max-h-[85dvh] w-full flex-col rounded-t-[28px] bg-[#1f0a25] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 ring-1 ring-white/10"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
      >
        <div className="flex items-center justify-between px-1">
          <p className="text-xl font-bold">{mode === "cover" ? "Your One to Remember" : "Photos in your Wrapped"}</p>
          <button
            type="button"
            onClick={() => onDone(mode === "cover" ? { cover: pick } : { hidden: [...off] })}
            className="rounded-full bg-[#ffe4f1] px-4 py-2 text-sm font-semibold text-[#2b0b2e]"
          >
            Done
          </button>
        </div>
        <p className="mt-1 px-1 text-xs text-white/55">{mode === "cover" ? "Tap one." : `Tap to leave one out (${Math.min(shown, MAX_PHOTOS)} in).`}</p>
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


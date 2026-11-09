"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bookmark, Camera, Pause, Play, Star } from "lucide-react";
import { cn } from "@/lib/utils";

// "How it works" for partners, as a short film made of the app's own
// screens: an example festival gets its page, its crowd keeps their
// memories there, it's featured where people plan, and the partner sees
// what it did. Plays by itself; tap a step to jump, or pause.

const STEPS = [
  { title: "Your event gets its home", body: "An official page for your festival, race or tour, with your name on it." },
  { title: "Your crowd keeps the memories", body: "People tap “I was there” and add their photos, videos and favourite moments." },
  { title: "Seen where people plan", body: "Featured on Explore for people nearby and everyone dreaming of going." },
  { title: "You see what it did", body: "A report after the event: views, saves, memories added. Counts, never people." },
];
const SCENE_MS = 4200;

const crowd = "radial-gradient(circle at 20% 30%, rgba(250,81,162,.85), transparent 28%), radial-gradient(circle at 75% 20%, rgba(251,120,34,.8), transparent 30%), radial-gradient(circle at 50% 80%, rgba(139,92,246,.7), transparent 40%), linear-gradient(160deg, #2a1236, #140d18)";

function EventScene() {
  return (
    <div className="flex h-full flex-col bg-canvas">
      <div className="relative h-[52%] shrink-0" style={{ background: crowd }}>
        {Array.from({ length: 14 }, (_, i) => (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-white"
            style={{ left: `${(i * 37) % 92 + 4}%`, top: `${(i * 53) % 70 + 20}%` }}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.6, repeat: Infinity, delay: (i % 5) * 0.3 }}
          />
        ))}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 font-mono text-[9px] font-bold tracking-[0.2em] text-[#140d18]">PARTNER</span>
        <div className="absolute inset-x-3 bottom-3 text-white">
          <p className="font-mono text-[9px] tracking-[0.25em] text-white/80">FESTIVAL · 9 TO 11 JULY 2027</p>
          <p className="mt-1 font-serif text-2xl leading-tight">Summer Lights Festival</p>
        </div>
      </div>
      <div className="flex-1 space-y-3 px-3 py-3">
        <p className="text-[11px] text-muted">Pärnu, Estonia · Beach stage</p>
        <motion.button
          type="button"
          tabIndex={-1}
          className="gradient-travel w-full rounded-full py-2.5 text-xs font-semibold text-white"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.6 }}
        >
          I was there
        </motion.button>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {["#8b5cf6", "#FB7822", "#FA51A2", "#0d9488"].map((c) => (
              <span key={c} className="h-6 w-6 rounded-full border-2 border-canvas" style={{ background: c }} />
            ))}
          </div>
          <p className="text-[11px] text-muted">2,184 were there</p>
        </div>
      </div>
    </div>
  );
}

function MemoriesScene() {
  const tiles = [
    { by: "M", note: "Front row", hue: "#FA51A2" },
    { by: "T", note: "Sunset set", hue: "#FB7822" },
    { by: "A", note: "Best night", hue: "#8b5cf6" },
    { by: "L", note: "Again 2028!", hue: "#0d9488" },
  ];
  return (
    <div className="flex h-full flex-col bg-canvas px-3 py-4">
      <p className="font-mono text-[9px] font-semibold tracking-[0.25em] text-muted">MEMORIES FROM</p>
      <p className="font-serif text-lg leading-tight">Summer Lights Festival</p>
      <div className="mt-3 grid flex-1 grid-cols-2 gap-2">
        {tiles.map((t, i) => (
          <motion.div
            key={t.by}
            initial={{ opacity: 0, scale: 0.6, rotate: i % 2 ? 6 : -6 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ delay: 0.25 + i * 0.35, type: "spring", stiffness: 260, damping: 18 }}
            className="relative overflow-hidden rounded-xl"
            style={{ background: `radial-gradient(circle at 30% 30%, ${t.hue}, #140d18 75%)` }}
          >
            <Camera size={14} className="absolute right-2 top-2 text-white/70" aria-hidden />
            <div className="absolute inset-x-2 bottom-2 flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/90 font-serif text-[10px] text-[#140d18]">{t.by}</span>
              <span className="text-[10px] font-medium text-white">{t.note}</span>
            </div>
          </motion.div>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-muted">1,930 memories added</p>
    </div>
  );
}

function ExploreScene() {
  return (
    <div className="flex h-full flex-col bg-[#140d18] px-3 py-4 text-[#fdf3e3]">
      <p className="font-mono text-[9px] font-semibold tracking-[0.3em] text-[#FB7822]">ON YOUR RADAR</p>
      <div className="mt-2 flex gap-1">
        {"PARNU".split("").map((ch, i) => (
          <motion.span
            key={i}
            initial={{ rotateX: 90 }}
            animate={{ rotateX: 0 }}
            transition={{ delay: 0.15 + i * 0.12 }}
            className="flex h-7 w-6 items-center justify-center rounded bg-white/10 font-mono text-sm font-bold"
          >
            {ch}
          </motion.span>
        ))}
        <span className="ml-1 self-center font-mono text-[10px] text-white/60">9 JUL</span>
      </div>
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8, type: "spring", stiffness: 200, damping: 20 }}
        className="mt-4 overflow-hidden rounded-2xl bg-[#fdf3e3] text-[#24192a]"
      >
        <div className="relative h-24" style={{ background: crowd }}>
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 font-mono text-[8px] font-bold tracking-[0.2em]">FEATURED · PARTNER</span>
        </div>
        <div className="px-3 py-2.5">
          <p className="font-serif text-base leading-tight">Summer Lights Festival</p>
          <p className="text-[10px] text-[#24192a]/60">For people who dream of Estonia</p>
          <motion.span
            className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#24192a] px-2.5 py-1 text-[10px] font-semibold text-white"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ delay: 1.8, duration: 0.5 }}
          >
            <Bookmark size={10} /> Saved
          </motion.span>
        </div>
      </motion.div>
      <div className="mt-4 space-y-2">
        {[
          ["Tallinn", "Old Town tour · 14 Jul"],
          ["Tartu", "River race · 2 Aug"],
        ].map(([city, what], i) => (
          <motion.div
            key={city}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 + i * 0.2 }}
            className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"
          >
            <span className="font-mono text-[10px] font-bold tracking-[0.15em] text-white/80">{city.toUpperCase()}</span>
            <span className="text-[10px] text-white/50">{what}</span>
          </motion.div>
        ))}
      </div>
      <p className="mt-auto text-center text-[10px] text-white/50">One clearly labelled placement per screen</p>
    </div>
  );
}

function ReportScene() {
  const rows = [
    ["Page views", "12,400"],
    ["Saved to dream lists", "860"],
    ["“I was there”", "2,184"],
    ["Memories added", "1,930"],
  ];
  return (
    <div className="flex h-full flex-col bg-canvas px-3 py-4">
      <p className="font-mono text-[9px] font-semibold tracking-[0.25em] text-muted">AFTER THE FESTIVAL</p>
      <p className="font-serif text-lg leading-tight">Your report</p>
      <div className="mt-3 space-y-2">
        {rows.map(([k, v], i) => (
          <motion.div
            key={k}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.25 }}
            className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2.5"
          >
            <span className="text-[11px] text-muted">{k}</span>
            <span className="font-serif text-lg tabular-nums">{v}</span>
          </motion.div>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-center gap-1 text-[10px] text-muted">
        <Star size={10} className="fill-accent text-accent" aria-hidden /> Example numbers
      </div>
    </div>
  );
}

const SCENES = [EventScene, MemoriesScene, ExploreScene, ReportScene];

export function PartnerFilm() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || reduce) return;
    const id = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), SCENE_MS);
    return () => clearTimeout(id);
  }, [step, playing, reduce]);

  const Scene = SCENES.at(step) ?? EventScene;

  return (
    <div className="grid items-center gap-8 md:grid-cols-[300px_1fr]">
      {/* The phone */}
      <div className="relative mx-auto" aria-hidden>
        <div className="absolute -inset-8 rounded-full bg-[radial-gradient(circle,rgba(250,81,162,.25),transparent_65%)] blur-2xl" />
        <div className="relative h-[560px] w-[272px] overflow-hidden rounded-[44px] border-[10px] border-[#140d18] bg-canvas shadow-2xl">
          <div className="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-[#140d18]" />
          <div className="h-full pt-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                className="h-full"
                initial={{ opacity: 0, x: reduce ? 0 : 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: reduce ? 0 : -40 }}
                transition={{ duration: 0.35 }}
              >
                <Scene />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        {/* Progress */}
        <div className="mt-4 flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span key={i} className="h-1 w-10 overflow-hidden rounded-full bg-line">
              {i === step ? (
                <motion.span
                  key={`${step}-${playing}`}
                  className="block h-full bg-accent"
                  initial={{ width: playing && !reduce ? "0%" : "100%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: playing && !reduce ? SCENE_MS / 1000 : 0, ease: "linear" }}
                />
              ) : (
                <span className={cn("block h-full", i < step ? "bg-accent/60" : "")} />
              )}
            </span>
          ))}
        </div>
      </div>

      {/* The steps */}
      <div>
        <ol className="space-y-2">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "flex w-full gap-4 rounded-2xl px-4 py-3 text-left transition-colors",
                  i === step ? "bg-surface shadow-sm ring-1 ring-line" : "hover:bg-surface/60"
                )}
              >
                <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold", i === step ? "gradient-travel text-white" : "bg-raised text-muted")}>
                  {i + 1}
                </span>
                <span>
                  <span className={cn("block font-serif text-lg leading-snug", i !== step && "text-muted")}>{s.title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-muted">{s.body}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        {!reduce && (
          <button type="button" onClick={() => setPlaying((p) => !p)} className="mt-3 inline-flex items-center gap-1.5 px-4 text-xs text-muted hover:text-ink">
            {playing ? <Pause size={12} /> : <Play size={12} />} {playing ? "Pause" : "Play"}
          </button>
        )}
      </div>
    </div>
  );
}

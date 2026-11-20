"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ImageOff, Lock, Sparkles } from "lucide-react";
import { askPhotoAccess, chooseMorePhotos, openAppSettings, photoAccess, scanPhotos, type PhotoAccess } from "@/lib/photoScan";
import { findWorld, type FoundWorld, type ScanPlace } from "@/lib/tripFinder";
import { loadShapes, makeLocator } from "@/lib/countryLocator";
import { findEvents, nameTrips, type FoundEvent, type TripTown } from "@/lib/worldStory";
import type { KeptWorld } from "@/lib/worldScan";
import { noteFeature } from "@/lib/usageClient";
import { tapLight } from "@/lib/haptics";
import { ScanAwakening } from "./ScanAwakening";
import { ScanReveal } from "./ScanReveal";
import { StoryView } from "./StoryView";
import { ScanFinish } from "./ScanFinish";

type Phase = "invite" | "denied" | "scanning" | "awakening" | "reveal" | "story" | "finish" | "empty";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * "Find my world": the trips and events hiding in someone's photos, found
 * on their phone and turned into their world.
 *
 *   invite → (iOS asks) → scanning → awakening → reveal → story → finish
 *
 * Nothing to go through one by one: trips are worked out (named by their
 * towns, joined into journeys), concerts and matches are recognised, and
 * the story is already kept; anything wrong is one tap away. New people do
 * it before they have an account (it waits on the phone until they sign
 * up); members save it straight away.
 */
export function WorldScanFlow({
  mode,
  homeCode: knownHome = null,
  onManual,
  onKeep,
}: {
  mode: "new" | "member";
  /** A member's home from their profile; new people's is guessed. */
  homeCode?: string | null;
  /** "Add it myself". */
  onManual: () => void;
  /** What they kept, at the end. */
  onKeep: (world: KeptWorld) => Promise<void> | void;
}) {
  const [phase, setPhase] = useState<Phase>("invite");
  const [access, setAccess] = useState<PhotoAccess | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, located: 0 });
  const [places, setPlaces] = useState<ScanPlace[] | null>(null);
  const [home, setHome] = useState<string | null>(knownHome);
  const [towns, setTowns] = useState<Record<string, TripTown[]>>({});
  const [events, setEvents] = useState<FoundEvent[] | null>(null);
  const [kept, setKept] = useState<KeptWorld | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const locator = useRef<((lat: number, lng: number) => string | null) | null>(null);
  const eventsDone = useRef<Promise<FoundEvent[]> | null>(null);

  // The world's outlines load while the first screen is up.
  useEffect(() => {
    void loadShapes()
      .then((s) => (locator.current = makeLocator(s)))
      .catch(() => {});
    void photoAccess()
      .then(setAccess)
      .catch(() => {});
  }, []);

  const world: FoundWorld | null = useMemo(() => {
    if (!places || !locator.current) return null;
    return findWorld(places, locator.current, home);
  }, [places, home]);

  // While the globe wakes up: each trip's towns, and which moments were events.
  useEffect(() => {
    if (!world) return;
    let alive = true;
    void nameTrips(world.trips).then((t) => alive && setTowns(t));
    return () => {
      alive = false;
    };
  }, [world]);

  async function start() {
    tapLight();
    setError(null);
    noteFeature("world_scan_started");
    let status = access;
    try {
      if (status !== "full" && status !== "limited") status = await askPhotoAccess();
    } catch {
      status = "denied";
    }
    setAccess(status);
    if (status !== "full" && status !== "limited") {
      setPhase("denied");
      return;
    }
    setPhase("scanning");
    try {
      const [result] = await Promise.all([
        scanPhotos(setProgress),
        loadShapes().then((s) => (locator.current ??= makeLocator(s))),
        // Long enough to feel the search, even on a small library.
        new Promise((r) => setTimeout(r, 1800)),
      ]);
      const locate = locator.current!;
      const found = (eventsDone.current = result.moments?.length ? findEvents(result.moments, locate).catch(() => []) : Promise.resolve([]));
      void found.then(setEvents);
      setPlaces(result.places);
      setPhase("awakening");
    } catch {
      setError("Something got in the way. Try again?");
      setPhase("invite");
    }
  }

  // After the awakening: nothing at all found means a kind way out, not an empty reveal.
  async function afterAwakening() {
    if (world && world.trips.length > 0) {
      setPhase("reveal");
      return;
    }
    const late = await Promise.race([eventsDone.current ?? Promise.resolve([]), new Promise<FoundEvent[]>((r) => setTimeout(() => r([]), 8000))]);
    setPhase(late.length ? "reveal" : "empty");
  }

  async function finish(world: KeptWorld) {
    setKept(world);
    setPhase("finish");
    noteFeature("world_scan_finished");
    setSaving(true);
    try {
      await onKeep(world);
    } finally {
      setSaving(false);
    }
  }

  let scene: React.ReactNode = null;
  switch (phase) {
    case "invite":
      scene = <Invite mode={mode} error={error} onStart={start} onManual={onManual} />;
      break;
    case "denied":
      scene = <Denied restricted={access === "restricted"} onManual={onManual} onRetry={start} />;
      break;
    case "scanning":
    case "awakening":
      scene = (
        <ScanAwakening
          scanning={phase === "scanning"}
          progress={progress}
          world={phase === "awakening" ? world : null}
          events={events}
          onDone={() => void afterAwakening()}
        />
      );
      break;
    case "reveal":
      if (world)
        scene = (
          <ScanReveal
            world={world}
            events={events}
            canChangeHome={mode === "new" || !knownHome}
            onChangeHome={(code) => setHome(code)}
            onNext={() => setPhase("story")}
          />
        );
      break;
    case "story":
      if (world)
        scene = (
          <StoryView
            mode={mode}
            world={world}
            towns={towns}
            events={events}
            onSave={(k) => void finish(k)}
          />
        );
      break;
    case "finish":
      if (kept) scene = <ScanFinish mode={mode} kept={kept} limited={access === "limited"} saving={saving} />;
      break;
    case "empty":
      scene = (
        <Empty
          limited={access === "limited"}
          onChooseMore={async () => {
            await chooseMorePhotos().catch(() => {});
            void start();
          }}
          onManual={onManual}
        />
      );
      break;
  }

  return (
    // Full screen, over the app's header and tab bar: nothing else on the way.
    <div className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_50%_25%,#5a1758_0%,#2b0b2e_55%,#14051a_100%)] text-white">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={phase === "scanning" ? "awakening" : phase}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } }}
          exit={{ opacity: 0, y: -14, transition: { duration: 0.3, ease: "easeIn" } }}
        >
          {scene}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const shell = "mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(3rem+env(safe-area-inset-top))]";

/** One picture, one line, one button. */
function Invite({ mode, error, onStart, onManual }: { mode: "new" | "member"; error: string | null; onStart: () => void; onManual: () => void }) {
  return (
    <div className={shell}>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <PhotoConstellation />
        <motion.h1
          className="mt-10 font-serif text-[2.75rem] leading-[1.05]"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7, ease: EASE }}
        >
          {mode === "new" ? (
            <>
              Find my <span className="italic text-[#ff8cc6]">world</span>
            </>
          ) : (
            <>
              Find <span className="italic text-[#ff8cc6]">more</span>
            </>
          )}
        </motion.h1>
        <motion.p
          className="mt-3 text-lg text-white/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.7 }}
        >
          Trips and concerts, found in your photos.
        </motion.p>
        {error && <p className="mt-4 text-sm text-[#ffb3b3]">{error}</p>}
      </div>

      <motion.div className="pt-8 text-center" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85, duration: 0.6 }}>
        <button type="button" onClick={onStart} className="btn-accent w-full py-4 text-lg">
          <Sparkles size={20} aria-hidden /> Let&apos;s go
        </button>
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-white/55">
          <Lock size={12} aria-hidden /> Your photos stay on your phone
        </p>
        <div>
          <button type="button" onClick={onManual} className="mt-3 text-sm text-white/50 hover:text-white">
            {mode === "new" ? "Add it myself" : "Not now"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/** Photos drifting into a glowing globe: what's about to happen, in a picture. */
function PhotoConstellation() {
  const tiles = [
    { x: -118, y: -40, r: -12, c: "linear-gradient(135deg,#fb7822,#fa51a2)", d: 0 },
    { x: 112, y: -62, r: 10, c: "linear-gradient(135deg,#16b3a6,#2d9cff)", d: 0.35 },
    { x: -96, y: 74, r: 8, c: "linear-gradient(135deg,#ffd166,#fb7822)", d: 0.7 },
    { x: 104, y: 66, r: -9, c: "linear-gradient(135deg,#7c5cff,#fa51a2)", d: 1.05 },
    { x: 4, y: -112, r: 4, c: "linear-gradient(135deg,#fa51a2,#7c5cff)", d: 1.4 },
  ];
  return (
    <div aria-hidden className="relative flex h-64 w-72 items-center justify-center">
      <motion.div
        className="absolute h-40 w-40 rounded-full bg-[#fa51a2] blur-3xl"
        animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.9, 1.15, 0.9] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="relative h-32 w-32 overflow-hidden rounded-full bg-[radial-gradient(circle_at_35%_30%,#3b6fb0_0%,#1d3b6b_55%,#0e1d3a_100%)] shadow-[0_0_60px_rgba(250,81,162,0.5)] ring-1 ring-white/25"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 14 }}
      >
        <motion.div className="absolute inset-0" animate={{ x: [0, -40, 0] }} transition={{ duration: 18, repeat: Infinity, ease: "linear" }}>
          <span className="absolute left-[24%] top-[26%] h-4 w-6 rounded-sm bg-[#fb7822]" />
          <span className="absolute left-[56%] top-[44%] h-6 w-4 rounded-sm bg-[#fb7822]" />
          <span className="absolute left-[36%] top-[62%] h-3 w-5 rounded-sm bg-[#fa51a2]" />
          <span className="absolute left-[78%] top-[30%] h-3 w-4 rounded-sm bg-[#fb7822]" />
        </motion.div>
      </motion.div>
      {tiles.map((t, i) => (
        <motion.span
          key={i}
          className="absolute h-14 w-12 rounded-md border-[3px] border-white shadow-xl"
          style={{ background: t.c }}
          initial={{ x: t.x * 1.6, y: t.y * 1.6, rotate: t.r * 2, opacity: 0 }}
          animate={{ x: [t.x, t.x * 0.9, t.x], y: [t.y, t.y - 10, t.y], rotate: t.r, opacity: 1 }}
          transition={{
            x: { duration: 3.6, delay: t.d, repeat: Infinity, ease: "easeInOut" },
            y: { duration: 3.6, delay: t.d, repeat: Infinity, ease: "easeInOut" },
            rotate: { duration: 0.8, delay: t.d * 0.4 },
            opacity: { duration: 0.6, delay: t.d * 0.4 },
          }}
        />
      ))}
    </div>
  );
}

function Denied({ restricted, onManual, onRetry }: { restricted: boolean; onManual: () => void; onRetry: () => void }) {
  // Coming back from Settings with access: carry on by themselves.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void photoAccess()
        .then((s) => {
          if (s === "full" || s === "limited") onRetry();
        })
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [onRetry]);

  return (
    <div className={shell}>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <ImageOff size={44} className="text-[#ffb3d6]" aria-hidden />
        <h1 className="mt-5 font-serif text-4xl">No problem.</h1>
        <p className="mt-2 text-base text-white/65">{restricted ? "Photos are off on this phone." : "Your photos stay closed."}</p>
      </div>
      <div className="pt-8 text-center">
        <button type="button" onClick={onManual} className="btn-accent w-full py-4 text-lg">
          Add it myself
        </button>
        {!restricted && (
          <button type="button" onClick={() => void openAppSettings()} className="mt-4 text-sm text-white/55 hover:text-white">
            Allow in Settings
          </button>
        )}
      </div>
    </div>
  );
}

function Empty({ limited, onChooseMore, onManual }: { limited: boolean; onChooseMore: () => void; onManual: () => void }) {
  return (
    <div className={shell}>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-6xl" aria-hidden>
          🧭
        </p>
        <h1 className="mt-5 font-serif text-4xl leading-tight">Your trips are hiding well.</h1>
        <p className="mt-2 text-base text-white/65">{limited ? "Share a few trip photos and we'll look again." : "No photos abroad with a place saved."}</p>
      </div>
      <div className="pt-8 text-center">
        {limited && (
          <button type="button" onClick={onChooseMore} className="btn-accent mb-4 w-full py-4 text-lg">
            Choose photos
          </button>
        )}
        <button type="button" onClick={onManual} className={limited ? "text-sm text-white/60 hover:text-white" : "btn-accent w-full py-4 text-lg"}>
          Add it myself
        </button>
      </div>
    </div>
  );
}

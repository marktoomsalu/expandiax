"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ImageOff, Lock, Settings, Sparkles } from "lucide-react";
import { askPhotoAccess, chooseMorePhotos, openAppSettings, photoAccess, scanPhotos, type PhotoAccess } from "@/lib/photoScan";
import { findWorld, type FoundWorld, type ScanPlace } from "@/lib/tripFinder";
import { loadShapes, makeLocator } from "@/lib/countryLocator";
import type { KeptTrip, KeptWorld } from "@/lib/worldScan";
import { noteFeature } from "@/lib/usageClient";
import { tapLight } from "@/lib/haptics";
import { ScanAwakening } from "./ScanAwakening";
import { ScanReveal } from "./ScanReveal";
import { TripSwiper } from "./TripSwiper";
import { ScanFinish } from "./ScanFinish";

type Phase = "invite" | "denied" | "scanning" | "awakening" | "reveal" | "swipe" | "finish" | "empty";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * "Find my world": the trips hiding in someone's photos, found on their
 * phone and turned into their world, one country lighting up at a time.
 *
 *   invite → (iOS asks) → scanning → awakening → reveal → keep or skip → finish
 *
 * New people (mode "new") do it before they have an account: what they keep
 * waits on the phone until they sign up. Members save it straight away.
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
  /** "I'd rather add them myself". */
  onManual: () => void;
  /** What they kept, at the end. */
  onKeep: (world: KeptWorld) => Promise<void> | void;
}) {
  const [phase, setPhase] = useState<Phase>("invite");
  const [access, setAccess] = useState<PhotoAccess | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, located: 0 });
  const [places, setPlaces] = useState<ScanPlace[] | null>(null);
  const [home, setHome] = useState<string | null>(knownHome);
  const [kept, setKept] = useState<KeptTrip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const locator = useRef<((lat: number, lng: number) => string | null) | null>(null);

  // The world's outlines load while they read the first screen.
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
      setPlaces(result.places);
      setPhase("awakening");
    } catch {
      setError("Something got in the way while looking through your photos. Try again?");
      setPhase("invite");
    }
  }

  // After the awakening, nothing found means a kind way out, not an empty reveal.
  function afterAwakening() {
    if (!world || world.trips.length === 0) setPhase("empty");
    else setPhase("reveal");
  }

  async function finish(keptTrips: KeptTrip[]) {
    setKept(keptTrips);
    setPhase("finish");
    noteFeature("world_scan_finished");
    setSaving(true);
    try {
      await onKeep({ homeCode: home ?? world?.homeCode ?? null, trips: keptTrips });
    } finally {
      setSaving(false);
    }
  }

  let scene: React.ReactNode = null;
  switch (phase) {
    case "invite":
      scene = <Invite mode={mode} limited={access === "limited"} error={error} onStart={start} onManual={onManual} />;
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
          onDone={afterAwakening}
        />
      );
      break;
    case "reveal":
      if (world)
        scene = (
          <ScanReveal
            world={world}
            canChangeHome={mode === "new" || !knownHome}
            onChangeHome={(code) => setHome(code)}
            onChoose={() => setPhase("swipe")}
            onKeepAll={() =>
              void finish(world.trips.map((t) => ({ code: t.code, from: t.from, to: t.to, kind: t.kind, covers: t.covers })))
            }
          />
        );
      break;
    case "swipe":
      if (world) scene = <TripSwiper trips={world.trips} homeCode={world.homeCode} onDone={(k) => void finish(k)} />;
      break;
    case "finish":
      scene = <ScanFinish mode={mode} homeCode={home ?? world?.homeCode ?? null} kept={kept} limited={access === "limited"} saving={saving} />;
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

const shell = "mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(4.5rem+env(safe-area-inset-top))]";

function Invite({ mode, limited, error, onStart, onManual }: { mode: "new" | "member"; limited: boolean; error: string | null; onStart: () => void; onManual: () => void }) {
  return (
    <div className={shell}>
      <div className="flex flex-1 flex-col justify-center text-center">
        <PhotoConstellation />
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[#ffb3d6]">{mode === "new" ? "Find my world" : "Find trips in my photos"}</p>
        <h1 className="mt-3 font-serif text-[2.1rem] leading-[1.12]">
          Your phone remembers
          <br />
          <span className="italic text-[#ff8cc6]">more than you do.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xs text-base text-white/75">
          {mode === "new"
            ? "Let's find the countries and trips hiding in your photos, and light up your world in seconds."
            : "Let's find the trips in your photos that aren't on your map yet."}
        </p>

        <div className="mx-auto mt-7 flex max-w-sm items-start gap-3 rounded-2xl bg-white/[0.07] px-4 py-3.5 text-left ring-1 ring-white/10">
          <Lock size={18} className="mt-0.5 shrink-0 text-[#ffb3d6]" aria-hidden />
          <p className="text-sm leading-relaxed text-white/80">
            Only <span className="font-semibold text-white">when and where</span> each photo was taken is read, here on your phone. Nothing is uploaded unless you keep it.
          </p>
        </div>
        {error && <p className="mt-4 text-sm text-[#ffb3b3]">{error}</p>}
      </div>

      <div className="pt-8 text-center">
        <button type="button" onClick={onStart} className="btn-accent w-full py-4 text-base">
          <Sparkles size={18} aria-hidden /> {limited ? "Look through my shared photos" : "Find my world"}
        </button>
        <button type="button" onClick={onManual} className="mt-4 text-sm text-white/60 hover:text-white">
          {mode === "new" ? "I'd rather add them myself" : "Not now"}
        </button>
      </div>
    </div>
  );
}

/** Little photos drifting around a glowing globe: what's about to happen, in a picture. */
function PhotoConstellation() {
  const tiles = [
    { x: -96, y: -28, r: -12, c: "linear-gradient(135deg,#fb7822,#fa51a2)", d: 0 },
    { x: 92, y: -46, r: 10, c: "linear-gradient(135deg,#16b3a6,#2d9cff)", d: 0.4 },
    { x: -70, y: 58, r: 8, c: "linear-gradient(135deg,#ffd166,#fb7822)", d: 0.8 },
    { x: 84, y: 50, r: -9, c: "linear-gradient(135deg,#7c5cff,#fa51a2)", d: 1.2 },
  ];
  return (
    <div aria-hidden className="relative mx-auto flex h-44 w-64 items-center justify-center">
      <motion.div
        className="absolute h-28 w-28 rounded-full bg-[#fa51a2] blur-3xl"
        animate={{ opacity: [0.35, 0.6, 0.35], scale: [0.9, 1.1, 0.9] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="relative h-24 w-24 rounded-full bg-[radial-gradient(circle_at_35%_30%,#3b6fb0_0%,#1d3b6b_55%,#0e1d3a_100%)] shadow-[0_0_40px_rgba(250,81,162,0.45)] ring-1 ring-white/20"
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      >
        <span className="absolute left-[30%] top-[28%] h-3 w-4 rounded-sm bg-[#fb7822]" />
        <span className="absolute left-[55%] top-[45%] h-4 w-3 rounded-sm bg-[#fb7822]" />
        <span className="absolute left-[38%] top-[60%] h-2.5 w-3 rounded-sm bg-[#fa51a2]" />
      </motion.div>
      {tiles.map((t, i) => (
        <motion.span
          key={i}
          className="absolute h-12 w-10 rounded-md border-[3px] border-white shadow-lg"
          style={{ background: t.c }}
          initial={{ x: t.x, y: t.y, rotate: t.r, opacity: 0 }}
          animate={{ x: [t.x, t.x * 0.92, t.x], y: [t.y, t.y - 8, t.y], opacity: 1 }}
          transition={{ duration: 3.4, delay: t.d, repeat: Infinity, ease: "easeInOut", opacity: { duration: 0.6, delay: t.d } }}
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
      <div className="flex flex-1 flex-col justify-center text-center">
        <ImageOff size={40} className="mx-auto text-[#ffb3d6]" aria-hidden />
        <h1 className="mt-5 font-serif text-3xl leading-tight">No problem.</h1>
        <p className="mx-auto mt-3 max-w-xs text-base text-white/75">
          {restricted
            ? "Photo access is turned off on this phone, so your world is yours to build by hand. It only takes a minute."
            : "Your photos stay closed. If you change your mind, allow Photos for ExpandiaX in Settings and come back here."}
        </p>
      </div>
      <div className="pt-8 text-center">
        <button type="button" onClick={onManual} className="btn-accent w-full py-4 text-base">
          Add my countries myself
        </button>
        {!restricted && (
          <button type="button" onClick={() => void openAppSettings()} className="mt-4 inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white">
            <Settings size={14} aria-hidden /> Open Settings
          </button>
        )}
      </div>
    </div>
  );
}

function Empty({ limited, onChooseMore, onManual }: { limited: boolean; onChooseMore: () => void; onManual: () => void }) {
  return (
    <div className={shell}>
      <div className="flex flex-1 flex-col justify-center text-center">
        <p className="font-serif text-5xl" aria-hidden>
          🧭
        </p>
        <h1 className="mt-5 font-serif text-3xl leading-tight">Your trips are hiding well.</h1>
        <p className="mx-auto mt-3 max-w-xs text-base text-white/75">
          {limited
            ? "ExpandiaX can only see the photos you chose. Share a few from your trips and we'll look again."
            : "We couldn't find photos taken abroad with their place saved. Your world can still be lit up by hand, in a minute."}
        </p>
      </div>
      <div className="pt-8 text-center">
        {limited && (
          <button type="button" onClick={onChooseMore} className="btn-accent mb-4 w-full py-4 text-base">
            Choose more photos
          </button>
        )}
        <button type="button" onClick={onManual} className={limited ? "text-sm text-white/70 hover:text-white" : "btn-accent w-full py-4 text-base"}>
          Add my countries myself
        </button>
      </div>
    </div>
  );
}

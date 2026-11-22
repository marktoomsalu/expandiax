"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Globe2, Settings } from "lucide-react";
import { askPhotoAccess, chooseMorePhotos, openAppSettings, photoAccess, scanPhotos, type PhotoAccess } from "@/lib/photoScan";
import { findWorld, type FoundWorld, type ScanPlace } from "@/lib/tripFinder";
import { loadShapes, makeLocator } from "@/lib/countryLocator";
import { findEvents, nameTrips, type BigDay, type FoundEvent, type TripTown } from "@/lib/worldStory";
import type { KeptEvent, KeptWorld } from "@/lib/worldScan";
import { noteFeature } from "@/lib/usageClient";
import { tapLight } from "@/lib/haptics";
import { ScanAwakening } from "./ScanAwakening";
import { ScanReveal } from "./ScanReveal";
import { CountriesWall, type CountryPick } from "./CountriesWall";
import { MemoriesView } from "./MemoriesView";
import { ScanFinish } from "./ScanFinish";
import { InviteHero } from "./InviteHero";
import { PhotoPrimer } from "./PhotoPrimer";

type Phase = "invite" | "explain" | "denied" | "scanning" | "awakening" | "reveal" | "countries" | "memories" | "finish" | "empty";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * "Find my world": the trips and events hiding in someone's photos, found
 * on their phone and turned into their world.
 *
 *   invite → (iOS asks) → scanning → awakening → reveal → countries → memories → finish
 *
 * Nothing to go through one by one: the countries are already kept (the
 * doubtful ones wait, off), anything wrong is a tap away and anything
 * missing a search away. Concerts and matches are recognised; big days with
 * nothing listed are one tap from being named. Trips (with their towns) are
 * saved quietly behind each country. New people do it before they have an
 * account (it waits on the phone until they sign up); members save it
 * straight away.
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
  const [bigDays, setBigDays] = useState<BigDay[]>([]);
  const [hasMoments, setHasMoments] = useState(false);
  const [pick, setPick] = useState<CountryPick | null>(null);
  const [kept, setKept] = useState<KeptWorld | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const locator = useRef<((lat: number, lng: number) => string | null) | null>(null);
  const eventsDone = useRef<Promise<{ events: FoundEvent[]; bigDays: BigDay[] }> | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // The photos burst out of the globe only on the way in, not when coming back to the first screen.
  const firstInvite = useRef(true);
  useEffect(() => {
    if (phase !== "invite") firstInvite.current = false;
  }, [phase]);

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

  /**
   * "Discover my world": first, in plain words, what happens with their
   * photos (only if iPhone hasn't asked them yet); already answered yes, it
   * starts; answered no before, iPhone won't ask again, so the way to
   * Settings, or by hand.
   */
  function discover() {
    tapLight();
    if (access === "full" || access === "limited") return void start();
    if (access === "denied" || access === "restricted") return setPhase("denied");
    setPhase("explain");
  }

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
      const none = { events: [] as FoundEvent[], bigDays: [] as BigDay[] };
      const found = (eventsDone.current = result.moments?.length ? findEvents(result.moments, locate).catch(() => none) : Promise.resolve(none));
      setHasMoments(!!result.moments?.length);
      void found.then((f) => {
        setEvents(f.events);
        setBigDays(f.bigDays);
      });
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
    const late = await Promise.race([
      eventsDone.current ?? Promise.resolve({ events: [], bigDays: [] }),
      new Promise<{ events: FoundEvent[]; bigDays: BigDay[] }>((r) => setTimeout(() => r({ events: [], bigDays: [] }), 8000)),
    ]);
    setPhase(late.events.length || late.bigDays.length ? "reveal" : "empty");
  }

  // Everything kept: the countries (with each one's trips and towns behind them) and the memories.
  function keptWorld(p: CountryPick, memories: KeptEvent[]): KeptWorld {
    const codes = new Set(p.codes);
    return {
      homeCode: home ?? world?.homeCode ?? null,
      trips: (world?.trips ?? [])
        .filter((t) => codes.has(t.code))
        .map((t) => ({
          code: t.code,
          from: t.from,
          to: t.to,
          kind: t.kind,
          covers: t.covers,
          towns: (towns[t.id] ?? []).map((x) => ({ name: x.name, lat: x.lat, lng: x.lng, arrived: x.arrived, departed: x.departed })),
        })),
      countries: p.added,
      events: memories,
    };
  }

  const saveLabel = mode === "new" ? "Save my world" : "Add to my world";
  // Memories only when the phone can find them (build 13 on), and there's something (or still something coming).
  const memoriesNext = hasMoments && (events === null || events.length > 0 || bigDays.length > 0);

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
      scene = <InviteHero mode={mode} error={error} onStart={discover} onManual={onManual} burst={mode === "new" && firstInvite.current} />;
      break;
    case "explain":
      scene = <PhotoPrimer onContinue={() => void start()} onBack={() => setPhase("invite")} />;
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
            onNext={() => setPhase("countries")}
            limited={access === "limited"}
            onMore={async () => {
              await chooseMorePhotos().catch(() => {});
              void start();
            }}
          />
        );
      break;
    case "countries":
      if (world)
        scene = (
          <CountriesWall
            world={world}
            next={memoriesNext ? "Next: my memories" : saveLabel}
            onNext={(p) => {
              setPick(p);
              if (memoriesNext) setPhase("memories");
              else void finish(keptWorld(p, []));
            }}
          />
        );
      break;
    case "memories":
      if (pick) scene = <MemoriesView events={events} bigDays={bigDays} saveLabel={saveLabel} onSave={(m) => void finish(keptWorld(pick, m))} />;
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

  // The scrolling screens have a button bar fixed to the bottom of the screen
  // and a header that sticks to the top: sliding them in (a transform) would
  // pin that bar to the sliding page instead, out of sight until the slide
  // ends and it jumps into place. They fade in where they stand.
  const scrolls = phase === "countries" || phase === "memories";

  return (
    // Full screen, over the app's header and tab bar: nothing else on the way.
    <div ref={scroller} className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_50%_25%,#5a1758_0%,#2b0b2e_55%,#14051a_100%)] text-white">
      <AnimatePresence
        mode="wait"
        initial={false}
        // Each screen starts at its top, not where the last one was scrolled to.
        onExitComplete={() => scroller.current?.scrollTo({ top: 0 })}
      >
        <motion.div
          key={phase === "scanning" ? "awakening" : phase}
          initial={scrolls ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: { duration: scrolls ? 0.35 : 0.5, ease: EASE } }}
          exit={{ opacity: 0, transition: { duration: 0.18, ease: "easeIn" } }}
        >
          {scene}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const shell = "mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(3rem+env(safe-area-inset-top))]";

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
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-[#ffb3d6]">
          <Globe2 size={38} aria-hidden />
        </span>
        <h1 className="mt-6 font-serif text-4xl">No problem.</h1>
        <p className="mt-3 max-w-xs text-base leading-relaxed text-white/70">
          {restricted
            ? "Photos are switched off on this phone. Add your countries and memories yourself: your world adds up just the same."
            : "Your photos stay private. Add your countries and memories yourself: your world adds up just the same."}
        </p>
      </div>
      <div className="space-y-3 pt-8 text-center">
        <button type="button" onClick={onManual} className="btn-accent w-full py-4 text-lg">
          Add it myself
        </button>
        {!restricted && (
          <>
            <button
              type="button"
              onClick={() => void openAppSettings()}
              className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-base font-medium text-white ring-1 ring-white/30 hover:bg-white/10"
            >
              <Settings size={17} aria-hidden /> Allow photos in Settings
            </button>
            <p className="text-xs text-white/50">Changed your mind? It carries on by itself when you come back.</p>
          </>
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

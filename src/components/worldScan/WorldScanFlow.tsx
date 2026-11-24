"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Globe2, MapPinOff, RotateCcw, Settings } from "lucide-react";
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

type Phase = "invite" | "denied" | "scanning" | "awakening" | "reveal" | "countries" | "memories" | "finish" | "empty" | "error";

/** Why nothing was found: no photos to read, photos without a place saved, or only photos from home. */
type EmptyReason = "no-photos" | "no-places" | "home-only";

/** No word from the phone for this long while reading photos: something's stuck. */
const STALL_MS = 60_000;

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
  // How many photos there were, and how many had a place saved: why nothing was found, or that some trips may be missing.
  const [stats, setStats] = useState<{ total: number; located: number } | null>(null);
  const [failures, setFailures] = useState(0);
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
   * "Discover my world": not asked yet, iPhone asks now (the first screen
   * has already said what's read and where); already answered yes, it
   * starts; answered no before, iPhone won't ask again, so the way to
   * Settings, or by hand.
   */
  function discover() {
    if (access === "denied" || access === "restricted") {
      tapLight();
      return setPhase("denied");
    }
    void start();
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
    // A scan that stops answering ends in the error screen, never a spinner forever.
    let heard = Date.now();
    let watch: ReturnType<typeof setInterval> | undefined;
    const stalled = new Promise<never>((_, reject) => {
      watch = setInterval(() => {
        if (Date.now() - heard > STALL_MS) reject(new Error("stalled"));
      }, 5000);
    });
    try {
      const [result] = await Promise.race([
        Promise.all([
          scanPhotos((p) => {
            heard = Date.now();
            setProgress(p);
          }),
          loadShapes().then((s) => (locator.current ??= makeLocator(s))),
          // Long enough to feel the search, even on a small library.
          new Promise((r) => setTimeout(r, 1800)),
        ]),
        stalled,
      ]);
      clearInterval(watch);
      setStats({ total: result.total, located: result.located });
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
      clearInterval(watch);
      setFailures((n) => n + 1);
      setPhase("error");
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

  const emptyReason: EmptyReason = !stats || stats.total === 0 ? "no-photos" : stats.located === 0 || stats.located / stats.total < 0.02 ? "no-places" : "home-only";
  // Many photos without a place saved: some trips may be missing, and they can be added by hand.
  const missingShare = stats && stats.total >= 30 && stats.located / stats.total < 0.6 ? Math.round((1 - stats.located / stats.total) * 100) : 0;

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
            missingShare={missingShare}
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
          reason={emptyReason}
          limited={access === "limited"}
          onChooseMore={async () => {
            await chooseMorePhotos().catch(() => {});
            void start();
          }}
          onManual={onManual}
        />
      );
      break;
    case "error":
      scene = <ScanError failures={failures} onRetry={() => void start()} onManual={onManual} />;
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

export function Denied({ restricted, onManual, onRetry }: { restricted: boolean; onManual: () => void; onRetry: () => void }) {
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
            ? "Photos are switched off on this phone. Add your countries and memories yourself: it takes a minute, and your world adds up just the same."
            : "Your photos stay private. Add your countries and memories yourself: it takes a minute, and your world adds up just the same."}
        </p>
      </div>
      <div className="space-y-3 pt-8 text-center">
        <button type="button" onClick={onManual} className="btn-accent w-full py-4 text-lg">
          Add my countries myself
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
            <p className="text-xs text-white/50">Allow it there and this carries on by itself when you come back. Or any time later: tap + and choose From my photos.</p>
          </>
        )}
      </div>
    </div>
  );
}

/** Nothing found, and why, with the way on that fits: more photos, or adding it themselves. */
export function Empty({ reason, limited, onChooseMore, onManual }: { reason: EmptyReason; limited: boolean; onChooseMore: () => void; onManual: () => void }) {
  const copy: Record<EmptyReason, { icon: React.ReactNode; title: string; body: React.ReactNode }> = {
    "no-photos": {
      icon: <span className="text-6xl" aria-hidden>📷</span>,
      title: limited ? "No photos to look at yet." : "No photos on this phone yet.",
      body: limited ? "Choose a few photos from your trips and we'll look again." : "Add your countries yourself. It takes a minute, and you can look in your photos again any time later.",
    },
    "no-places": {
      icon: (
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-[#ffb3d6]">
          <MapPinOff size={36} aria-hidden />
        </span>
      ),
      title: "Your photos don't say where they were taken.",
      body: (
        <>
          iPhone only saves a photo&apos;s place when Location is on for the Camera. Add your countries yourself instead: it takes a minute.
          <span className="mt-3 block rounded-2xl bg-white/[0.07] px-4 py-3 text-left text-[13px] text-white/70 ring-1 ring-white/10">
            <span className="font-semibold text-white">For your next trips:</span> Settings › Privacy &amp; Security › Location Services › Camera › While Using the App.
          </span>
        </>
      ),
    },
    "home-only": {
      icon: <span className="text-6xl" aria-hidden>🧭</span>,
      title: "Your trips are hiding well.",
      body: limited ? "The photos you chose were all taken at home. Choose some from your trips and we'll look again." : "Every photo with a place saved was taken at home. Add the countries you've been to yourself: it takes a minute.",
    },
  };
  const c = copy[reason];
  const more = limited && reason !== "no-places";
  return (
    <div className={shell}>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {c.icon}
        <h1 className="mt-5 font-serif text-[2.1rem] leading-tight">{c.title}</h1>
        <div className="mt-3 max-w-xs text-base leading-relaxed text-white/70">{c.body}</div>
      </div>
      <div className="space-y-3 pt-8 text-center">
        {more && (
          <button type="button" onClick={onChooseMore} className="btn-accent w-full py-4 text-lg">
            Choose photos
          </button>
        )}
        <button type="button" onClick={onManual} className={more ? "w-full rounded-full py-3.5 text-base font-medium text-white ring-1 ring-white/30 hover:bg-white/10" : "btn-accent w-full py-4 text-lg"}>
          Add my countries myself
        </button>
      </div>
    </div>
  );
}

/** Reading the photos went wrong: nothing changed, try again, or carry on by hand (first, after a second failure). */
export function ScanError({ failures, onRetry, onManual }: { failures: number; onRetry: () => void; onManual: () => void }) {
  const again = failures >= 2;
  return (
    <div className={shell}>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-[#ffb3d6]">
          <RotateCcw size={34} aria-hidden />
        </span>
        <h1 className="mt-6 font-serif text-[2.1rem] leading-tight">{again ? "Still not working." : "That didn't quite work."}</h1>
        <p className="mt-3 max-w-xs text-base leading-relaxed text-white/70">
          {again
            ? "Your photos are fine and nothing was saved. Add your countries yourself for now: you can look in your photos again any time later."
            : "We couldn't finish reading your photos. Your photos are fine and nothing was saved."}
        </p>
      </div>
      <div className="space-y-3 pt-8 text-center">
        <button type="button" onClick={again ? onManual : onRetry} className="btn-accent w-full py-4 text-lg">
          {again ? "Add my countries myself" : "Try again"}
        </button>
        <button type="button" onClick={again ? onRetry : onManual} className="w-full rounded-full py-3.5 text-base font-medium text-white ring-1 ring-white/30 hover:bg-white/10">
          {again ? "Try once more" : "Add my countries myself"}
        </button>
        {again && <p className="text-xs text-white/50">Later: tap + and choose From my photos.</p>}
      </div>
    </div>
  );
}

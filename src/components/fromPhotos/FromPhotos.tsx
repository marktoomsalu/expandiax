"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { askPhotoAccess, photoAccess, scanPhotos, type PhotoAccess } from "@/lib/photoScan";
import { findWorld } from "@/lib/tripFinder";
import { loadShapes, makeLocator } from "@/lib/countryLocator";
import { findEvents, nameTrips, type BigDay, type FoundEvent } from "@/lib/worldStory";
import {
  applyChanges,
  fromPhotosSeen,
  loadSaved,
  markFromPhotosSeen,
  matchMemories,
  skipSuggestions,
  skippedSuggestions,
  type Applied,
  type Change,
  type Findings,
  type Saved,
} from "@/lib/memoryFinder";
import { noteFeature } from "@/lib/usageClient";
import { tapLight } from "@/lib/haptics";
import { FinderIntro, FinderDenied } from "./FinderIntro";
import { FinderLooking, type Stage } from "./FinderLooking";
import { FinderReview } from "./FinderReview";
import { FinderDone, FinderQuiet } from "./FinderDone";

type Phase = "wait" | "intro" | "denied" | "looking" | "review" | "done" | "quiet";

const EASE = [0.22, 1, 0.36, 1] as const;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * "From my photos": a member's own memory assistant. It looks through their
 * photos (on the phone), sets what it finds against what they've saved,
 * and offers only what's missing or could be richer: new trips and events,
 * and exact days, places and venues for ones already there. Nothing is
 * written until they say so. The first time it explains itself; after
 * that it starts looking as soon as it's opened.
 */
export function FromPhotos({ userId, homeCode, countryCodes }: { userId: string; homeCode: string | null; countryCodes: string[] }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("wait");
  const [access, setAccess] = useState<PhotoAccess | null>(null);
  const [stage, setStage] = useState<Stage>("photos");
  const [progress, setProgress] = useState({ done: 0, total: 0, located: 0 });
  const [findings, setFindings] = useState<Findings | null>(null);
  const [applied, setApplied] = useState<Applied | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saved = useRef<Saved | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // Scrolled down: the close button gets a frosted strip of its own, so cards pass under it, not behind it.
  const [scrolled, setScrolled] = useState(false);
  const started = useRef(false);

  const start = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    tapLight();
    setError(null);
    let status: PhotoAccess;
    try {
      status = await photoAccess();
      if (status !== "full" && status !== "limited") status = await askPhotoAccess();
    } catch {
      status = "denied";
    }
    setAccess(status);
    if (status !== "full" && status !== "limited") {
      started.current = false;
      setPhase("denied");
      return;
    }
    markFromPhotosSeen();
    noteFeature("from_photos_started");
    setStage("photos");
    setProgress({ done: 0, total: 0, located: 0 });
    setPhase("looking");
    try {
      const savedNow = loadSaved(userId);
      const [result, shapes] = await Promise.all([scanPhotos(setProgress), loadShapes(), wait(1600)]);
      const locate = makeLocator(shapes);
      const world = findWorld(result.places, locate, homeCode);

      setStage("events");
      const none = { events: [] as FoundEvent[], bigDays: [] as BigDay[] };
      const [towns, found] = await Promise.all([
        nameTrips(world.trips.filter((t) => t.sure && t.code !== world.homeCode)),
        Promise.race([
          result.moments?.length ? findEvents(result.moments, locate).catch(() => none) : Promise.resolve(none),
          // Event listings that don't answer don't hold everything else up.
          wait(45_000).then(() => none),
        ]),
        wait(1400),
      ]);

      setStage("matching");
      const [mine] = await Promise.all([savedNow, wait(1100)]);
      saved.current = mine;
      const f = matchMemories({ trips: world.trips, towns, homeCode: homeCode ?? world.homeCode, saved: mine, events: found.events, skipped: skippedSuggestions() });
      setFindings(f);
      setStage("found");
      await wait(f.suggestions.length ? 2300 : 900);
      setPhase(f.suggestions.length ? "review" : "quiet");
    } catch {
      setError("Something got in the way. Try again?");
      setPhase("intro");
    } finally {
      started.current = false;
    }
  }, [homeCode, userId]);

  // Opened before: straight to looking (if photos are still allowed).
  useEffect(() => {
    let alive = true;
    void photoAccess()
      .catch(() => "ask" as PhotoAccess)
      .then((s) => {
        if (!alive) return;
        setAccess(s);
        if (fromPhotosSeen() && (s === "full" || s === "limited")) void start();
        else setPhase("intro");
      });
    return () => {
      alive = false;
    };
  }, [start]);

  async function save(changes: Change[], skipped: string[]) {
    if (!saved.current) return;
    setSaving(true);
    skipSuggestions(skipped);
    try {
      const done = await applyChanges(userId, saved.current, changes);
      noteFeature("from_photos_saved");
      setApplied(done);
      setPhase("done");
      router.refresh();
    } catch {
      setError("That didn't save. Try again?");
    } finally {
      setSaving(false);
    }
  }

  function close() {
    tapLight();
    if (window.history.length > 1) router.back();
    else router.push("/my-world");
  }

  let screen: React.ReactNode = null;
  if (phase === "intro") screen = <FinderIntro countryCodes={countryCodes} error={error} onStart={() => void start()} />;
  else if (phase === "denied") screen = <FinderDenied restricted={access === "restricted"} onRetry={() => void start()} />;
  else if (phase === "looking") screen = <FinderLooking stage={stage} progress={progress} findings={findings} onSkipWait={() => findings && setPhase(findings.suggestions.length ? "review" : "quiet")} />;
  else if (phase === "review" && findings) screen = <FinderReview findings={findings} saving={saving} error={error} onSave={(c, s) => void save(c, s)} />;
  else if (phase === "done" && applied) screen = <FinderDone applied={applied} countryCodes={[...(saved.current?.countries.keys() ?? [])]} homeCode={homeCode} />;
  else if (phase === "quiet" && findings) screen = <FinderQuiet findings={findings} limited={access === "limited"} onAgain={() => void start()} onDone={close} />;

  return (
    // Full screen, over the app's header and tab bar.
    <div
      ref={scroller}
      onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 12)}
      className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-canvas text-ink"
    >
      {/* A soft glow of the brand colours at the top, behind everything. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
        <div className="absolute -left-24 -top-40 h-[380px] w-[380px] rounded-full bg-accent/25 blur-3xl dark:bg-accent/20" />
        <div className="absolute -right-28 -top-24 h-[320px] w-[320px] rounded-full bg-accent-3/20 blur-3xl dark:bg-accent-3/15" />
      </div>

      <div
        className={`sticky top-0 z-30 flex justify-end px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] transition-colors duration-300 ${scrolled ? "bg-canvas/85 shadow-[0_1px_0_rgb(var(--line))] backdrop-blur-xl" : ""}`}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-surface/80 text-ink shadow-sm ring-1 ring-line backdrop-blur-xl transition-transform active:scale-95"
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false} onExitComplete={() => scroller.current?.scrollTo({ top: 0 })}>
        <motion.div
          key={phase}
          className="relative -mt-[calc(3.75rem+env(safe-area-inset-top))]"
          // Opacity only: the review's save bar is fixed to the screen, and a transform would pin it to the page.
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.4, ease: EASE } }}
          exit={{ opacity: 0, transition: { duration: 0.18, ease: "easeIn" } }}
        >
          {screen}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

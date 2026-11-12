"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import { getServerState, getState, hasGlobeTouch, startTouch, stopTouch, subscribe } from "@/lib/globeTouch";
import { WORLD_CONNECT_BUTTON_ID } from "./WorldConnectButton";
import { isTouchAsked, isTouchReady, setTouchAsked, setTouchReady } from "@/lib/globeTouchReady";
import { introHolder, onIntroChange } from "@/lib/introQueue";

// Screens where a "turn it on" card would be in the way.
const QUIET = ["/touch", "/start", "/sign-in", "/sign-up"];

/**
 * World Connect, like AirDrop: once it's on, the app listens while it's
 * open, on every screen, so a friend who has World Connect open can find
 * you by bringing their phone close (and that opens it for you too). At
 * least one of the two has to have it open: two people just using the app
 * next to each other are never connected (see touched in lib/globeTouch). The first time, a card
 * asks to turn it on (so the iPhone's permission questions come when you
 * expect them) and shows where its button lives in the header. A touch
 * needs a real approach (see decideTouch), so phones lying side by side
 * never share.
 */
export function GlobeTouchListener() {
  const path = usePathname();
  const router = useRouter();
  const touch = useSyncExternalStore(subscribe, () => getState().touch, () => getServerState().touch);
  const onScreen = path === "/touch";
  const [ready, setReady] = useState(false);
  const [asking, setAsking] = useState(false);
  // "What's new" first: this card waits while it's open (lib/introQueue).
  const waiting = useSyncExternalStore(onIntroChange, () => introHolder() !== null, () => false);

  useEffect(() => {
    if (!hasGlobeTouch()) return;
    if (isTouchReady()) setReady(true);
    else if (!isTouchAsked() && !QUIET.includes(path)) setAsking(true);
  }, [path]);

  useEffect(() => {
    if (!ready || onScreen) return;
    void startTouch("background");
    // Only when the app really leaves the screen: a system sheet on top
    // (like AirDrop's NameDrop) mustn't switch the radio off.
    const subs = [App.addListener("pause", () => void stopTouch()), App.addListener("resume", () => void startTouch("background"))];
    return () => {
      subs.forEach((s) => void s.then((l) => l.remove()));
    };
  }, [ready, onScreen]);

  useEffect(() => {
    // Read it fresh: leaving World Connect clears the touch just before this
    // runs, and the value from this render may still be the old one.
    if (touch && !onScreen && getState().touch) router.push("/touch");
  }, [touch, onScreen, router]);

  if (!asking || waiting) return null;

  const answer = (on: boolean) => {
    setTouchAsked();
    // The next welcome card (the chat tour) may follow.
    window.dispatchEvent(new Event("expandiax:intro-done"));
    setAsking(false);
    if (on) {
      setTouchReady();
      setReady(true);
    }
  };

  return <WorldConnectIntro onAnswer={answer} />;
}

type Spot = { x: number; y: number; size: number };

/** The first-time card: a spotlight on the header button, and Turn on / Not now. */
export function WorldConnectIntro({ onAnswer }: { onAnswer: (on: boolean) => void }) {
  const [spot, setSpot] = useState<Spot | null>(null);

  useEffect(() => {
    const measure = () => {
      const r = document.getElementById(WORLD_CONNECT_BUTTON_ID)?.getBoundingClientRect();
      setSpot(r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, size: Math.max(r.width, r.height) + 8 } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="world-connect-h">
      {spot ? (
        <>
          {/* Everything dark except a circle around the header button. */}
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-full"
            style={{ left: spot.x - spot.size / 2, top: spot.y - spot.size / 2, width: spot.size, height: spot.size, boxShadow: "0 0 0 200vmax rgba(10,2,14,0.74)" }}
          />
          <div
            aria-hidden
            className="world-connect-pulse pointer-events-none absolute rounded-full border-2 border-[#fa51a2]"
            style={{ left: spot.x - spot.size / 2, top: spot.y - spot.size / 2, width: spot.size, height: spot.size }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute h-0 w-0 border-x-[8px] border-b-[9px] border-x-transparent border-b-white"
            style={{ left: spot.x - 8, top: spot.y + spot.size / 2 + 6 }}
          />
          <p
            className="pointer-events-none absolute right-3 max-w-[16rem] rounded-2xl bg-white px-3.5 py-2 text-sm font-medium text-[#2b0b2e] shadow-lg"
            style={{ top: spot.y + spot.size / 2 + 14 }}
          >
            World Connect lives here, anytime.
          </p>
        </>
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[rgba(10,2,14,0.74)]" />
      )}

      <div className="absolute inset-x-0 bottom-0 flex justify-center">
        <div
          className="w-full max-w-md rounded-t-[28px] p-6 text-center text-white"
          style={{ background: "radial-gradient(120% 90% at 50% 0%, #4a1450 0%, #2b0b2e 55%, #12041a 100%)", paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
        >
          <div className="mx-auto flex h-20 w-32 items-center justify-center" aria-hidden>
            <span className="h-16 w-16 rounded-full" style={{ background: "radial-gradient(circle at 35% 30%, #ffd6ea, #fa51a2 55%, #8c1452)", boxShadow: "0 0 30px rgba(250,81,162,.6)" }} />
            <span className="-ml-4 h-16 w-16 rounded-full" style={{ background: "radial-gradient(circle at 35% 30%, #ffe1b8, #fb7822 55%, #8a3a0c)", boxShadow: "0 0 30px rgba(251,120,34,.6)" }} />
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/55">New</p>
          <h2 id="world-connect-h" className="mt-1 font-serif text-3xl">World Connect</h2>
          <p className="mx-auto mt-3 max-w-xs text-white/80">
            Tap the button up here and hold your iPhone close to a friend&rsquo;s. They just need to open ExpandiaX. You&rsquo;ll see the countries you&rsquo;ve both been to, and you can follow each other right away.
          </p>
          <button
            type="button"
            onClick={() => onAnswer(true)}
            className="mt-6 w-full rounded-full py-4 text-lg font-bold text-[#2b0b2e]"
            style={{ background: "linear-gradient(90deg, #fa51a2, #fb7822)" }}
          >
            Turn on
          </button>
          <button type="button" onClick={() => onAnswer(false)} className="mt-3 w-full rounded-full py-3 text-white/70">
            Not now
          </button>
          <p className="mt-2 text-xs text-white/45">Your iPhone will ask to find devices nearby. Nothing is shared until two phones meet.</p>
        </div>
      </div>
      <style>{`.world-connect-pulse{animation:wc-pulse 1.6s ease-out infinite}@keyframes wc-pulse{from{transform:scale(1);opacity:1}to{transform:scale(1.7);opacity:0}}@media (prefers-reduced-motion:reduce){.world-connect-pulse{animation:none}}`}</style>
    </div>
  );
}

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import { getServerState, getState, hasGlobeTouch, startTouch, stopTouch, subscribe } from "@/lib/globeTouch";
import { isTouchAsked, isTouchReady, setTouchAsked, setTouchReady } from "@/lib/globeTouchReady";

// Screens where a "turn it on" card would be in the way.
const QUIET = ["/touch", "/start", "/sign-in", "/sign-up"];

/**
 * Touch globes without a button, like AirDrop: once it's on, the app
 * listens while it's open, on every screen, and bringing two phones
 * together opens Touch globes with that touch. The first time, a card
 * asks to turn it on, so the iPhone's permission questions come when
 * you expect them. A touch needs a real approach (see decideTouch), so
 * phones lying side by side never share.
 */
export function GlobeTouchListener() {
  const path = usePathname();
  const router = useRouter();
  const touch = useSyncExternalStore(subscribe, () => getState().touch, () => getServerState().touch);
  const onScreen = path === "/touch";
  const [ready, setReady] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!hasGlobeTouch()) return;
    if (isTouchReady()) setReady(true);
    else if (!isTouchAsked() && !QUIET.includes(path)) setAsking(true);
  }, [path]);

  useEffect(() => {
    if (!ready || onScreen) return;
    void startTouch("background");
    const sub = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void startTouch("background");
      else void stopTouch();
    });
    return () => {
      void sub.then((s) => s.remove());
    };
  }, [ready, onScreen]);

  useEffect(() => {
    if (touch && !onScreen) router.push("/touch");
  }, [touch, onScreen, router]);

  if (!asking) return null;

  const answer = (on: boolean) => {
    setTouchAsked();
    setAsking(false);
    if (on) {
      setTouchReady();
      setReady(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="touch-ask-h">
      <div
        className="w-full max-w-md rounded-t-[28px] p-6 text-center text-white"
        style={{ background: "radial-gradient(120% 90% at 50% 0%, #4a1450 0%, #2b0b2e 55%, #12041a 100%)", paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
      >
        <div className="mx-auto flex h-20 w-32 items-center justify-center" aria-hidden>
          <span className="h-16 w-16 rounded-full" style={{ background: "radial-gradient(circle at 35% 30%, #ffe1b8, #fb7822 55%, #8a3a0c)", boxShadow: "0 0 30px rgba(251,120,34,.6)" }} />
          <span className="-ml-4 h-16 w-16 rounded-full" style={{ background: "radial-gradient(circle at 35% 30%, #d6fff8, #2dd4bf 55%, #0d5c52)", boxShadow: "0 0 30px rgba(45,212,191,.6)" }} />
        </div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/55">New</p>
        <h2 id="touch-ask-h" className="mt-1 font-serif text-3xl">Touch globes</h2>
        <p className="mx-auto mt-3 max-w-xs text-white/80">
          Hold your iPhone against a friend&rsquo;s, wherever you are in ExpandiaX. You&rsquo;ll both see the countries you share, and can follow each other.
        </p>
        <button
          type="button"
          onClick={() => answer(true)}
          className="mt-6 w-full rounded-full py-4 text-lg font-bold text-[#2b0b2e]"
          style={{ background: "linear-gradient(90deg, #fa51a2, #fb7822)" }}
        >
          Turn on
        </button>
        <button type="button" onClick={() => answer(false)} className="mt-3 w-full rounded-full py-3 text-white/70">
          Not now
        </button>
        <p className="mt-2 text-xs text-white/45">Your iPhone will ask to find devices nearby. Nothing is shared until two phones touch.</p>
      </div>
    </div>
  );
}

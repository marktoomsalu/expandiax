"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, Heart, MessageCircle, Moon } from "lucide-react";
import { PushNotifications } from "@capacitor/push-notifications";
import { askForPush, askLater, askServerState, askState, askSubscribe, closeAsk, rememberNotNow, type AskReason } from "@/lib/pushAsk";
import { tapLight, tapSuccess } from "@/lib/haptics";

// What the sheet says, in the words of the moment that opened it, with an
// example of the notification they'd get.
const COPY: Record<AskReason, { title: string; body: string; example: { title: string; body: string } }> = {
  time: {
    title: "Don’t miss a thing",
    body: "Know when friends follow you, like your memories or send you a message.",
    example: { title: "New like", body: "Alex and 4 others liked your memory ❤️" },
  },
  memory: {
    title: "Know when friends love it",
    body: "We’ll tell you when someone likes or comments on your memory, and now and then bring one back to remember.",
    example: { title: "New like", body: "Alex liked your memory ❤️" },
  },
  follow: {
    title: "Know when they follow back",
    body: "And when friends like your memories or send you a message.",
    example: { title: "New follower", body: "Alex started following you!" },
  },
  like: {
    title: "Get the love back",
    body: "Know when people like or comment on your own memories.",
    example: { title: "New like", body: "Alex liked your memory ❤️" },
  },
  comment: {
    title: "Know when they reply",
    body: "Get a ping when someone answers you, likes your memories or follows you.",
    example: { title: "New answer", body: "Alex answered: “The little bakery by the harbour!”" },
  },
  message: {
    title: "Know when they reply",
    body: "Get a ping the moment they answer, so the conversation keeps going.",
    example: { title: "New message", body: "Alex sent you a message." },
  },
};

const BLOCKED_PATHS = ["/start", "/sign-in", "/sign-up", "/auth", "/onboarding"];
const TWO_MINUTES = 120;

/**
 * The "turn on notifications?" sheet (see lib/pushAsk for when it comes).
 * It waits for a calm moment: not during onboarding, not over another
 * dialog, not while typing.
 */
export function PushAskSheet() {
  const { reason } = useSyncExternalStore(askSubscribe, askState, askServerState);
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const shown = useRef<AskReason | null>(null);

  // Two minutes of actually using the app (in front, not in the background).
  useEffect(() => {
    let seconds = 0;
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      seconds += 5;
      // Then once a minute, in case the first try landed on a busy moment.
      if (seconds >= TWO_MINUTES && seconds % 60 < 5) askForPush("time", 0);
    }, 5_000);
    return () => clearInterval(t);
  }, []);

  // Asked to open: wait for a calm moment (up to 45 s), else give the next moment a go.
  useEffect(() => {
    if (!reason) {
      setVisible(false);
      return;
    }
    let tries = 0;
    const calm = () => {
      const typing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
      const otherDialog = !!document.querySelector('[aria-modal="true"]:not([data-push-ask])');
      const blockedPage = BLOCKED_PATHS.some((p) => window.location.pathname.startsWith(p));
      return !typing && !otherDialog && !blockedPage && document.visibilityState === "visible";
    };
    const check = () => {
      if (calm()) {
        shown.current = reason;
        setVisible(true);
        return true;
      }
      if (++tries > 15) {
        askLater();
        return true;
      }
      return false;
    };
    if (check()) return;
    const t = setInterval(() => check() && clearInterval(t), 3_000);
    return () => clearInterval(t);
  }, [reason, pathname]);

  async function turnOn() {
    setBusy(true);
    tapLight();
    try {
      const { receive } = await PushNotifications.requestPermissions();
      if (receive === "granted") {
        tapSuccess();
        // PushRegistration (in the layout) saves the phone when its token arrives.
        await PushNotifications.register();
      }
    } catch {
      // Nothing more to do: Settings can turn them on later.
    }
    setBusy(false);
    setVisible(false);
    closeAsk();
  }

  function notNow() {
    rememberNotNow();
    setVisible(false);
    closeAsk();
  }

  const copy = COPY[shown.current ?? reason ?? "time"];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[95] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && notNow()}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            data-push-ask=""
            aria-labelledby="push-ask-h"
            className="w-full max-w-md overflow-hidden rounded-t-[28px] bg-canvas shadow-2xl sm:rounded-[28px]"
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          >
            {/* A lock screen with the kind of notification they'd get. */}
            <div className="relative overflow-hidden bg-[#140d18] px-5 pb-7 pt-3">
              <span className="mx-auto mb-5 block h-1 w-10 rounded-full bg-white/25 sm:hidden" aria-hidden />
              <span className="pointer-events-none absolute -left-10 -top-16 h-48 w-48 rounded-full bg-accent/30 blur-3xl" aria-hidden />
              <span className="pointer-events-none absolute -bottom-20 -right-10 h-48 w-48 rounded-full bg-[#fb7822]/25 blur-3xl" aria-hidden />
              <motion.div
                className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-travel text-white shadow-lg"
                animate={reduce ? undefined : { rotate: [0, -12, 10, -6, 0] }}
                transition={{ duration: 0.9, delay: 0.5 }}
                aria-hidden
              >
                <Bell size={26} />
              </motion.div>
              <motion.div
                className="relative mx-auto mt-5 max-w-xs rounded-2xl bg-white/90 p-3 text-left shadow-xl backdrop-blur"
                initial={reduce ? false : { opacity: 0, y: -12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.35, type: "spring", stiffness: 300, damping: 24 }}
                aria-hidden
              >
                <div className="flex items-start gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icon-192.png" alt="" className="h-8 w-8 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="flex justify-between text-[13px] font-semibold text-black">
                      <span className="truncate">{copy.example.title}</span>
                      <span className="ml-2 shrink-0 text-[11px] font-normal text-black/50">now</span>
                    </p>
                    <p className="line-clamp-2 text-[13px] leading-snug text-black/80">{copy.example.body}</p>
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
              <h2 id="push-ask-h" className="text-center font-serif text-2xl leading-tight">
                {copy.title}
              </h2>
              <p className="mt-1.5 text-center text-sm text-muted">{copy.body}</p>
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex items-center gap-2.5">
                  <MessageCircle size={16} className="shrink-0 text-accent" aria-hidden /> Messages and new followers, straight away
                </li>
                <li className="flex items-center gap-2.5">
                  <Heart size={16} className="shrink-0 text-accent" aria-hidden /> Likes and comments grouped, never a flood
                </li>
                <li className="flex items-center gap-2.5">
                  <Moon size={16} className="shrink-0 text-accent" aria-hidden /> Quiet at night. Change anything in Settings
                </li>
              </ul>
              <button type="button" onClick={() => void turnOn()} disabled={busy} className="btn-accent mt-5 w-full justify-center">
                Turn on notifications
              </button>
              <button type="button" onClick={notNow} className="mt-2 w-full py-2 text-sm text-muted hover:text-ink">
                Not now
              </button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

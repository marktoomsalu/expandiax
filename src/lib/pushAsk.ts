// Asking for notifications at a good moment, in our own words first.
//
// iPhone lets an app show its "Allow notifications?" box only once, so we
// never spend it blindly. Instead, whichever of these comes first opens our
// own sheet (PushAskSheet), explaining why in that moment's words:
//   time     two minutes of using the app
//   memory   adding a trip, stay, event or photos (also onboarding's first)
//   follow   following someone, or asking to
//   like     liking someone's memory
//   comment  a comment, a question or an answer
//   message  sending a chat message
// "Turn on" shows iPhone's box; "Not now" doesn't use it up, and the
// sheet may come back after a few days (at most three "Not now"s; after
// that only Settings asks). Once per app session at most, only in the app,
// only while iPhone hasn't been asked yet. Remembered on this device,
// because the permission belongs to the device.

import { PushNotifications } from "@capacitor/push-notifications";
import { isNativePlatform } from "./capacitor";

export type AskReason = "time" | "memory" | "follow" | "like" | "comment" | "message";

export const ASK_AGAIN_DAYS = 3;
export const MAX_NOT_NOW = 3;
const KEY = "expandiax:push-ask";

export type AskMemory = { notNow: number; lastAt: number };

/** Whether our sheet may show again, after earlier "Not now"s. */
export function mayAskAgain(m: AskMemory, now: number): boolean {
  if (m.notNow >= MAX_NOT_NOW) return false;
  return !m.lastAt || now - m.lastAt >= ASK_AGAIN_DAYS * 86_400_000;
}

export function readAskMemory(): AskMemory {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<AskMemory> | null;
    return { notNow: Number(v?.notNow) || 0, lastAt: Number(v?.lastAt) || 0 };
  } catch {
    return { notNow: 0, lastAt: 0 };
  }
}

export function rememberNotNow() {
  const m = readAskMemory();
  try {
    localStorage.setItem(KEY, JSON.stringify({ notNow: m.notNow + 1, lastAt: Date.now() }));
  } catch {
    // Private mode: it may ask again next session, which is fine.
  }
}

// ---------- The sheet's state ----------

type State = { reason: AskReason | null };
let state: State = { reason: null };
let shownThisSession = false;
let pending = false;
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  listeners.forEach((l) => l());
};
export const askSubscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const askState = () => state;
export const askServerState = (): State => ({ reason: null });
export const closeAsk = () => set({ reason: null });

/** iPhone hasn't been asked yet (Android 13+ the same). */
async function notAskedYet() {
  try {
    const { receive } = await PushNotifications.checkPermissions();
    return receive === "prompt" || receive === "prompt-with-rationale";
  } catch {
    return false;
  }
}

/**
 * A good moment to ask: opens the sheet (after a short pause, so it doesn't
 * land on top of what just happened) if it may be shown. Safe to call from
 * anywhere, as often as you like; it does nothing on the website.
 */
export function askForPush(reason: AskReason, delayMs = 1500) {
  if (shownThisSession || pending || typeof window === "undefined" || !isNativePlatform()) return;
  if (!mayAskAgain(readAskMemory(), Date.now())) return;
  pending = true;
  void notAskedYet().then((ok) => {
    if (!ok) {
      pending = false;
      return;
    }
    setTimeout(() => {
      pending = false;
      if (shownThisSession) return;
      shownThisSession = true;
      set({ reason });
    }, delayMs);
  });
}

/** For the sheet: it couldn't show right now (another dialog, typing…), so the next good moment may try again. */
export function askLater() {
  shownThisSession = false;
  set({ reason: null });
}

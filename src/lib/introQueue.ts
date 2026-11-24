// One welcome card at a time: "What's new" goes first, the World Connect
// card waits until it's closed (and shows by itself when there's no
// "What's new" to show).

let holder: string | null = null;
const listeners = new Set<() => void>();

export const introHolder = () => holder;
export function claimIntro(name: string) {
  if (holder && holder !== name) return false;
  holder = name;
  listeners.forEach((l) => l());
  return true;
}
export function releaseIntro(name: string) {
  if (holder !== name) return;
  holder = null;
  listeners.forEach((l) => l());
}
export function onIntroChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// The 1.1 tour, for people who were here before it, always in this order:
// What's new → the chat tour → the World Connect card. Each step waits for
// the one before, and World Connect also waits until the chat is closed
// again (the chat tour's "Open chat" goes straight into it).
export const TOUR = {
  /** 1.2's "What's new" (Discover my world): the only one in the 1.2 app; 1.1's tour isn't shown there. */
  find: "expandiax:whats-new:1.2",
  whatsNew: "expandiax:whats-new:1.1",
  chat: "expandiax:chat-tour:1.1",
  worldConnect: "expandiax:world-connect-tour:1.1",
} as const;

export function tourSeen(key: string): boolean {
  try {
    return !!localStorage.getItem(key);
  } catch {
    // No storage: don't show tours that could never be marked seen.
    return true;
  }
}

export function markTourSeen(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Shows again next time; harmless.
  }
  // The next step may follow.
  window.dispatchEvent(new Event("expandiax:intro-done"));
}

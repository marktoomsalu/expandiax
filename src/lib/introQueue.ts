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

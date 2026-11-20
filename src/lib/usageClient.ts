// The app's side of the anonymous totals (migration 086): a queue of
// "+1 to this counter", sent in small batches. Nothing about the person or
// the device goes with it, and nothing is stored on the device.

type Item = { kind: "page" | "feature" | "visit"; key: string; amount?: number };

const queue: Item[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

export function flushUsage(beacon = false) {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!queue.length) return;
  const body = JSON.stringify({ items: queue.splice(0, 40) });
  try {
    if (beacon && navigator.sendBeacon) navigator.sendBeacon("/api/usage", new Blob([body], { type: "application/json" }));
    else void fetch("/api/usage", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    // Counting is never worth an error.
  }
}

export function noteUsage(item: Item) {
  queue.push(item);
  if (!timer) timer = setTimeout(() => flushUsage(), 4000);
}

/** One more use of a feature: "invite_shared", "chat_opened"… */
export const noteFeature = (key: string) => noteUsage({ kind: "feature", key });

import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { APPROACH_METERS, approachProgress, decideTouch, isFreshBumpPair, randomCode, type Reading } from "./globeTouchLogic";

// Touch globes, the phone side. The native plugin (ios/App/App/
// GlobeTouchPlugin.swift) links nearby iPhones and measures the distance
// between them; everything else is here, so it can change with a website
// deploy: what counts as a touch, and what the phones say to each other.
//
// What the phones say, as JSON over the encrypted link:
//   { t: "hi", code }    this phone's code for this session (see migration 058)
//   { t: "bump" }        I just felt a knock (phones without the distance chip)
//   { t: "touch" }       I felt us touch: you too, if you measured us close

type Vec = { x: number; y: number; z: number };

interface GlobeTouchNative {
  capabilities(): Promise<{ available: boolean; preciseDistance: boolean; motion: boolean }>;
  start(options: { bumpThreshold?: number; motion?: boolean }): Promise<{ id: string; preciseDistance: boolean }>;
  stop(): Promise<void>;
  send(options: { data: string; peerId?: string }): Promise<void>;
  addListener(event: "peerConnected" | "peerLost", fn: (e: { peerId: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: "message", fn: (e: { peerId: string; data: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: "distance", fn: (e: { peerId: string; meters: number; direction?: Vec }) => void): Promise<PluginListenerHandle>;
  addListener(event: "bump", fn: (e: { strength: number; at: number }) => void): Promise<PluginListenerHandle>;
  addListener(event: "unavailable", fn: (e: { reason: "network" | "distance"; message: string }) => void): Promise<PluginListenerHandle>;
}

const Native = registerPlugin<GlobeTouchNative>("GlobeTouch");

export type TouchPeer = {
  id: string;
  code: string | null;
  /** Latest distance in metres; null when unknown or out of range. */
  meters: number | null;
  direction: Vec | null;
  readings: Reading[];
  bumpAt: number;
};

export type Touch = { peerId: string; myCode: string; peerCode: string; at: number };

export type TouchState = {
  status: "off" | "searching" | "unavailable";
  /** Started from the Touch globes screen, or quietly while using the app. */
  mode: "screen" | "background";
  preciseDistance: boolean;
  problem: "network" | "distance" | null;
  myCode: string;
  peers: Record<string, TouchPeer>;
  touch: Touch | null;
};

const initial: TouchState = {
  status: "off",
  mode: "screen",
  preciseDistance: false,
  problem: null,
  myCode: "",
  peers: {},
  touch: null,
};

let state: TouchState = initial;
const listeners = new Set<() => void>();
let handles: PluginListenerHandle[] = [];
let localBumpAt = 0;
let starting: Promise<void> | null = null;

function set(next: Partial<TouchState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function setPeer(id: string, change: (p: TouchPeer) => Partial<TouchPeer>) {
  const p = state.peers[id] ?? { id, code: null, meters: null, direction: null, readings: [], bumpAt: 0 };
  set({ peers: { ...state.peers, [id]: { ...p, ...change(p) } } });
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getState = () => state;
export const getServerState = () => initial;

/** Whether this app build has the native part (iPhone app from version 1.1). */
export function hasGlobeTouch(): boolean {
  return Capacitor.getPlatform() === "ios" && Capacitor.isPluginAvailable("GlobeTouch");
}

function say(message: Record<string, unknown>, peerId?: string) {
  Native.send({ data: JSON.stringify(message), peerId }).catch(() => {});
}

function touched(peerId: string) {
  const peer = state.peers[peerId];
  if (state.touch || !peer?.code) return;
  say({ t: "touch" }, peerId);
  set({ touch: { peerId, myCode: state.myCode, peerCode: peer.code, at: Date.now() } });
}

export async function startTouch(mode: TouchState["mode"]): Promise<void> {
  if (!hasGlobeTouch()) {
    set({ status: "unavailable" });
    return;
  }
  // Already running for the screen: the background listener doesn't take it back.
  if (state.status === "searching" && (state.mode === mode || mode === "background")) return;
  if (starting) await starting;

  starting = (async () => {
    await stopTouch();
    const myCode = randomCode();
    set({ ...initial, mode, myCode });

    handles = await Promise.all([
      Native.addListener("peerConnected", ({ peerId }) => {
        setPeer(peerId, () => ({}));
        say({ t: "hi", code: state.myCode }, peerId);
      }),
      Native.addListener("peerLost", ({ peerId }) => {
        if (state.touch?.peerId === peerId) return; // keep who we touched
        const peers = { ...state.peers };
        delete peers[peerId];
        set({ peers });
      }),
      Native.addListener("message", ({ peerId, data }) => {
        let m: { t?: string; code?: string };
        try {
          m = JSON.parse(data);
        } catch {
          return;
        }
        if (m.t === "hi" && typeof m.code === "string" && /^[0-9a-f]{32}$/.test(m.code)) {
          const code = m.code;
          setPeer(peerId, () => ({ code }));
        } else if (m.t === "bump") {
          const now = Date.now();
          setPeer(peerId, () => ({ bumpAt: now }));
          if (isFreshBumpPair(localBumpAt, now)) touched(peerId);
        } else if (m.t === "touch") {
          // Only if this phone agrees: it measured them close, or felt the knock too.
          const p = state.peers[peerId];
          const near = p?.meters != null && p.meters <= APPROACH_METERS;
          if (near || isFreshBumpPair(localBumpAt, Date.now())) touched(peerId);
        }
      }),
      Native.addListener("distance", ({ peerId, meters, direction }) => {
        const now = Date.now();
        setPeer(peerId, (p) => ({
          meters: meters >= 0 ? meters : null,
          direction: direction ?? null,
          readings: meters >= 0 ? [...p.readings.filter((r) => now - r.at < 4000), { meters, at: now }] : [],
        }));
        if (decideTouch(state.peers[peerId]?.readings ?? [], now)) touched(peerId);
      }),
      Native.addListener("bump", () => {
        const now = Date.now();
        localBumpAt = now;
        say({ t: "bump" });
        const partner = Object.values(state.peers).find((p) => isFreshBumpPair(p.bumpAt, now));
        if (partner) touched(partner.id);
      }),
      Native.addListener("unavailable", ({ reason }) => set({ problem: reason })),
    ]);

    try {
      // In the background, only phones with the distance chip join in:
      // knocks are left to the screen, where you meant to do it.
      const { preciseDistance } = await Native.start({ motion: mode === "screen" });
      set({ status: "searching", preciseDistance });
    } catch {
      set({ status: "unavailable" });
    }
  })();
  await starting;
  starting = null;
}

export async function stopTouch(): Promise<void> {
  const old = handles;
  handles = [];
  await Promise.all(old.map((h) => h.remove()));
  if (state.status === "searching") await Native.stop().catch(() => {});
  set({ status: "off", peers: {}, touch: state.touch });
}

/** Forget the last touch (after it's been shown). */
export function clearTouch() {
  set({ touch: null });
}

/** How close the nearest linked phone is, 0 (far or none) to 1 (touching). */
export function closeness(s: TouchState): { peer: TouchPeer | null; value: number } {
  let best: TouchPeer | null = null;
  for (const p of Object.values(s.peers)) {
    if (p.meters == null) continue;
    if (!best || p.meters < (best.meters ?? Infinity)) best = p;
  }
  const any = best ?? Object.values(s.peers)[0] ?? null;
  return { peer: any, value: best?.meters != null ? approachProgress(best.meters) : 0 };
}

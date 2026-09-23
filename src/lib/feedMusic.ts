"use client";

import { useSyncExternalStore } from "react";

// One shared <audio> for the whole feed. iOS only lets a media element play
// with sound after a user gesture has started *that element* — so the first
// tap on any music sticker unlocks this single element, and every later
// post can then swap its src and play on scroll without another tap.
// Separate elements per card would each need their own tap.

type State = { soundOn: boolean; playingKey: string | null };

let state: State = { soundOn: false, playingKey: null };
const listeners = new Set<() => void>();
const visible = new Map<string, { ratio: number; url: string | null }>();
let audio: HTMLAudioElement | null = null;
// The post whose video is playing — its music stays quiet until another
// post becomes the one on screen.
let yieldedKey: string | null = null;

const PLAY_THRESHOLD = 0.6;

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function el(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.preload = "auto";
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) audio?.pause();
      else if (state.soundOn && state.playingKey) void audio?.play().catch(() => {});
    });
  }
  return audio;
}

function play(key: string, url: string) {
  const a = el();
  if (state.playingKey !== key) {
    a.src = url;
    a.currentTime = 0;
  }
  set({ playingKey: key });
  a.play().catch(() => {
    // Autoplay refused (no gesture yet, e.g. after a reload) — fall back to
    // muted rather than showing a sticker that claims to be playing.
    set({ soundOn: false, playingKey: null });
  });
}

function stop() {
  audio?.pause();
  set({ playingKey: null });
}

function mostVisible(): { key: string; url: string } | null {
  let best: { key: string; url: string; ratio: number } | null = null;
  for (const [key, v] of visible) {
    if (v.url && v.ratio >= PLAY_THRESHOLD && (!best || v.ratio > best.ratio)) best = { key, url: v.url, ratio: v.ratio };
  }
  return best;
}

function sync() {
  if (!state.soundOn) return;
  const best = mostVisible();
  if (best && best.key !== yieldedKey) yieldedKey = null;
  if (!best || best.key === yieldedKey) {
    if (state.playingKey) stop();
  } else if (best.key !== state.playingKey) play(best.key, best.url);
}

export const feedMusic = {
  report(key: string, ratio: number, url: string | null) {
    visible.set(key, { ratio, url });
    sync();
  },
  forget(key: string) {
    visible.delete(key);
    if (state.playingKey === key) stop();
  },
  /** Must be called from a tap — that's what unlocks audio on iOS. */
  toggle(key: string, url: string) {
    if (state.soundOn && state.playingKey === key) {
      set({ soundOn: false });
      stop();
      return;
    }
    yieldedKey = null;
    set({ soundOn: true });
    play(key, url);
  },
  /** A video in a post started — get out of its way without turning sound off. */
  yield(key: string) {
    yieldedKey = key;
    stop();
  },
};

export function useFeedMusic(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state
  );
}

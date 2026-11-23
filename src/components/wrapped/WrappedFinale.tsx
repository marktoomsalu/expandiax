"use client";

// The Wrapped finale: their Story picture, live. The same drawing the server
// turns into the PNG (PosterArt), shown on the phone, so every photo they tick
// lands in it at once, and Share sends exactly what they see. Five photos fit:
// a full collage asks which one to swap out. Tap a small one to make it big.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ImagePlus, Loader2, RefreshCw } from "lucide-react";
import { drawGlobe } from "@/lib/globeArt";
import { tapLight, tapSuccess } from "@/lib/haptics";
import { collageDefault, type WrappedYear } from "@/lib/wrapped";
import { COLLAGE_SLOTS, POSTER_GLOBE, POSTER_H, POSTER_W, PosterArt, storyFacts } from "@/lib/wrappedPosterArt";
import { useWorldFeatures } from "./GlobePicture";

/** Photos next/image may resize (the hosts in next.config.mjs); anything else is shown as it is. */
export const resizable = (url: string) => /^https:\/\/(([a-z0-9-]+\.)+supabase\.co|i\.scdn\.co|([a-z0-9-]+\.)+mzstatic\.com)\//.test(url);
/** A phone-sized copy of a photo (through next/image's resizer), not the original. */
const small = (url: string, width: 256 | 384 | 640 | 828) => (resizable(url) ? `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=75` : url);

// ---------------------------------------------------------------- their pick, kept

const keyFor = (year: number) => `expandiax:wrapped:${year}:collage`;

function savedPick(w: WrappedYear): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem(keyFor(w.year)) ?? "[]") as string[];
    const known = ids.filter((id) => w.photos.some((p) => p.id === id)).slice(0, COLLAGE_SLOTS);
    if (known.length) return known;
  } catch {
    // nothing saved
  }
  return collageDefault(w, COLLAGE_SLOTS);
}

function usePick(w: WrappedYear) {
  const [ids, setIds] = useState<string[]>(() => collageDefault(w, COLLAGE_SLOTS));
  useEffect(() => setIds(savedPick(w)), [w]);
  const save = useCallback(
    (next: string[]) => {
      setIds(next);
      try {
        localStorage.setItem(keyFor(w.year), JSON.stringify(next));
      } catch {
        // only for this time
      }
    },
    [w.year]
  );
  return [ids, save] as const;
}

// ---------------------------------------------------------------- the PNG they share

const storyFiles = new Map<string, Promise<File | null>>();
const storyUrl = (w: WrappedYear, ids: string[]) => `/api/wrapped/poster?year=${w.year}${ids.length ? `&photos=${ids.join(",")}` : ""}`;
function storyFile(url: string, year: number) {
  let p = storyFiles.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => (b ? new File([b], `expandiax-${year}-wrapped.png`, { type: "image/png" }) : null))
      .catch(() => null);
    void p.then((f) => !f && storyFiles.delete(url));
    storyFiles.set(url, p);
  }
  return p;
}
/** Make their picture while they watch, so Share is instant at the end. */
export function warmStory(w: WrappedYear) {
  void storyFile(storyUrl(w, savedPick(w)), w.year);
}

// ---------------------------------------------------------------- the collage, live

function WrappedCollage({ w, ids, onPhoto }: { w: WrappedYear; ids: string[]; onPhoto?: (slot: number) => void }) {
  const features = useWorldFeatures();
  const globe = useMemo(
    () => (features ? drawGlobe(features, { ...POSTER_GLOBE, countries: w.countries, home: w.homeCode, route: w.journey.map((s) => s.code) }) : null),
    [features, w]
  );
  const facts = useMemo(() => storyFacts(w), [w]);
  const photos = useMemo(() => {
    const urls = ids.map((id, i) => {
      const url = w.photos.find((p) => p.id === id)?.url;
      return url ? small(url, i === 0 ? 828 : 384) : null;
    });
    // No photos of their own: their top highlight's picture, as on the PNG.
    return urls.length ? urls : w.highlights[0]?.photo ? [w.highlights[0].photo] : [];
  }, [ids, w]);

  // Drawn at full size (1080 wide), scaled to the frame.
  const box = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setK(el.clientWidth / POSTER_W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} className="wrapped-collage relative h-full w-full overflow-hidden">
      {k > 0 && (
        <div style={{ width: POSTER_W, height: POSTER_H, transform: `scale(${k})`, transformOrigin: "0 0" }}>
          <PosterArt year={w.year} facts={facts} photos={photos} globe={globe} wordmark="/wordmark.svg" onPhoto={onPhoto} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- the finale

export function Finale({ w, onReplay }: { w: WrappedYear; onReplay: () => void }) {
  const [ids, setIds] = usePick(w);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const url = storyUrl(w, ids);

  // Their picture, made in the background once they've settled on it.
  useEffect(() => {
    const t = setTimeout(() => void storyFile(url, w.year), 1200);
    return () => clearTimeout(t);
  }, [url, w.year]);

  // In the collage: a small photo tapped becomes the big one.
  const makeBig = (slot: number) => {
    if (slot === 0 || !ids[slot]) return;
    tapLight();
    const next = [...ids];
    [next[0], next[slot]] = [next[slot], next[0]];
    setIds(next);
  };

  // In the picker.
  const toggle = (id: string) => {
    setNote(null);
    const at = ids.indexOf(id);
    if (at >= 0) {
      if (pending) {
        // Full, and this is the one to make room: the new one takes its place.
        tapSuccess();
        const next = [...ids];
        next[at] = pending;
        setIds(next);
        setPending(null);
        return;
      }
      if (ids.length === 1) return setNote("Keep at least one photo.");
      tapLight();
      return setIds(ids.filter((x) => x !== id));
    }
    if (pending === id) return setPending(null);
    if (ids.length < COLLAGE_SLOTS) {
      tapSuccess();
      return setIds([...ids, id]);
    }
    tapLight();
    setPending(id);
  };

  async function share() {
    setNote(null);
    setBusy(true);
    const f = await storyFile(url, w.year);
    setBusy(false);
    if (!f) return setNote("Couldn't make the picture. Try again?");
    try {
      if (navigator.canShare?.({ files: [f] })) return void (await navigator.share({ files: [f] }));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      if ((e as Error).name === "NotAllowedError") return setNote("Ready: tap again to share.");
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    a.click();
  }

  const canChoose = w.photos.length > 1;

  return (
    <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#3b1660_0%,#1a0b2c_55%,#120818_100%)]" data-own-taps>
      <div className="absolute inset-0 flex flex-col px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(5.6rem+env(safe-area-inset-top))]">
        {!editing && <p className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-white/60">Your {w.year}, in one picture</p>}
        {/* The picture: smaller while they choose, so it stays in view as it changes. */}
        <div
          className={`relative mx-auto aspect-[9/16] shrink-0 overflow-hidden rounded-[1.2rem] shadow-[0_30px_80px_-20px_rgba(250,81,162,0.55)] ring-1 ring-white/15 transition-[height,margin] duration-300 ease-out ${
            editing ? "mt-0 h-[min(36dvh,calc((100vw-2.5rem)*16/9))]" : "mt-3 h-[min(60dvh,calc((100vw-2.5rem)*16/9))]"
          }`}
        >
          <WrappedCollage w={w} ids={ids} onPhoto={ids.length > 1 ? makeBig : undefined} />
        </div>
        {!editing && ids.length > 1 && <p className="mt-2 text-center text-xs text-white/50">Tap a small photo to make it the big one</p>}

        <AnimatePresence mode="wait" initial={false}>
          {editing ? (
            <Picker key="picker" w={w} ids={ids} pending={pending} note={note} onToggle={toggle} onDone={() => (setEditing(false), setPending(null), setNote(null))} />
          ) : (
            <motion.div key="actions" className="mx-auto mt-auto w-full max-w-sm pt-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {note && <p className="mb-3 text-center text-sm text-white/80">{note}</p>}
              <button
                type="button"
                onClick={() => void share()}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#ffe4f1] py-4 text-lg font-semibold text-[#2b0b2e] shadow-[0_14px_40px_-12px_rgba(250,81,162,0.8)] disabled:opacity-70"
              >
                {busy ? <Loader2 size={19} className="animate-spin" aria-hidden /> : <InstagramGlyph />} Share to Instagram
              </button>
              <div className="mt-3 flex gap-3">
                {canChoose && (
                  <button
                    type="button"
                    onClick={() => (tapLight(), setEditing(true))}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-3.5 font-medium ring-1 ring-white/40 hover:bg-white/10"
                  >
                    <ImagePlus size={16} aria-hidden /> Choose photos
                  </button>
                )}
                <Link href="/my-world" className="flex flex-1 items-center justify-center rounded-full py-3.5 font-medium ring-1 ring-white/40 hover:bg-white/10">
                  Keep exploring
                </Link>
              </div>
              <button type="button" onClick={onReplay} className="mx-auto mt-3 flex items-center gap-1.5 text-sm text-white/60 hover:text-white">
                <RefreshCw size={13} aria-hidden /> Watch again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Their year's photos: ticked ones are in the collage, numbered by where they sit (1 is the big one). */
function Picker({ w, ids, pending, note, onToggle, onDone }: { w: WrappedYear; ids: string[]; pending: string | null; note: string | null; onToggle: (id: string) => void; onDone: () => void }) {
  const full = ids.length >= COLLAGE_SLOTS;
  return (
    <motion.div
      className="mt-3 flex min-h-0 flex-1 flex-col rounded-t-[24px] bg-[#1f0a25] px-3 pt-3 ring-1 ring-white/10"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="font-semibold">Your photos</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={pending ? "swap" : note ?? String(ids.length)}
              className={`text-xs ${pending ? "font-semibold text-[#ffb3d6]" : "text-white/55"}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {pending ? "The collage holds 5. Tap one to swap it out." : note ?? (full ? "5 of 5 · tap a ticked one to take it out" : `${ids.length} of 5 · tap to add or take out`)}
            </motion.p>
          </AnimatePresence>
        </div>
        <button type="button" onClick={onDone} className="shrink-0 rounded-full bg-[#ffe4f1] px-5 py-2 text-sm font-semibold text-[#2b0b2e]">
          Done
        </button>
      </div>
      <div className="-mx-1 mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-3">
        <div className="grid grid-cols-4 gap-1.5">
          {w.photos.map((p) => {
            const at = ids.indexOf(p.id);
            const on = at >= 0;
            const waiting = pending === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onToggle(p.id)}
                aria-pressed={on}
                aria-label={on ? `${p.label}, in the collage (${at === 0 ? "the big one" : `photo ${at + 1}`})` : `${p.label}, add to the collage`}
                className={`relative block w-full overflow-hidden rounded-lg bg-white/5 pt-[100%] transition ${
                  on ? "ring-2 ring-[#fa51a2]" : waiting ? "animate-pulse ring-2 ring-[#ffd1e8]" : pending ? "opacity-60" : ""
                } ${pending && on ? "ring-[3px] ring-[#ffd1e8]" : ""}`}
              >
                <Image src={p.url} alt="" fill sizes="(max-width: 640px) 25vw, 120px" unoptimized={!resizable(p.url)} className={`object-cover transition ${on || waiting ? "" : "brightness-[0.8]"}`} />
                {on && (
                  <span className="absolute right-1 top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#fa51a2] px-1 text-[11px] font-bold shadow">
                    {at === 0 ? "Big" : at + 1}
                  </span>
                )}
                {!on && !full && (
                  <span className="absolute right-1 top-1 h-5 w-5 rounded-full ring-2 ring-white/70" aria-hidden />
                )}
                {waiting && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Check size={18} strokeWidth={3} aria-hidden />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

export function InstagramGlyph() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="17.4" cy="6.6" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

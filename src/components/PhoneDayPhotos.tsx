"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown, Heart, Smartphone } from "lucide-react";
import { photoFile, photosBetween, photoThumbs, type DayPhoto } from "@/lib/photoScan";
import { tapLight } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayLabel = (d: string) => {
  const x = new Date(`${d}T12:00:00Z`);
  return `${WEEKDAYS[x.getUTCDay()]} ${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]}`;
};

/**
 * Adding a trip's or an event's photos in the iPhone app (build 15 on):
 * straight to the photos from its own days, grouped by day from the first,
 * instead of the whole library. Tap the ones to keep, then add them; they go
 * up through the same uploader as any other (its limits, its cover).
 */
export function PhoneDayPhotos({ from, to, remaining, onAdd }: { from: string; to: string; remaining: number; onAdd: (files: File[]) => Promise<void> | void }) {
  const [photos, setPhotos] = useState<DayPhoto[] | null>(null);
  const [open, setOpen] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const asked = useRef(new Set<string>());

  useEffect(() => {
    let alive = true;
    void photosBetween(from, to).then((p) => alive && setPhotos(p));
    return () => {
      alive = false;
    };
  }, [from, to]);

  const days = useMemo(() => {
    const by = new Map<string, DayPhoto[]>();
    for (const p of photos ?? []) by.set(p.t.slice(0, 10), [...(by.get(p.t.slice(0, 10)) ?? []), p]);
    return [...by.entries()];
  }, [photos]);
  const favourites = useMemo(() => (photos ?? []).filter((p) => p.f).length, [photos]);

  const want = useCallback((ids: string[]) => {
    const need = ids.filter((id) => !asked.current.has(id));
    if (!need.length) return;
    need.forEach((id) => asked.current.add(id));
    void photoThumbs(need, 300).then((got) => setThumbs((prev) => ({ ...prev, ...got })));
  }, []);

  if (!photos || !photos.length) return null;

  function toggle(id: string) {
    tapLight();
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= remaining ? p : [...p, id]));
  }

  async function add() {
    setBusy(true);
    const files: File[] = [];
    for (const id of picked) {
      const f = await photoFile(id);
      if (f) files.push(f);
    }
    await onAdd(files);
    setPicked([]);
    setBusy(false);
  }

  const firstDay = days[0]?.[0];
  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-line bg-surface">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={open}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Smartphone size={18} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Your photos from these days</span>
          <span className="block text-xs text-muted">
            {photos.length} on this phone
            {favourites > 0 && (
              <>
                {" · "}
                <Heart size={11} className="-mt-0.5 inline fill-accent text-accent" aria-hidden /> {favourites}
                <span className="sr-only"> {favourites === 1 ? "favourite" : "favourites"}</span>
              </>
            )}{" "}
            · {from === to ? dayLabel(from) : `${dayLabel(from)} – ${dayLabel(to)}`}
          </span>
        </span>
        <ChevronDown size={18} className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="max-h-[60vh] overflow-y-auto px-3 pb-3">
          {days.map(([d, list], i) => (
            <motion.section key={d} onViewportEnter={() => want(list.map((p) => p.id))} className="pt-2">
              <p className="sticky top-0 z-10 bg-surface/95 px-1 py-1.5 text-xs font-semibold text-muted backdrop-blur">
                {d === firstDay && from !== to ? "Day 1" : from !== to ? `Day ${i + 1}` : "That day"} · {dayLabel(d)}
              </p>
              <div className="grid grid-cols-4 gap-1">
                {list.map((p) => {
                  const on = picked.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.id)}
                      aria-pressed={on}
                      aria-label={`Photo at ${p.t.slice(11)}${p.f ? ", a favourite" : ""}`}
                      className={cn("relative aspect-square overflow-hidden rounded-md bg-line/40", on && "ring-[3px] ring-accent ring-inset")}
                    >
                      {thumbs[p.id] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbs[p.id]} alt="" className={cn("h-full w-full object-cover transition-transform", on && "scale-90 rounded-sm")} />
                      )}
                      {/* A favourite in their Photos app: the same white heart, in the same corner. */}
                      {p.f && (
                        <Heart size={14} className="absolute bottom-1 left-1 fill-white text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" aria-hidden />
                      )}
                      {on && (
                        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white shadow">
                          <Check size={12} strokeWidth={3} aria-hidden />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.section>
          ))}
        </div>
      )}

      {picked.length > 0 && (
        <div className="border-t border-line p-3">
          <button type="button" onClick={() => void add()} disabled={busy} className="btn-accent w-full">
            {busy ? "Adding…" : `Add ${picked.length} ${picked.length === 1 ? "photo" : "photos"}`}
          </button>
          {picked.length >= remaining && <p className="mt-2 text-center text-xs text-muted">That&apos;s as many as this one can hold.</p>}
        </div>
      )}
    </div>
  );
}

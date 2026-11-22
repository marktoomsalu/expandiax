"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Music2, PartyPopper, Plus, Presentation, Sparkles, Tent, Ticket, Trophy } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import { eventPhotoKind, eventStockPhoto, stockPhotoFor, stockUrl, type StockPhoto } from "@/lib/stockPhotos";
import type { BigDay, FoundEvent } from "@/lib/worldStory";
import type { KeptEvent } from "@/lib/worldScan";
import type { EventType } from "@/lib/types";
import { tapLight, tapSuccess } from "@/lib/haptics";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (d: string) => {
  const x = new Date(`${d}T12:00:00Z`);
  return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
};

const EVENT_META: Record<string, { label: string; icon: typeof Music2 }> = {
  concert: { label: "Concert", icon: Music2 },
  festival: { label: "Festival", icon: Tent },
  sport: { label: "Match", icon: Trophy },
  personal: { label: "Special day", icon: PartyPopper },
  conference: { label: "Conference", icon: Presentation },
  other: { label: "Show", icon: Ticket },
};

/** What a big day can be, in one tap. */
const KINDS: { key: string; label: string; emoji: string; type: EventType; hint: string }[] = [
  { key: "concert", label: "Concert", emoji: "🎤", type: "concert", hint: "Who played?" },
  { key: "match", label: "Match", emoji: "⚽", type: "sport", hint: "Who played?" },
  { key: "race", label: "Race", emoji: "🏃", type: "sport", hint: "IRONMAN Tallinn" },
  { key: "festival", label: "Festival", emoji: "🎪", type: "festival", hint: "Which festival?" },
  { key: "wedding", label: "Wedding", emoji: "💍", type: "personal", hint: "Whose wedding?" },
  { key: "party", label: "Party", emoji: "🎉", type: "personal", hint: "What was it?" },
  { key: "other", label: "Other", emoji: "✨", type: "other", hint: "What was it?" },
];

type Named = { kind: string; title: string };

/**
 * "Your memories": the concerts, matches, festivals and
 * races found, as tickets (the surest already kept), and the big days
 * nothing was listed for, each one tap from being named. Pictures are
 * curated Unsplash ones for each kind of event: their own photos stay
 * theirs until they add them.
 */
export function MemoriesView({
  events,
  bigDays,
  onSave,
  saveLabel,
}: {
  /** Null while still looking. */
  events: FoundEvent[] | null;
  bigDays: BigDay[];
  saveLabel: string;
  onSave: (kept: KeptEvent[]) => void;
}) {
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [named, setNamed] = useState<Record<string, Named>>({});

  const isKept = (e: FoundEvent) => (e.sure ? !flipped.has(e.id) : flipped.has(e.id));
  const toggle = (id: string) => {
    tapLight();
    setFlipped((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const name = (id: string, n: Named | null) =>
    setNamed((cur) => {
      const next = { ...cur };
      if (n) next[id] = n;
      else delete next[id];
      return next;
    });

  const found = events ?? [];
  const keptCount = found.filter(isKept).length + Object.keys(named).length;

  function save() {
    tapSuccess();
    const kept: KeptEvent[] = [
      ...found.filter(isKept).map((e) => ({ type: e.type, title: e.title, artist: e.artist, venue: e.venue, city: e.city, code: e.code, date: e.date, covers: e.covers })),
      ...bigDays.flatMap((b) => {
        const n = named[b.id];
        if (!n) return [];
        const kind = KINDS.find((k) => k.key === n.kind) ?? KINDS[KINDS.length - 1];
        const where = b.place ?? b.city;
        const title = n.title.trim() || (where ? `${kind.label} · ${where}` : kind.label);
        return [{ type: kind.type, title: title.slice(0, 120), artist: kind.key === "concert" && n.title.trim() ? n.title.trim() : null, venue: b.place, city: b.city, code: b.code, date: b.date, covers: b.covers }];
      }),
    ];
    onSave(kept);
  }

  const list = (
    tickets: FoundEvent[],
    days: BigDay[],
    roomy = false
  ) => (
    <>
      {tickets.map((e, i) => (
        <EventTicket key={e.id} e={e} index={i} kept={isKept(e)} onToggle={() => toggle(e.id)} />
      ))}
      {days.length > 0 && (
        <p className={`flex items-center gap-1.5 px-1 font-serif text-lg ${roomy ? "pt-4" : "pt-1"}`}>
          <Sparkles size={16} className="text-[#ffb3d6]" aria-hidden /> What was this?
          <span className="font-sans text-xs text-white/45">One tap to keep it</span>
        </p>
      )}
      {days.map((b) => (
        <BigDayCard key={b.id} b={b} named={named[b.id] ?? null} onName={(n) => name(b.id, n)} />
      ))}
    </>
  );

  return (
    <div className="mx-auto min-h-[100dvh] max-w-md">
      <div className="sticky top-0 z-20 bg-[#1f0822] px-5 pb-3 pt-[calc(0.9rem+env(safe-area-inset-top))] shadow-[0_8px_20px_-12px_rgba(0,0,0,0.7)]">
        <p className="font-serif text-2xl">Your memories</p>
        <p className="mt-0.5 text-sm text-white/65">
          <motion.span key={keptCount} className="inline-block font-semibold text-white" initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            {keptCount}
          </motion.span>{" "}
          kept · concerts, matches, festivals, big days
        </p>
      </div>

      <div className="flex flex-col gap-3 px-4 pb-44 pt-3">
        <AnimatePresence>
          {events === null && (
            <motion.div
              key="looking"
              className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3 text-sm text-white/70 ring-1 ring-white/10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
            >
              <motion.span animate={{ rotate: [0, -12, 12, 0] }} transition={{ duration: 1.2, repeat: Infinity }} aria-hidden>
                <Ticket size={18} className="text-[#ffb3d6]" />
              </motion.span>
              Looking for concerts, matches and festivals…
            </motion.div>
          )}
        </AnimatePresence>

        {list(found, bigDays, true)}
        {events !== null && !found.length && !bigDays.length && (
          <p className="px-1 pt-10 text-center text-sm text-white/55">No concerts or big days found this time. You can add them any time.</p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[#14051a] via-[#14051a]/95 to-transparent px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-10">
        <div className="mx-auto max-w-md">
          <button type="button" onClick={save} className="btn-accent w-full py-4 text-lg shadow-[0_12px_30px_-8px_rgba(250,81,162,0.7)]">
            {saveLabel}
          </button>
        </div>
      </div>

    </div>
  );
}

function Photo({ photo, className }: { photo: StockPhoto | null; className?: string }) {
  return (
    <span className={`relative block overflow-hidden ${className ?? ""}`} style={{ background: photo?.color ?? "#3a1240" }}>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={stockUrl(photo.raw, 240, "1:1", 70)} alt="" className="h-full w-full object-cover" />
      )}
      {photo && <span className="absolute bottom-0.5 left-1 right-1 truncate text-[7px] text-white/70 drop-shadow">{photo.author} / Unsplash</span>}
    </span>
  );
}

/** A ticket stub: a picture of that kind of night, a perforation, then who and where. */
function EventTicket({ e, index, kept, onToggle }: { e: FoundEvent; index: number; kept: boolean; onToggle: () => void }) {
  const reduce = useReducedMotion();
  const meta = EVENT_META[e.type] ?? EVENT_META.other;
  const Icon = meta.icon;
  const where = [e.venue !== e.title ? e.venue : null, e.city].filter(Boolean).join(" · ");
  const photo = eventStockPhoto(eventPhotoKind(e.type, e.title), e.id);
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      aria-pressed={kept}
      aria-label={`${e.title}, ${day(e.date)}${kept ? "" : ", not kept"}`}
      initial={reduce ? false : { opacity: 0, y: 16, rotate: index % 2 ? 1.5 : -1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ delay: reduce ? 0 : Math.min(index, 6) * 0.07, type: "spring", stiffness: 220, damping: 22 }}
      className="relative block w-full shrink-0 text-left"
    >
      <div className={`relative flex h-32 overflow-hidden rounded-2xl bg-gradient-to-br from-[#fff4f9] to-[#ffe9da] text-[#2b0b2e] shadow-[0_14px_30px_-12px_rgba(0,0,0,0.6)] transition-[filter,opacity] duration-300 ${kept ? "" : "opacity-45 grayscale"}`}>
        <Photo photo={photo} className="h-full w-32 shrink-0" />
        <span aria-hidden className="relative w-0 border-l-2 border-dashed border-[#2b0b2e]/20">
          <span className="absolute -left-[9px] -top-2 h-4 w-4 rounded-full bg-[#1f0822]" />
          <span className="absolute -bottom-2 -left-[9px] h-4 w-4 rounded-full bg-[#1f0822]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col justify-center px-3.5 pr-11">
          <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#d63384]">
            <Icon size={12} aria-hidden /> {meta.label}
            {!e.sure && <span className="rounded-full bg-[#d63384]/10 px-1.5 normal-case tracking-normal">maybe</span>}
          </p>
          <p className="mt-1 truncate font-serif text-xl leading-tight">{e.title}</p>
          <p className="truncate text-xs text-[#2b0b2e]/60">
            {where || countryByCode(e.code)?.name} · {day(e.date)}
          </p>
        </div>
      </div>
      <span
        className={`absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full ${kept ? "bg-gradient-to-br from-[#fa51a2] to-[#fb7822] text-white shadow" : "bg-white text-[#2b0b2e] ring-1 ring-[#2b0b2e]/20"}`}
        aria-hidden
      >
        {kept ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}
      </span>
    </motion.button>
  );
}

function BigDayCard({ b, named, onName }: { b: BigDay; named: Named | null; onName: (n: Named | null) => void }) {
  const kind = named ? KINDS.find((k) => k.key === named.kind) : null;
  const flag = countryByCode(b.code)?.flag;
  const hours = Math.max(1, Math.round(b.hours));
  // The country's picture until they say what it was; then that kind of day's.
  const photo = kind ? eventStockPhoto(eventPhotoKind(kind.type, kind.key === "race" ? "race" : kind.key === "wedding" ? "wedding" : ""), b.id) : stockPhotoFor(b.code, b.id);
  return (
    <motion.div layout className={`shrink-0 overflow-hidden rounded-2xl ring-1 transition-colors ${named ? "bg-white/[0.12] ring-[#fa51a2]" : "bg-white/[0.06] ring-white/10"}`}>
      <div className="flex gap-3 p-2.5">
        <Photo photo={photo} className="h-20 w-20 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-lg leading-tight">
            {flag} {b.place ?? b.city ?? countryByCode(b.code)?.name}
          </p>
          <p className="mt-0.5 text-xs text-white/55">
            {day(b.date)} · {b.photos} photos · {hours} {hours === 1 ? "hour" : "hours"}
          </p>
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto px-2.5 pb-2.5" role="group" aria-label="What was it?">
        {KINDS.map((k) => {
          const on = named?.kind === k.key;
          return (
            <button
              key={k.key}
              type="button"
              aria-pressed={on}
              onClick={() => {
                tapLight();
                onName(on ? null : { kind: k.key, title: named?.title ?? "" });
              }}
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs ring-1 transition-colors ${on ? "bg-white text-[#2b0b2e] ring-white" : "bg-white/5 text-white ring-white/20"}`}
            >
              <span aria-hidden>{k.emoji}</span> {k.label}
            </button>
          );
        })}
      </div>
      <AnimatePresence initial={false}>
        {named && kind && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-2.5 pb-2.5">
            <input
              value={named.title}
              onChange={(e) => onName({ kind: named.kind, title: e.target.value })}
              placeholder={kind.hint}
              maxLength={120}
              className="w-full rounded-xl bg-black/25 px-3.5 py-2.5 text-base text-white outline-none ring-1 ring-white/15 placeholder:text-white/40 focus:ring-[#fa51a2]"
              aria-label="Name it"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

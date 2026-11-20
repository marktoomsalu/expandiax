"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Music2, PartyPopper, Plus, Sparkles, Tent, Ticket, Trophy } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import { photoThumbs } from "@/lib/photoScan";
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
 * "Your memories": the concerts and matches found in their photos as
 * tickets (the surest already kept), and the big days nothing was listed
 * for, each one tap from being named: a race, a wedding, a show.
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
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const asked = useRef(new Set<string>());
  const want = useCallback((id: string | undefined) => {
    if (!id || asked.current.has(id)) return;
    asked.current.add(id);
    void photoThumbs([id], 640).then((got) => setThumbs((prev) => ({ ...prev, ...got })));
  }, []);

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

  return (
    <div className="mx-auto min-h-[100dvh] max-w-md">
      <div className="sticky top-0 z-20 bg-[#1f0822]/85 px-5 pb-3 pt-[calc(0.9rem+env(safe-area-inset-top))] backdrop-blur-xl">
        <p className="font-serif text-2xl">Your memories</p>
        <p className="mt-0.5 text-sm text-white/65">
          <motion.span key={keptCount} className="inline-block font-semibold text-white" initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            {keptCount}
          </motion.span>{" "}
          kept · concerts, matches and big days
        </p>
      </div>

      <div className="space-y-3 px-4 pb-40 pt-3">
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
              Looking for concerts and matches…
            </motion.div>
          )}
        </AnimatePresence>

        {found.map((e, i) => (
          <EventTicket key={e.id} e={e} index={i} thumb={thumbs[e.covers[0]]} kept={isKept(e)} onSeen={() => want(e.covers[0])} onToggle={() => toggle(e.id)} />
        ))}

        {bigDays.length > 0 && (
          <div className="pt-6">
            <h2 className="flex items-center gap-2 px-1 font-serif text-xl">
              <Sparkles size={18} className="text-[#ffb3d6]" aria-hidden /> What was this?
            </h2>
            <p className="mt-0.5 px-1 text-xs text-white/50">Big days in your photos. One tap to keep one.</p>
            <div className="mt-3 space-y-3">
              {bigDays.map((b) => (
                <BigDayCard
                  key={b.id}
                  b={b}
                  thumb={thumbs[b.covers[0]]}
                  named={named[b.id] ?? null}
                  onSeen={() => want(b.covers[0])}
                  onName={(n) =>
                    setNamed((all) => {
                      const next = { ...all };
                      if (n) next[b.id] = n;
                      else delete next[b.id];
                      return next;
                    })
                  }
                />
              ))}
            </div>
          </div>
        )}

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

/** A ticket stub: the night's best photo, a perforation, then who and where. */
function EventTicket({ e, index, thumb, kept, onSeen, onToggle }: { e: FoundEvent; index: number; thumb?: string; kept: boolean; onSeen: () => void; onToggle: () => void }) {
  const reduce = useReducedMotion();
  const meta = EVENT_META[e.type] ?? EVENT_META.other;
  const Icon = meta.icon;
  const where = [e.venue !== e.title ? e.venue : null, e.city].filter(Boolean).join(" · ");
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      onViewportEnter={onSeen}
      aria-pressed={kept}
      aria-label={`${e.title}, ${day(e.date)}${kept ? "" : ", not kept"}`}
      initial={reduce ? false : { opacity: 0, y: 20, rotate: index % 2 ? 1.5 : -1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ delay: reduce ? 0 : Math.min(index, 8) * 0.07, type: "spring", stiffness: 220, damping: 22 }}
      className="relative block w-full text-left"
    >
      <div className={`relative flex h-32 overflow-hidden rounded-2xl bg-gradient-to-br from-[#fff4f9] to-[#ffe9da] text-[#2b0b2e] shadow-[0_14px_30px_-12px_rgba(0,0,0,0.6)] transition-[filter,opacity] duration-300 ${kept ? "" : "opacity-45 grayscale"}`}>
        <div className="relative w-32 shrink-0 bg-[#3a1240]">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-white/70" aria-hidden>
              <Icon size={30} />
            </span>
          )}
        </div>
        {/* The perforation, with a bite out of each edge */}
        <span aria-hidden className="relative w-0 border-l-2 border-dashed border-[#2b0b2e]/20">
          <span className="absolute -left-[9px] -top-2 h-4 w-4 rounded-full bg-[#1f0822]" />
          <span className="absolute -bottom-2 -left-[9px] h-4 w-4 rounded-full bg-[#1f0822]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col justify-center px-4 pr-12">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#d63384]">
            <Icon size={13} aria-hidden /> {meta.label}
            {!e.sure && <span className="rounded-full bg-[#d63384]/10 px-1.5 normal-case tracking-normal">maybe</span>}
          </p>
          <p className="mt-1 truncate font-serif text-xl leading-tight">{e.title}</p>
          <p className="mt-0.5 truncate text-sm text-[#2b0b2e]/65">{where || countryByCode(e.code)?.name}</p>
          <p className="truncate text-xs text-[#2b0b2e]/50">{day(e.date)}</p>
        </div>
      </div>
      <span
        className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full ${kept ? "bg-gradient-to-br from-[#fa51a2] to-[#fb7822] text-white shadow" : "bg-white text-[#2b0b2e] ring-1 ring-[#2b0b2e]/20"}`}
        aria-hidden
      >
        {kept ? <Check size={16} strokeWidth={3} /> : <Plus size={16} />}
      </span>
    </motion.button>
  );
}

function BigDayCard({ b, thumb, named, onSeen, onName }: { b: BigDay; thumb?: string; named: Named | null; onSeen: () => void; onName: (n: Named | null) => void }) {
  const kind = named ? KINDS.find((k) => k.key === named.kind) : null;
  const flag = countryByCode(b.code)?.flag;
  const hours = Math.max(1, Math.round(b.hours));
  return (
    <motion.div
      onViewportEnter={onSeen}
      layout
      className={`overflow-hidden rounded-3xl ring-1 transition-colors ${named ? "bg-white/[0.12] ring-[#fa51a2]" : "bg-white/[0.06] ring-white/10"}`}
    >
      <div className="flex gap-3 p-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#3a1240]">
          {thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1 py-1">
          <p className="truncate font-serif text-lg leading-tight">
            {flag} {b.place ?? b.city ?? countryByCode(b.code)?.name}
          </p>
          <p className="mt-1 text-sm text-white/60">{day(b.date)}</p>
          <p className="text-xs text-white/45">
            {b.photos} photos · {hours} {hours === 1 ? "hour" : "hours"}
          </p>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto px-3 pb-3" role="group" aria-label="What was it?">
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
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm ring-1 transition-colors ${on ? "bg-white text-[#2b0b2e] ring-white" : "bg-white/5 text-white ring-white/20"}`}
            >
              <span aria-hidden>{k.emoji}</span> {k.label}
            </button>
          );
        })}
      </div>
      <AnimatePresence initial={false}>
        {named && kind && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-3 pb-3">
            <input
              value={named.title}
              onChange={(e) => onName({ kind: named.kind, title: e.target.value })}
              placeholder={kind.hint}
              maxLength={120}
              className="w-full rounded-2xl bg-black/25 px-4 py-3 text-base text-white outline-none ring-1 ring-white/15 placeholder:text-white/40 focus:ring-[#fa51a2]"
              aria-label="Name it"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

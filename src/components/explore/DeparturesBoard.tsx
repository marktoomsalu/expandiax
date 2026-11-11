"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { Plane, Plus } from "lucide-react";
import { CountrySearch } from "@/components/CountrySearch";
import { createClient } from "@/lib/supabase/client";
import { tapSuccess } from "@/lib/haptics";

export type BoardRow = {
  code: string;
  flag: string;
  destination: string;
  href: string;
  /** "3 people you follow" / "12 members" / null when nobody's been yet. */
  who: string | null;
  status: "ask" | "dreaming" | "suggested";
};

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const STATUS = { ask: "ASK THEM", dreaming: "DREAMING", suggested: "SUGGESTED" } as const;

/**
 * Text on split-flap tiles, like an airport departures board: on arrival
 * each tile flips through letters before landing on its own, left to right.
 */
function SplitFlap({ text, delay = 0, className }: { text: string; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  const target = text.toUpperCase();
  const [shown, setShown] = useState(reduce ? target : target.replace(/[^ ]/g, " "));

  useEffect(() => {
    if (reduce) {
      setShown(target);
      return;
    }
    let frame = 0;
    const id = window.setInterval(() => {
      frame++;
      const t = frame - delay;
      setShown(
        [...target]
          .map((ch, i) => {
            if (ch === " ") return " ";
            if (t >= i * 1.5 + 6) return ch;
            if (t < 0) return " ";
            return GLYPHS[(frame * 7 + i * 13) % GLYPHS.length];
          })
          .join("")
      );
      if (t >= target.length * 1.5 + 6) window.clearInterval(id);
    }, 45);
    return () => window.clearInterval(id);
  }, [target, delay, reduce]);

  return (
    <span className={className} aria-label={text}>
      {[...shown].map((ch, i) => (
        <span
          key={i}
          aria-hidden
          className="relative mx-[0.5px] inline-flex h-[1.55em] w-[0.86em] items-center justify-center rounded-[3px] bg-[#2a2030] font-mono font-semibold leading-none text-[#fdf3e3] shadow-[inset_0_-1px_0_rgba(0,0,0,0.45)] after:absolute after:inset-x-0 after:top-1/2 after:h-px after:bg-black/50"
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}

/**
 * Explore's opening: your dream destinations on a departures board — who's
 * been to each, and whether there's someone you can ask. With no dreams yet,
 * suggestions from your network, and a nudge to add the first.
 */
export function DeparturesBoard({ rows, seeAll = null }: { rows: BoardRow[]; seeAll?: { href: string; total: number } | null }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const suggesting = rows.every((r) => r.status === "suggested");

  async function addDream(code: string) {
    setBusy(true);
    const { error } = await createClient().from("want_to_go").insert({ country_code: code, place_name: "" });
    setBusy(false);
    if (!error) tapSuccess();
    setAdding(false);
    router.refresh();
  }

  return (
    <section aria-labelledby="dep-h" className="overflow-hidden rounded-2xl bg-[#140d18] text-[#fdf3e3] shadow-xl shadow-black/20 ring-1 ring-black/40">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 id="dep-h" className="flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.3em]">
          <Plane size={14} className="text-accent" aria-hidden /> DEPARTURES
        </h2>
        {seeAll ? (
          <Link href={seeAll.href} className="font-mono text-[10px] font-semibold tracking-[0.2em] text-accent hover:text-white">
            SEE ALL {seeAll.total} →
          </Link>
        ) : (
          <p className="font-mono text-[10px] tracking-[0.2em] text-white/50">{suggesting ? "SUGGESTED FOR YOU" : "YOUR DREAM LIST"}</p>
        )}
      </div>

      {rows.length > 0 && (
        <ul className="divide-y divide-white/[0.07]">
          {rows.map((r, i) => (
            <li key={r.code + r.destination}>
              <Link href={r.href} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.04]">
                <span className="text-2xl" aria-hidden>
                  {r.flag}
                </span>
                <span className="min-w-0 flex-1">
                  <SplitFlap text={r.destination.slice(0, 12)} delay={i * 4} className="block whitespace-nowrap text-[13px] sm:text-sm" />
                  <span className="mt-1 block truncate text-[11px] text-white/55">{r.who ?? "Nobody's been yet - be the first"}</span>
                </span>
                <span
                  className={`shrink-0 rounded-md px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.15em] ${
                    r.status === "ask" ? "bg-accent text-white" : "bg-white/10 text-white/70"
                  }`}
                >
                  {STATUS[r.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-white/10 px-4 py-3">
        {adding ? (
          <div className="rounded-xl bg-surface p-2 text-ink">
            <CountrySearch onSelect={(code) => void addDream(code)} placeholder="Where do you dream of going?" />
            <button type="button" onClick={() => setAdding(false)} disabled={busy} className="mt-1 px-2 py-1 text-xs text-muted hover:text-ink">
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/25 py-2.5 text-sm text-white/80 transition-colors hover:border-accent hover:text-white">
            <Plus size={15} aria-hidden /> {suggesting ? "Add your first dream destination" : "Add a destination"}
          </button>
        )}
      </div>
    </section>
  );
}

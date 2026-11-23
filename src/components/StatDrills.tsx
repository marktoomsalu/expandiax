"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { tapLight } from "@/lib/haptics";

export type DrillItem = { key: string; primary: string; secondary?: string; flag?: string; href?: string };
export type Drill = { title: string; items?: DrillItem[]; groups?: { name: string; color?: string; items: DrillItem[] }[]; empty?: string };
export type StatTile = { key: string; label: string; value: React.ReactNode; detail?: string; drill?: Drill; className?: string };

/**
 * The stats as cards you can open: tap Countries for the countries behind
 * the number, Continents for them by continent, Events for the events, and
 * so on. One open at a time, unfolding right under the row of the card you
 * tapped (with a pointer to it), brought into view, never somewhere further
 * down the page.
 */
export function StatDrills({ tiles, className, initialOpen = null }: { tiles: StatTile[]; className?: string; initialOpen?: string | null }) {
  const [open, setOpen] = useState<string | null>(initialOpen);
  const reduce = useReducedMotion();
  // Two cards a row on a phone, three on a big screen: the panel goes after the row the open card is in.
  const [cols, setCols] = useState(2);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const set = () => setCols(mq.matches ? 3 : 2);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  const panel = useRef<HTMLDivElement>(null);
  const openIndex = tiles.findIndex((t) => t.key === open && t.drill);
  const current = openIndex >= 0 ? tiles[openIndex] : null;
  const rowEnd = openIndex >= 0 ? Math.min(tiles.length - 1, Math.floor(openIndex / cols) * cols + cols - 1) : -1;
  const column = openIndex >= 0 ? openIndex % cols : 0;

  // Opened: brought into view once it has unfolded (only as far as needed).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => panel.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" }), 320);
    return () => clearTimeout(t);
  }, [open, reduce]);

  const cells: React.ReactNode[] = [];
  tiles.forEach((t, i) => {
    const on = open === t.key;
    const body = (
      <>
        <p className="eyebrow flex w-full items-start justify-between gap-2">
          {t.label}
          {t.drill && <ChevronDown size={15} className={cn("shrink-0 transition-transform", on ? "rotate-180 text-accent" : "text-muted")} aria-hidden />}
        </p>
        <p className="stat-number mt-3">{t.value}</p>
        {t.detail && <p className="mt-2 text-sm text-muted">{t.detail}</p>}
      </>
    );
    cells.push(
      t.drill ? (
        <button
          key={t.key}
          type="button"
          onClick={() => {
            tapLight();
            setOpen(on ? null : t.key);
          }}
          aria-expanded={on}
          aria-controls={on ? `drill-${t.key}` : undefined}
          className={cn("card flex flex-col justify-start px-5 py-6 text-left transition-all hover:border-accent/50 active:scale-[0.98]", on && "border-accent ring-1 ring-accent", t.className)}
        >
          {body}
        </button>
      ) : (
        <div key={t.key} className={cn("card flex flex-col justify-start px-5 py-6", t.className)}>
          {body}
        </div>
      )
    );
    if (i === rowEnd && current?.drill) {
      cells.push(
        <AnimatePresence key="drill-panel" initial={false} mode="wait">
          <motion.div
            key={current.key}
            ref={panel}
            id={`drill-${current.key}`}
            className="relative col-span-2 lg:col-span-3"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* A pointer up to the card it belongs to */}
            <span
              aria-hidden
              className="absolute -top-[7px] h-3.5 w-3.5 rotate-45 border-l border-t border-accent bg-surface"
              style={{ left: `calc(${((column + 0.5) / cols) * 100}% - 7px)` }}
            />
            <DrillPanel drill={current.drill} onClose={() => setOpen(null)} />
          </motion.div>
        </AnimatePresence>
      );
    }
  });

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">{cells}</div>
    </div>
  );
}

const SHOWN = 8;

function DrillPanel({ drill, onClose }: { drill: Drill; onClose: () => void }) {
  const [all, setAll] = useState(false);
  const total = drill.groups ? drill.groups.reduce((n, g) => n + g.items.length, 0) : drill.items?.length ?? 0;
  const cut = !all && total > SHOWN + 2;
  // The first few (all of them once asked), across groups in order.
  let left = cut ? SHOWN : Infinity;
  const take = (items: DrillItem[]) => {
    const out = items.slice(0, Math.max(0, left));
    left -= out.length;
    return out;
  };
  return (
    <section className="card overflow-hidden border-accent/60 px-4 py-4 sm:px-6" aria-label={drill.title}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-serif text-lg">{drill.title}</h3>
        <button type="button" onClick={onClose} className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-ink" aria-label="Close">
          <X size={17} aria-hidden />
        </button>
      </div>
      {drill.groups ? (
        <div className="mt-2 space-y-5">
          {drill.groups.map((g) => {
            const items = take(g.items);
            if (!items.length) return null;
            return (
              <div key={g.name}>
                <p className="flex items-center gap-2 text-sm font-medium">
                  {g.color && <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />}
                  {g.name} <span className="font-normal text-muted">· {g.items.length}</span>
                </p>
                <List items={items} />
              </div>
            );
          })}
        </div>
      ) : drill.items?.length ? (
        <List items={take(drill.items)} />
      ) : (
        <p className="mt-3 text-sm text-muted">{drill.empty ?? "Nothing here yet."}</p>
      )}
      {cut && (
        <button type="button" onClick={() => setAll(true)} className="mt-3 w-full rounded-full border border-line py-2.5 text-sm font-medium hover:border-accent hover:text-accent">
          Show all {total}
        </button>
      )}
    </section>
  );
}

function List({ items }: { items: DrillItem[] }) {
  return (
    <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
      {items.map((i) => {
        const row = (
          <>
            {i.flag && (
              <span className="text-lg leading-none" aria-hidden>
                {i.flag}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{i.primary}</span>
              {i.secondary && <span className="block truncate text-xs text-muted">{i.secondary}</span>}
            </span>
            {i.href && <ChevronRight size={15} className="shrink-0 text-muted" aria-hidden />}
          </>
        );
        return (
          <li key={i.key} className="border-b border-line last:border-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-0">
            {i.href ? (
              <Link href={i.href} className="flex items-center gap-3 py-2.5 hover:text-accent">
                {row}
              </Link>
            ) : (
              <span className="flex items-center gap-3 py-2.5">{row}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

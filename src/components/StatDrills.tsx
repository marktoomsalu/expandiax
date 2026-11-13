"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type DrillItem = { key: string; primary: string; secondary?: string; flag?: string; href?: string };
export type Drill = { title: string; items?: DrillItem[]; groups?: { name: string; color?: string; items: DrillItem[] }[]; empty?: string };
export type StatTile = { key: string; label: string; value: React.ReactNode; detail?: string; drill?: Drill; className?: string };

/**
 * The stats as cards you can open: tap Countries for the countries behind
 * the number, Continents for them by continent, Events for the events, and
 * so on. One open at a time, its list right under the cards.
 */
export function StatDrills({ tiles, className, initialOpen = null }: { tiles: StatTile[]; className?: string; initialOpen?: string | null }) {
  const [open, setOpen] = useState<string | null>(initialOpen);
  const current = tiles.find((t) => t.key === open && t.drill);

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {tiles.map((t) => {
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
          return t.drill ? (
            <button
              key={t.key}
              type="button"
              onClick={() => setOpen(on ? null : t.key)}
              aria-expanded={on}
              className={cn("card flex flex-col justify-start px-5 py-6 text-left transition-colors hover:border-accent/50", on && "border-accent ring-1 ring-accent", t.className)}
            >
              {body}
            </button>
          ) : (
            <div key={t.key} className={cn("card flex flex-col justify-start px-5 py-6", t.className)}>
              {body}
            </div>
          );
        })}
      </div>

      {current?.drill && (
        <section className="card mt-4 px-4 py-4 sm:px-6" aria-label={current.drill.title}>
          <h3 className="font-serif text-lg">{current.drill.title}</h3>
          {current.drill.groups ? (
            <div className="mt-3 space-y-5">
              {current.drill.groups.map((g) => (
                <div key={g.name}>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {g.color && <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />}
                    {g.name} <span className="font-normal text-muted">· {g.items.length}</span>
                  </p>
                  <List items={g.items} />
                </div>
              ))}
            </div>
          ) : current.drill.items?.length ? (
            <List items={current.drill.items} />
          ) : (
            <p className="mt-3 text-sm text-muted">{current.drill.empty ?? "Nothing here yet."}</p>
          )}
        </section>
      )}
    </div>
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

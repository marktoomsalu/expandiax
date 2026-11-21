"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Check, Users } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import { formatDateOrdinal } from "@/lib/utils";
import type { KnownEventHit } from "@/app/api/events/catalog/route";

/**
 * Adding a festival, a match, a race or a conference: real ones whose name
 * matches what's typed (our catalogue, and events other members saved).
 * Tapping one fills in the name, the date and the place.
 */
export function KnownEventPicker({ type, query, picked, onPick }: { type: string; query: string; picked: string | null; onPick: (hit: KnownEventHit) => void }) {
  const [items, setItems] = useState<KnownEventHit[]>([]);
  const q = query.trim();

  useEffect(() => {
    if (q.length < 3) {
      setItems([]);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      void fetch(`/api/events/catalog?type=${encodeURIComponent(type)}&q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d: { items: KnownEventHit[] }) => alive && setItems(d.items ?? []))
        .catch(() => {});
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, type]);

  // Picked one: its name is now the title, so there's nothing more to suggest.
  const visible = items.filter((i) => i.title !== picked || i === items[0]).slice(0, 6);
  if (!visible.length || (picked && picked === q)) return null;

  return (
    <div className="-mt-2 rounded-lg border border-line bg-surface p-2">
      <p className="px-2 pb-1 pt-1 text-xs text-muted">Is it one of these?</p>
      <ul>
        {visible.map((i, n) => {
          const country = countryByCode(i.countryCode);
          const where = [i.venue, i.city, country ? `${country.flag} ${country.name}` : null].filter(Boolean).join(", ");
          return (
            <li key={`${i.title}-${i.startsOn}-${n}`}>
              <button
                type="button"
                onClick={() => onPick(i)}
                className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-accent-soft"
              >
                <span className="mt-0.5 shrink-0 text-accent">{i.members ? <Users size={16} aria-hidden /> : picked === i.title ? <Check size={16} aria-hidden /> : <CalendarDays size={16} aria-hidden />}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{i.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {i.startsOn ? formatDateOrdinal(i.startsOn) : "Every year"}
                    {where ? ` · ${where}` : ""}
                    {i.members ? ` · saved by ${i.members} members` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

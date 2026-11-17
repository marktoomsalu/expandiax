"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type ReminderItem = { id: string; label: string; href: string };

/**
 * "3 countries are waiting for your photos" / "6 events are still waiting
 * for your memories": one chip each that goes straight to adding them, and
 * an × that takes one off the list for good (saved on the row, so every
 * device forgets it; this device remembers it if that can't be saved).
 */
export function ReminderList({
  items,
  icon: Icon,
  title,
  hint,
  table,
  column,
  ariaLabel,
}: {
  items: ReminderItem[];
  icon: LucideIcon;
  title: (count: number) => string;
  hint: string;
  table: "visited_countries" | "events";
  column: "photo_reminder_off" | "memory_reminder_off";
  ariaLabel: string;
}) {
  const router = useRouter();
  const local = `expandiax:${column}`;
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => {
    try {
      setHidden(JSON.parse(localStorage.getItem(local) ?? "[]") as string[]);
    } catch {}
  }, [local]);
  const shown = items.filter((i) => !hidden.includes(i.id));
  if (!shown.length) return null;

  async function skip(item: ReminderItem) {
    setHidden((h) => [...h, item.id]);
    const { error } = await createClient().from(table).update({ [column]: true }).eq("id", item.id);
    if (error) {
      try {
        const before = JSON.parse(localStorage.getItem(local) ?? "[]") as string[];
        localStorage.setItem(local, JSON.stringify([...new Set([...before, item.id])]));
      } catch {}
    } else router.refresh();
  }

  return (
    <section aria-label={ariaLabel} className="flex gap-3 rounded-2xl border border-accent/25 bg-accent-soft/40 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Icon size={17} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title(shown.length)}</p>
        <p className="text-xs text-muted">{hint}</p>
        <ul className="no-scrollbar -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
          {shown.slice(0, 12).map((i) => (
            <li key={i.id} className="flex shrink-0 items-center rounded-full border border-line bg-surface text-xs">
              <Link href={i.href} className="max-w-[11rem] truncate py-1.5 pl-3 pr-1 hover:text-accent">
                {i.label}
              </Link>
              <button
                type="button"
                onClick={() => void skip(i)}
                aria-label={`Remove ${i.label} from this list`}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-ink"
              >
                <X size={13} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImagePlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type ReminderCountry = { id: string; code: string; label: string; href: string };

const LOCAL = "expandiax:photo-reminder-off";
function locallyOff(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/**
 * On My World, while some countries have no photos: "3 countries are
 * waiting for your photos", one chip each that goes straight to adding them
 * (the latest trip's photos, or a new trip). Not every country needs photos:
 * the × takes one off the list for good.
 */
export function PhotoReminder({ countries }: { countries: ReminderCountry[] }) {
  const router = useRouter();
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => setHidden(locallyOff()), []);
  const shown = countries.filter((c) => !hidden.includes(c.id));
  if (!shown.length) return null;

  async function skip(c: ReminderCountry) {
    setHidden((h) => [...h, c.id]);
    const { error } = await createClient().from("visited_countries").update({ photo_reminder_off: true }).eq("id", c.id);
    // Until the database knows the setting, this device remembers it.
    if (error) {
      try {
        localStorage.setItem(LOCAL, JSON.stringify([...new Set([...locallyOff(), c.id])]));
      } catch {}
    } else router.refresh();
  }

  return (
    <section aria-label="Countries waiting for photos" className="mt-6 flex gap-3 rounded-2xl border border-accent/25 bg-accent-soft/40 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
        <ImagePlus size={17} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{shown.length === 1 ? "1 country is waiting for your photos" : `${shown.length} countries are waiting for your photos`}</p>
        <p className="text-xs text-muted">Tap one to add photos. Not adding any? Tap &times; and it leaves this list.</p>
        <ul className="no-scrollbar -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
          {shown.slice(0, 12).map((c) => (
            <li key={c.id} className="flex shrink-0 items-center rounded-full border border-line bg-surface text-xs">
              <Link href={c.href} className="flex max-w-[11rem] items-center gap-1 py-1.5 pl-3 pr-1.5 hover:text-accent">
                <span className="truncate">{c.label}</span>
                <span aria-hidden className="text-accent">+</span>
              </Link>
              <button
                type="button"
                onClick={() => void skip(c)}
                aria-label={`Not adding photos to ${c.label.replace(/^\S+\s/, "")}`}
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

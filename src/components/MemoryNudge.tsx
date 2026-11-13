import Link from "next/link";
import { Camera } from "lucide-react";

export type NudgeItem = { key: string; label: string; href: string };

/**
 * On your own profile, only while something's missing: "3 countries are
 * waiting for your photos", "2 events still need their memories", each
 * with a way straight to the one to finish.
 */
export function MemoryNudge({ countries, events }: { countries: NudgeItem[]; events: NudgeItem[] }) {
  if (!countries.length && !events.length) return null;
  const line = (items: NudgeItem[], text: string) =>
    items.length > 0 && (
      <div className="mt-2.5 first:mt-0">
        <p className="text-sm font-medium">{text}</p>
        <ul className="no-scrollbar -mx-4 mt-1.5 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
          {items.slice(0, 8).map((i) => (
            <li key={i.key} className="shrink-0">
              <Link href={i.href} className="inline-flex max-w-[11rem] items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-xs hover:border-accent hover:text-accent">
                <span className="truncate">{i.label}</span>
                <span aria-hidden className="text-accent">+</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  return (
    <section aria-label="Memories to finish" className="mt-8 flex gap-3 rounded-2xl border border-accent/25 bg-accent-soft/40 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Camera size={17} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        {line(countries, countries.length === 1 ? "1 country is waiting for your photos" : `${countries.length} countries are waiting for your photos`)}
        {line(events, events.length === 1 ? "1 event still needs its memories" : `${events.length} events still need their memories`)}
      </div>
    </section>
  );
}

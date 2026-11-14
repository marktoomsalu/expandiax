import Link from "next/link";
import { Camera } from "lucide-react";

export type NudgeItem = { key: string; label: string; href: string };

/**
 * On your Events page, only while something's missing: "6 events are still
 * waiting for your memories", each with a way straight to the one to finish.
 */
export function MemoryNudge({ events, className = "mt-8" }: { events: NudgeItem[]; className?: string }) {
  if (!events.length) return null;
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
    <section aria-label="Memories to finish" className={`${className} flex gap-3 rounded-2xl border border-accent/25 bg-accent-soft/40 p-4`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Camera size={17} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        {line(events, events.length === 1 ? "1 event is still waiting for your memories" : `${events.length} events are still waiting for your memories`)}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import type { Prompt } from "@/lib/together";
import type { TogetherPerson } from "@/lib/togetherData";
import { formatDate } from "@/lib/utils";
import { IWasThereButton } from "./IWasThereButton";
import { Avatar } from "./TogetherCards";

const STORAGE_KEY = "expandiax:together-not-me";

function readDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function why(p: Prompt): string {
  const country = countryByCode(p.event.country_code);
  if (p.reason === "trip") return `You were in ${country?.name ?? "that country"} then`;
  if (p.reason === "artist") return `You've seen ${p.event.spotify_artist_name ?? "them"} live`;
  return `In ${country?.name ?? "your country"}`;
}

function writeDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids].slice(-500)));
  } catch {}
}

const UNDO_MS = 6000;

/**
 * "Were you there too?" — only for events you could plausibly have been at
 * (see findTogether). The X hides one on this device; for a few seconds
 * its place shows Undo, in case it was a slip.
 */
export function TogetherPrompts({ prompts, people, limit }: { prompts: Prompt[]; people: Record<string, TogetherPerson>; limit: number }) {
  const [dismissed, setDismissed] = useState<Set<string> | null>(null);
  const [undoable, setUndoable] = useState<string | null>(null);
  const undoTimer = useRef<number | undefined>(undefined);
  useEffect(() => setDismissed(readDismissed()), []);
  useEffect(() => () => window.clearTimeout(undoTimer.current), []);

  // Wait for what's been dismissed on this device, so hidden ones don't flash.
  if (!dismissed) return null;
  const shown = prompts.filter((p) => (!dismissed.has(p.event.id) || p.event.id === undoable) && people[p.personId]).slice(0, limit);
  if (shown.length === 0) return null;

  function hide(id: string) {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    writeDismissed(next);
    setUndoable(id);
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndoable(null), UNDO_MS);
  }

  function undo(id: string) {
    const next = new Set(dismissed);
    next.delete(id);
    setDismissed(next);
    writeDismissed(next);
    setUndoable(null);
    window.clearTimeout(undoTimer.current);
  }

  return (
    <ul className="space-y-3">
      {shown.map((p) => {
        const person = people[p.personId];
        const e = p.event;
        const where = [e.venue, e.city || countryByCode(e.country_code)?.name].filter(Boolean).join(", ");
        if (dismissed.has(e.id)) {
          return (
            <li key={e.id} className="flex items-center justify-between rounded-card border border-dashed border-line px-4 py-2.5 text-sm text-muted">
              <span>Hidden</span>
              <button type="button" onClick={() => undo(e.id)} className="font-medium text-accent hover:underline">
                Undo
              </button>
            </li>
          );
        }
        return (
          <li key={e.id} className="card relative p-3.5">
            <button
              type="button"
              onClick={() => hide(e.id)}
              aria-label={`Hide ${e.title}`}
              className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-ink"
            >
              <X size={17} aria-hidden />
            </button>
            <div className="flex items-start gap-3 pr-7">
              <Avatar person={person} size={36} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{person.display_name.split(" ")[0]}</span> was at
                </p>
                <p className="truncate font-serif text-lg leading-snug">{e.title}</p>
                <p className="truncate text-xs text-muted">
                  {formatDate(e.event_date)}
                  {where ? ` · ${where}` : ""}
                </p>
                <p className="mt-1.5 inline-block rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">{why(p)}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <IWasThereButton
                prefill={{
                  title: e.title,
                  event_type: e.event_type,
                  event_date: e.event_date,
                  venue: e.venue,
                  city: e.city,
                  country_code: e.country_code,
                  country_name: e.country_name ?? countryByCode(e.country_code)?.name ?? "",
                  spotify_artist_id: e.spotify_artist_id,
                  spotify_artist_name: e.spotify_artist_name,
                  spotify_artist_image: e.spotify_artist_image ?? null,
                  from: person.display_name.split(" ")[0],
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

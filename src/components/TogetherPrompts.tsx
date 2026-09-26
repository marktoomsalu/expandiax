"use client";

import { useEffect, useState } from "react";
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

/**
 * "Were you there too?" — only for events you could plausibly have been at
 * (see findTogether). "Not me" hides one on this device.
 */
export function TogetherPrompts({ prompts, people, limit }: { prompts: Prompt[]; people: Record<string, TogetherPerson>; limit: number }) {
  const [dismissed, setDismissed] = useState<Set<string> | null>(null);
  useEffect(() => setDismissed(readDismissed()), []);

  // Wait for what's been dismissed on this device, so hidden ones don't flash.
  if (!dismissed) return null;
  const shown = prompts.filter((p) => !dismissed.has(p.event.id) && people[p.personId]).slice(0, limit);
  if (shown.length === 0) return null;

  function notMe(id: string) {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next].slice(-500)));
    } catch {}
  }

  return (
    <ul className="space-y-3">
      {shown.map((p) => {
        const person = people[p.personId];
        const e = p.event;
        const where = [e.venue, e.city || countryByCode(e.country_code)?.name].filter(Boolean).join(", ");
        return (
          <li key={e.id} className="card p-3.5">
            <div className="flex items-start gap-3">
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
              <button type="button" onClick={() => notMe(e.id)} className="btn-ghost !py-2 text-sm">
                Not me
              </button>
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
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

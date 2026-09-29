"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, Search, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EVENT_TYPES } from "@/lib/events";
import type { EventType } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { SpotifyArtist } from "../ArtistPicker";

const KINDS: EventType[] = ["concert", "festival", "sport", "conference", "other"];

/** An artist to see live, a festival, a race, a conference — something you dream of going to. */
export function AddDreamEvent() {
  const router = useRouter();
  const [type, setType] = useState<EventType>("concert");
  const [query, setQuery] = useState("");
  const [artists, setArtists] = useState<SpotifyArtist[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  // Artists come from Spotify; anything else is added as typed.
  useEffect(() => {
    const q = query.trim();
    if (type !== "concert" || q.length < 2) {
      setArtists([]);
      return;
    }
    const id = ++request.current;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/spotify/search?type=artist&q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { artists?: SpotifyArtist[] };
        if (id === request.current) setArtists((data.artists ?? []).slice(0, 5));
      } catch {
        if (id === request.current) setArtists([]);
      } finally {
        if (id === request.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, type]);

  async function add(name: string, image: string | null = null) {
    const clean = name.trim().slice(0, 120);
    if (!clean) return;
    setError(null);
    const { error: err } = await createClient().from("dream_events").insert({ name: clean, event_type: type, image });
    if (err && err.code !== "23505") {
      setError("Couldn't add that dream. Try again.");
      return;
    }
    setQuery("");
    setArtists([]);
    router.refresh();
  }

  const label = (t: EventType) => EVENT_TYPES.find((e) => e.value === t)?.label ?? t;
  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Kind of event">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setType(k)}
            aria-pressed={type === k}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              type === k ? "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300" : "border-line text-muted hover:text-ink"
            )}
          >
            {label(k)}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void add(query);
        }}
        className="relative mt-2"
      >
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <label htmlFor="dream-event" className="sr-only">Add a dream event</label>
        <input
          id="dream-event"
          className="field !rounded-full !py-2.5 !pl-10 !pr-10 text-sm"
          placeholder={type === "concert" ? "An artist you dream of seeing live" : type === "sport" ? "e.g. Ironman Hawaii, the World Cup final" : type === "festival" ? "e.g. Tomorrowland, Glastonbury" : "Name it"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        {searching && <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-muted" aria-hidden />}
        {query.trim().length >= 2 && (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
            {artists.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => add(a.name, a.image)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm hover:bg-raised">
                  <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-raised">
                    {a.image && <Image src={a.image} alt="" fill sizes="32px" className="object-cover" />}
                  </span>
                  <span className="font-medium">{a.name}</span>
                </button>
              </li>
            ))}
            <li>
              <button type="submit" className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm hover:bg-raised">
                <Sparkles size={14} className="shrink-0 text-violet-500" aria-hidden />
                Dream of &ldquo;{query.trim()}&rdquo; <span className="text-xs text-muted">· {label(type)}</span>
              </button>
            </li>
          </ul>
        )}
      </form>
      {error && <p role="alert" className="mt-2 text-xs text-red-800 dark:text-red-400">{error}</p>}
    </div>
  );
}

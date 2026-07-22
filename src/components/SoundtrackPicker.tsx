"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Music2, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SpotifyEmbed } from "./SpotifyEmbed";

type Track = { id: string; name: string; artist: string; image: string | null };

export function SoundtrackPicker({ countryId, initialTrackId }: { countryId: string; initialTrackId: string | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [trackId, setTrackId] = useState(initialTrackId);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    setError(null);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Search failed.");
        setResults(data.tracks ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not search Spotify.");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  async function selectTrack(t: Track) {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("visited_countries")
      .update({
        spotify_track_id: t.id,
        spotify_track_name: t.name,
        spotify_track_artist: t.artist,
        spotify_track_image: t.image,
      })
      .eq("id", countryId);
    setBusy(false);
    if (err) {
      setError("Could not save that track. Try again.");
      return;
    }
    setTrackId(t.id);
    setQuery("");
    setResults([]);
    router.refresh();
  }

  async function removeTrack() {
    setBusy(true);
    await supabase
      .from("visited_countries")
      .update({ spotify_track_id: null, spotify_track_name: null, spotify_track_artist: null, spotify_track_image: null })
      .eq("id", countryId);
    setBusy(false);
    setTrackId(null);
    router.refresh();
  }

  if (trackId) {
    return (
      <div>
        <SpotifyEmbed trackId={trackId} compact />
        <button type="button" className="mt-2 text-xs text-muted hover:text-red-700" onClick={removeTrack} disabled={busy}>
          Remove soundtrack
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="text"
          placeholder="Search for a song or artist…"
          className="field !py-1.5 pl-8 text-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {searching && <p className="mt-1.5 text-xs text-muted">Searching…</p>}
      {error && <p role="alert" className="mt-1.5 text-xs text-red-800 dark:text-red-400">{error}</p>}
      {results.length > 0 && (
        <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-line bg-surface p-1.5">
          {results.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => selectTrack(t)}
                disabled={busy}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-raised"
              >
                {t.image ? (
                  <Image src={t.image} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded object-cover" />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-raised text-muted">
                    <Music2 size={14} />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate">{t.name}</span>
                  <span className="block truncate text-xs text-muted">{t.artist}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

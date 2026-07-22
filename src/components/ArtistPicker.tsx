"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Search, User } from "lucide-react";

export type SpotifyArtist = { id: string; name: string; image: string | null };

export function ArtistPicker({ value, onChange }: { value: SpotifyArtist | null; onChange: (artist: SpotifyArtist | null) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifyArtist[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        const res = await fetch(`/api/spotify/search?type=artist&q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Search failed.");
        setResults(data.artists ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not search Spotify.");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2">
        {value.image ? (
          <Image src={value.image} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-raised text-muted">
            <User size={16} />
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{value.name}</span>
        <button type="button" className="text-xs text-muted hover:text-red-700" onClick={() => onChange(null)}>
          Remove
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
          placeholder="Search for the artist on Spotify…"
          className="field !py-1.5 pl-8 text-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {searching && <p className="mt-1.5 text-xs text-muted">Searching…</p>}
      {error && <p role="alert" className="mt-1.5 text-xs text-red-800 dark:text-red-400">{error}</p>}
      {results.length > 0 && (
        <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-line bg-surface p-1.5">
          {results.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(a);
                  setQuery("");
                  setResults([]);
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-raised"
              >
                {a.image ? (
                  <Image src={a.image} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-raised text-muted">
                    <User size={14} />
                  </span>
                )}
                <span className="truncate">{a.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

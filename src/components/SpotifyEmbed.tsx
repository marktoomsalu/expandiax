"use client";

import { useState } from "react";
import { Music2, Play } from "lucide-react";

// Spotify's player runs Spotify's own code (and cookies) inside the page.
// It only loads once someone taps play — until then this is a plain card, so
// simply viewing a memory never contacts Spotify.
export function SpotifyEmbed({ trackId, compact }: { trackId: string; compact?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const height = compact ? 80 : 152;

  if (!loaded) {
    return (
      <button
        type="button"
        onClick={() => setLoaded(true)}
        style={{ height }}
        className="flex w-full items-center gap-3 rounded-xl border border-line bg-raised px-4 text-left transition-colors hover:border-accent"
        aria-label="Load the Spotify player for this song"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white">
          <Play size={16} className="translate-x-px fill-white" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Music2 size={14} className="text-accent" aria-hidden /> Play the song
          </span>
          <span className="block text-xs text-muted">Loads Spotify&rsquo;s player</span>
        </span>
      </button>
    );
  }

  return (
    <iframe
      title="Spotify track"
      src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`}
      width="100%"
      height={height}
      style={{ borderRadius: 12, border: 0 }}
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
    />
  );
}

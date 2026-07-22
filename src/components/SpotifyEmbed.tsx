export function SpotifyEmbed({ trackId, compact }: { trackId: string; compact?: boolean }) {
  return (
    <iframe
      title="Spotify track"
      src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`}
      width="100%"
      height={compact ? 80 : 152}
      style={{ borderRadius: 12, border: 0 }}
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
    />
  );
}

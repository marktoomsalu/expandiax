let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getSpotifyToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("not_configured");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("auth_failed");

  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.token;
}

export type SpotifyArtistStats = { followers: number; popularity: number };

/**
 * Spotify's API doesn't expose "monthly listeners" — that figure only
 * exists inside the Spotify app and is deliberately not published via
 * API. Followers and popularity (their own 0-100 ranking metric) are the
 * real, public numbers, so those are what we show. Returns null on any
 * failure (not configured, artist not found, rate limited) so callers can
 * just hide the stat rather than break the page.
 */
export async function getSpotifyArtistStats(artistId: string): Promise<SpotifyArtistStats | null> {
  try {
    const token = await getSpotifyToken();
    const res = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { followers: data.followers?.total ?? 0, popularity: data.popularity ?? 0 };
  } catch {
    return null;
  }
}

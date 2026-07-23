import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSpotifyToken } from "@/lib/spotifyServer";

export const dynamic = "force-dynamic";

type SpotifyImage = { url: string };
type SpotifyTrackArtist = { name: string };
type SpotifyTrack = {
  id: string;
  name: string;
  artists: SpotifyTrackArtist[];
  album: { images: SpotifyImage[] };
};
type SpotifyArtistResult = {
  id: string;
  name: string;
  images: SpotifyImage[];
};

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim();
  const type = request.nextUrl.searchParams.get("type") === "artist" ? "artist" : "track";
  if (!q) return NextResponse.json(type === "artist" ? { artists: [] } : { tracks: [] });

  try {
    const token = await getSpotifyToken();
    const res = await fetch(`https://api.spotify.com/v1/search?type=${type}&limit=8&q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("search_failed");

    const data = await res.json();

    if (type === "artist") {
      const artists = ((data.artists?.items ?? []) as SpotifyArtistResult[]).map((a) => ({
        id: a.id,
        name: a.name,
        image: a.images.at(-1)?.url ?? a.images[0]?.url ?? null,
      }));
      return NextResponse.json({ artists });
    }

    const tracks = ((data.tracks?.items ?? []) as SpotifyTrack[]).map((t) => ({
      id: t.id,
      name: t.name,
      artist: t.artists.map((a) => a.name).join(", "),
      image: t.album.images.at(-1)?.url ?? t.album.images[0]?.url ?? null,
    }));
    return NextResponse.json({ tracks });
  } catch (e) {
    const message = e instanceof Error && e.message === "not_configured" ? "Spotify isn't set up yet." : "Could not search Spotify right now.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";

// Spotify stopped returning preview_url for apps created after Nov 2024
// (confirmed: null for ours), so the 30-second clip that plays under a feed
// post comes from Apple's public iTunes Search API instead, matched by
// track name + artist.

type ItunesResult = {
  trackName: string;
  artistName: string;
  previewUrl?: string;
  artworkUrl100?: string;
  trackViewUrl?: string;
};

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N} ]/gu, "").trim();

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const name = request.nextUrl.searchParams.get("name")?.trim();
  const artist = request.nextUrl.searchParams.get("artist")?.trim() ?? "";
  if (!name) return NextResponse.json({ previewUrl: null });

  try {
    const term = encodeURIComponent(`${name} ${artist.split(",")[0]}`.trim());
    const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=10`, {
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) throw new Error("itunes_failed");
    const results = ((await res.json()).results ?? []) as ItunesResult[];

    const wantName = norm(name);
    const wantArtist = norm(artist.split(",")[0] ?? "");
    const artistOk = (r: ItunesResult) => !wantArtist || norm(r.artistName).includes(wantArtist);
    // Exact title first; then the same title with a suffix like
    // "(Remastered)" or "(feat. X)" — never just any song by that artist.
    const match =
      results.find((r) => r.previewUrl && artistOk(r) && norm(r.trackName) === wantName) ??
      results.find((r) => r.previewUrl && artistOk(r) && norm(r.trackName).startsWith(`${wantName} `));

    // No confident match is better than playing a different song.
    if (!match?.previewUrl) return NextResponse.json({ previewUrl: null }, { headers: { "Cache-Control": "private, max-age=86400" } });

    return NextResponse.json(
      {
        previewUrl: match.previewUrl,
        artworkUrl: match.artworkUrl100?.replace("100x100bb", "120x120bb") ?? null,
        trackUrl: match.trackViewUrl ?? null,
      },
      { headers: { "Cache-Control": "private, max-age=86400" } }
    );
  } catch {
    return NextResponse.json({ previewUrl: null });
  }
}

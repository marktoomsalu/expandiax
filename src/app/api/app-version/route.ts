import { NextResponse } from "next/server";
import { APP_STORE_ID } from "@/lib/appStore";
import { compareVersions } from "@/lib/appVersion";

export const revalidate = 1800;

/**
 * A release we know is out before Apple's public listing says so (it can lag
 * the App Store by hours): the newer of the two counts. 1.2 was released in
 * App Store Connect and downloadable on 25 Nov 2026.
 */
const KNOWN_RELEASE = { version: "1.2", released: "2026-11-25T13:00:00Z" };

/** The iPhone app's current App Store version and when it came out (Apple's public listing, checked every half hour). */
export async function GET() {
  const look = async (country: string) => {
    try {
      const r = await fetch(`https://itunes.apple.com/lookup?id=${APP_STORE_ID}${country ? `&country=${country}` : ""}`, { next: { revalidate: 1800 } });
      const d = (await r.json()) as { results?: { version?: string; currentVersionReleaseDate?: string }[] };
      const v = d.results?.[0];
      return v?.version ? { version: v.version, released: v.currentVersionReleaseDate ?? null } : null;
    } catch {
      return null;
    }
  };
  // Apple's listings update country by country (the US and UK first): the newest one counts.
  const found = (await Promise.all([look(""), look("ee"), look("us"), look("gb")])).filter((v): v is { version: string; released: string | null } => !!v);
  const newest = [...found, KNOWN_RELEASE].sort((a, b) => compareVersions(a.version, b.version)).at(-1) ?? null;
  return NextResponse.json(
    { ios: newest?.version ?? null, iosReleasedAt: newest?.released ?? null },
    { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=600" } }
  );
}

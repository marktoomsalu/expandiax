import { NextResponse } from "next/server";
import { APP_STORE_ID } from "@/lib/appStore";
import { compareVersions } from "@/lib/appVersion";

export const revalidate = 1800;

/** The iPhone app's current App Store version (Apple's public listing, checked every half hour). */
export async function GET() {
  const look = async (country: string) => {
    try {
      const r = await fetch(`https://itunes.apple.com/lookup?id=${APP_STORE_ID}${country ? `&country=${country}` : ""}`, { next: { revalidate: 1800 } });
      const d = (await r.json()) as { results?: { version?: string }[] };
      return d.results?.[0]?.version ?? null;
    } catch {
      return null;
    }
  };
  const found = (await Promise.all([look(""), look("ee")])).filter((v): v is string => !!v);
  const ios = found.sort(compareVersions).at(-1) ?? null;
  return NextResponse.json({ ios }, { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=600" } });
}

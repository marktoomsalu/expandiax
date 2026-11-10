import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CountryGrid } from "@/components/CountryGrid";
import { stockPhotoFor, type StockPhoto } from "@/lib/stockPhotos";
import { visitSortKey } from "@/lib/utils";
import { signMedia } from "@/lib/signedMedia";
import type { CountryMedia, VisitedCountry } from "@/lib/types";

export const metadata = { title: "Countries" };

type VisitLite = { id: string; year: number; visited_from: string | null; visited_to: string | null; cover_media_id: string | null };
type Row = VisitedCountry & { country_media: CountryMedia[]; country_visits: VisitLite[] };

/** Everyone's full list of countries, from the Countries counter on their profile. */
export default async function ProfileCountriesPage({ params }: { params: { username: string } }) {
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", params.username.toLowerCase())
    .maybeSingle();

  if (!profile) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="text-3xl">This world is private.</h1>
        <p className="mt-3 text-sm text-muted">The profile doesn&rsquo;t exist, or its owner keeps it to themselves.</p>
        <Link href="/explore" className="btn-ghost mt-8">Explore public travellers</Link>
      </div>
    );
  }

  // Only what this viewer is allowed to see: row-level security leaves out
  // "Only me" countries and everything when the profile is closed to them.
  const { data } = await signMedia(
    await supabase
      .from("visited_countries")
      .select("*, country_media!country_media_visited_country_id_fkey(*), country_visits(id, year, visited_from, visited_to, cover_media_id)")
      .eq("user_id", profile.id)
  );
  const latest = (c: Row) => c.country_visits.map(visitSortKey).sort().at(-1) ?? c.created_at.slice(0, 10);
  // Countries with their own photos first, then the rest; each group newest trip first.
  const hasPhotos = (c: Row) => c.country_media.some((m) => m.media_type === "image");
  const countries = ((data ?? []) as Row[]).sort(
    (a, b) => Number(hasPhotos(b)) - Number(hasPhotos(a)) || latest(b).localeCompare(latest(a))
  );
  const stock: Record<string, StockPhoto> = {};
  for (const c of countries) {
    if (c.country_media.length) continue;
    const photo = stockPhotoFor(c.country_code, profile.id);
    if (photo) stock[c.country_code] = photo;
  }

  return (
    <div className="mx-auto max-w-shell px-5 py-10">
      <Link href={`/u/${profile.username}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> {profile.display_name}
      </Link>
      <h1 className="mt-4 text-3xl md:text-4xl">{profile.display_name}&rsquo;s countries</h1>
      {countries.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Nothing to show here yet.</p>
      ) : (
        <div className="mt-6">
          <CountryGrid countries={countries} stock={stock} username={profile.username} />
        </div>
      )}
    </div>
  );
}

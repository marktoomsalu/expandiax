import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Flame, Plus, Sparkles, Users } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { flagGradientColors } from "@/lib/flagColors";
import { nearbyConfigured, nearbyEvents } from "@/lib/concerts";
import { nearbyCards } from "@/lib/nearbyCards";
import { trendingLive, type LiveRow } from "@/lib/explore";
import { LIVE_TYPES } from "@/lib/exploreData";
import { stockPhotoFor } from "@/lib/stockPhotos";
import { EventCarousel } from "@/components/EventCarousel";
import { StockImage } from "@/components/StockImage";
import { StockCredit } from "@/components/StockCredit";

export function generateMetadata({ params }: { params: { code: string } }) {
  return { title: countryByCode(params.code)?.name ?? "Explore" };
}

async function UpcomingHere({ code, name }: { code: string; name: string }) {
  if (!nearbyConfigured()) return null;
  const events = await nearbyEvents({ countryCode: code }).catch(() => []);
  if (events.length === 0) return null;
  return (
    <section className="mt-12" aria-labelledby="up-h">
      <h2 id="up-h" className="flex items-center gap-2 text-2xl">
        <Sparkles size={20} className="text-accent" aria-hidden /> Coming up in {name}
      </h2>
      <div className="mt-4">
        <EventCarousel cards={nearbyCards(events, [])} filter label={`Events in ${name}`} />
      </div>
      <p className="mt-2 text-[11px] text-muted">Events from Ticketmaster</p>
    </section>
  );
}

/** A country as ExpandiaX knows it: who's been, what they went to, and what's coming up. */
export default async function CountryHubPage({ params }: { params: { code: string } }) {
  const country = countryByCode(params.code);
  if (!country) notFound();
  const supabase = createClient();
  const viewer = await getAuthUser();

  const [{ data: visits }, { data: liveRows }, { data: mine }] = await Promise.all([
    supabase.from("visited_countries").select("user_id, profiles(username, display_name, avatar_url)").eq("country_code", country.code).limit(500),
    supabase
      .from("events")
      .select("id, user_id, event_type, title, spotify_artist_name, spotify_artist_image, event_date")
      .eq("is_public", true)
      .eq("country_code", country.code)
      .in("event_type", [...LIVE_TYPES])
      .limit(1000),
    viewer ? supabase.from("visited_countries").select("id").eq("user_id", viewer.id).eq("country_code", country.code).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  type P = { username: string; display_name: string; avatar_url: string | null };
  const travellers = (visits ?? [])
    .map((v) => ({ id: v.user_id, p: (Array.isArray(v.profiles) ? v.profiles[0] : v.profiles) as P | null }))
    .filter((t): t is { id: string; p: P } => !!t.p && t.id !== viewer?.id);
  const live = trendingLive((liveRows ?? []) as LiveRow[], { min: 1, limit: 12 });
  const photo = stockPhotoFor(country.code, "explore");
  const [a, b] = flagGradientColors(country.code);

  return (
    <div>
      <div className="relative h-[38vh] min-h-64 w-full overflow-hidden" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
        {photo && <StockImage photo={photo} alt={photo.alt} priority sizes="100vw" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/10" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-3xl px-5 pb-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">{country.continent}</p>
          <h1 className="mt-1 text-5xl drop-shadow">
            {country.flag} {country.name}
          </h1>
          {travellers.length > 0 && (
            <p className="mt-1 text-sm text-white/85">
              {travellers.length + (mine ? 1 : 0)} {travellers.length + (mine ? 1 : 0) === 1 ? "traveller has" : "travellers have"} been here
            </p>
          )}
        </div>
        {photo && (
          <span className="absolute right-4 top-4 rounded-full bg-black/40 px-2.5 py-1.5 backdrop-blur-sm">
            <StockCredit photo={photo} />
          </span>
        )}
      </div>

      <div className="mx-auto max-w-3xl px-5 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/explore" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft size={15} /> Explore
          </Link>
          {viewer &&
            (mine ? (
              <Link href={`/my-world/${country.code.toLowerCase()}`} className="btn-ghost !py-2 text-sm">
                <Check size={15} /> On your map
              </Link>
            ) : (
              <Link href={`/my-world/${country.code.toLowerCase()}`} className="btn-accent !py-2 text-sm">
                <Plus size={15} /> I&rsquo;ve been here
              </Link>
            ))}
        </div>

        {travellers.length > 0 && (
          <section className="mt-10" aria-labelledby="tv-h">
            <h2 id="tv-h" className="flex items-center gap-2 text-2xl">
              <Users size={20} className="text-accent" aria-hidden /> Travellers who&rsquo;ve been
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {travellers.slice(0, 40).map(({ id, p }) => (
                <li key={id}>
                  <Link
                    href={`/u/${p.username}/countries/${country.code.toLowerCase()}`}
                    className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-sm hover:border-accent"
                  >
                    {p.avatar_url ? (
                      <Image src={p.avatar_url} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-raised font-serif text-xs text-muted">{p.display_name.charAt(0)}</span>
                    )}
                    {p.display_name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {live.length > 0 && (
          <section className="mt-12" aria-labelledby="lv-h">
            <h2 id="lv-h" className="flex items-center gap-2 text-2xl">
              <Flame size={20} className="text-accent" aria-hidden /> Nights people logged here
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2.5">
              {live.map((t) => (
                <li key={t.key}>
                  <Link href={`/explore/live/${t.slug}`} className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm hover:border-accent">
                    {t.name}
                    <span className="text-xs text-muted">
                      {t.memories} {t.memories === 1 ? "memory" : "memories"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Suspense fallback={null}>
          <UpcomingHere code={country.code} name={country.name} />
        </Suspense>

        {travellers.length === 0 && live.length === 0 && (
          <p className="mt-10 text-sm text-muted">Nobody has shared {country.name} yet. Been there? Be the first.</p>
        )}
      </div>
    </div>
  );
}

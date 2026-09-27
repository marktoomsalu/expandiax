import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Flame, Globe2, Lock, MapPin, Search, Sparkles, Users } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { RatingStars } from "@/components/Rating";
import { FollowButton } from "@/components/FollowButton";
import { EventCarousel } from "@/components/EventCarousel";
import { ExploreCity } from "@/components/ExploreCity";
import { StockImage } from "@/components/StockImage";
import { COUNTRIES, countryByCode } from "@/lib/countries";
import { eventTypeMeta } from "@/lib/events";
import { flagGradientColors } from "@/lib/flagColors";
import { nearbyConfigured, nearbyEvents } from "@/lib/concerts";
import { nearbyCards } from "@/lib/nearbyCards";
import { whereAmI, type Here } from "@/lib/location";
import { loadExplore, LIVE_TYPES, type ExplorePerson } from "@/lib/exploreData";
import { trendingLive, type LiveRow, type Trending } from "@/lib/explore";
import { stockPhotoFor } from "@/lib/stockPhotos";
import { formatDate } from "@/lib/utils";
import type { ProfileVisibility } from "@/lib/types";

export const metadata = { title: "Explore" };

type ProfileLite = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  visibility?: ProfileVisibility;
};

function Avatar({ p, size = 48 }: { p: { display_name: string; avatar_url: string | null }; size?: number }) {
  return p.avatar_url ? (
    <Image src={p.avatar_url} alt="" width={size} height={size} className="shrink-0 rounded-full border border-line object-cover" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-full border border-line bg-raised font-serif text-lg text-muted" style={{ width: size, height: size }}>
      {p.display_name.charAt(0)}
    </span>
  );
}

function ProfileCard({ p, detail }: { p: ProfileLite; detail: string }) {
  return (
    <Link href={`/u/${p.username}`} className="card group flex items-center gap-4 px-4 py-4">
      <Avatar p={p} />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 font-serif text-lg group-hover:text-accent">
          {p.display_name}
          {p.visibility && p.visibility !== "public" && <Lock size={13} className="shrink-0 text-muted" aria-label="Private account" />}
        </p>
        <p className="truncate text-xs text-muted">{detail}</p>
      </div>
    </Link>
  );
}

function SectionHead({ id, icon: Icon, title, sub, href, cta }: { id: string; icon: typeof Users; title: string; sub?: string; href?: string; cta?: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 id={id} className="flex items-center gap-2 text-2xl">
          <Icon size={20} className="text-accent" aria-hidden /> {title}
        </h2>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {href && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm text-accent hover:underline">
          {cta} <ArrowRight size={14} aria-hidden />
        </Link>
      )}
    </div>
  );
}

function TrendingCard({ t }: { t: Trending }) {
  const Icon = eventTypeMeta(t.type).icon;
  return (
    <Link href={`/explore/live/${t.slug}`} className="card group block w-44 shrink-0 snap-start overflow-hidden sm:w-52">
      <span className="relative block aspect-square w-full overflow-hidden bg-raised">
        {t.image ? (
          <Image src={t.image} alt="" fill sizes="208px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent to-orange-500">
            <Icon size={44} className="text-white/85" aria-hidden />
          </span>
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" aria-hidden />
        <span className="absolute inset-x-0 bottom-0 p-3 text-white">
          <span className="block truncate font-serif text-lg leading-tight">{t.name}</span>
          <span className="block text-[11px] text-white/80">
            {t.memories} memories · {t.people} {t.people === 1 ? "person" : "people"}
          </span>
        </span>
      </span>
    </Link>
  );
}

function PlaceCard({ code, travellers }: { code: string; travellers: number }) {
  const c = countryByCode(code);
  if (!c) return null;
  const photo = stockPhotoFor(code, "explore");
  const [a, b] = flagGradientColors(code);
  return (
    <Link href={`/explore/country/${code.toLowerCase()}`} className="card group block w-40 shrink-0 snap-start overflow-hidden sm:w-48">
      <span className="relative block aspect-[3/4] w-full overflow-hidden" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
        {photo && <StockImage photo={photo} aspect="3:4" sizes="192px" className="transition-transform duration-500 group-hover:scale-105" />}
        <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" aria-hidden />
        <span className="absolute inset-x-0 bottom-0 p-3 text-white">
          <span className="block font-serif text-lg leading-tight">
            {c.flag} {c.name}
          </span>
          <span className="block text-[11px] text-white/80">{travellers} travellers</span>
        </span>
      </span>
    </Link>
  );
}

/** "Happening near …": the same Ticketmaster events as the feed, for the Explore city. */
async function NearbyRow({ here }: { here: Here }) {
  if (!nearbyConfigured()) return null;
  const events = await nearbyEvents(here.where).catch(() => []);
  if (events.length === 0) return null;
  return (
    <section className="mt-10" aria-labelledby="near-h">
      <SectionHead id="near-h" icon={Sparkles} title={`Happening near ${here.place}`} sub="Concerts, sport and shows in the next three months." />
      <div className="mt-4">
        <EventCarousel cards={nearbyCards(events, [])} filter label={`Events near ${here.place}`} />
      </div>
      <p className="mt-2 text-[11px] text-muted">Events from Ticketmaster</p>
    </section>
  );
}

const rail = "no-scrollbar -mx-5 mt-4 flex snap-x gap-3 overflow-x-auto scroll-px-5 px-5 pb-2";

export default async function ExplorePage({ searchParams }: { searchParams?: { q?: string; city?: string; cc?: string; lat?: string; lng?: string } }) {
  const supabase = createClient();
  const q = (searchParams?.q ?? "").trim();
  const viewer = await getAuthUser();
  const { data: me } = viewer ? await supabase.from("profiles").select("home_country_code").eq("id", viewer.id).single() : { data: null };
  const here = whereAmI(me?.home_country_code ?? null, searchParams);
  const picked = here?.source === "picked";

  const [data, { data: recentEvents }, { data: newest }, { data: countRows }, { data: followRows }] = await Promise.all([
    loadExplore(supabase, viewer?.id ?? null, here),
    supabase
      .from("events")
      .select("id, title, subtitle, event_date, city, country_name, rating, profiles(username, display_name)")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("profiles").select("id, username, display_name, avatar_url").eq("visibility", "public").order("created_at", { ascending: false }).limit(30),
    supabase.from("public_country_counts").select("user_id, country_count"),
    viewer ? supabase.from("follows").select("followee_id").eq("follower_id", viewer.id) : Promise.resolve({ data: [] as { followee_id: string }[] }),
  ]);
  const countsByUser = new Map((countRows ?? []).map((r) => [r.user_id, Number(r.country_count)]));
  const following = new Set((followRows ?? []).map((r) => r.followee_id));
  const featured = ((newest ?? []) as ProfileLite[])
    .filter((p) => p.id !== viewer?.id)
    .sort((a, b) => (countsByUser.get(b.id) ?? 0) - (countsByUser.get(a.id) ?? 0))
    .slice(0, 6);

  // Search: people, places and live events.
  let people: ProfileLite[] = [];
  let places: typeof COUNTRIES = [];
  let live: Trending[] = [];
  if (q) {
    // Characters that mean something in a PostgREST filter are dropped from the search text.
    const like = `%${q.replace(/[%_,()*\\:.]/g, " ").trim()}%`;
    // Search isn't limited to public profiles — private accounts should still be
    // findable so they can be requested; their content stays gated regardless.
    const [{ data: byUsername }, { data: byName }, { data: liveRows }] = await Promise.all([
      supabase.from("profiles").select("id, username, display_name, avatar_url, visibility").ilike("username", like).limit(20),
      supabase.from("profiles").select("id, username, display_name, avatar_url, visibility").ilike("display_name", like).limit(20),
      supabase
        .from("events")
        .select("id, user_id, event_type, title, spotify_artist_name, spotify_artist_image, event_date")
        .eq("is_public", true)
        .in("event_type", [...LIVE_TYPES])
        .or(`title.ilike.${like},spotify_artist_name.ilike.${like}`)
        .limit(300),
    ]);
    const map = new Map<string, ProfileLite>();
    for (const p of [...(byUsername ?? []), ...(byName ?? [])] as ProfileLite[]) map.set(p.id, p);
    people = [...map.values()].sort((a, b) => (countsByUser.get(b.id) ?? 0) - (countsByUser.get(a.id) ?? 0));
    const lower = q.toLowerCase();
    places = COUNTRIES.filter((c) => c.name.toLowerCase().includes(lower) || c.capital.toLowerCase() === lower).slice(0, 8);
    live = trendingLive((liveRows ?? []) as LiveRow[], { min: 1, limit: 12 });
  }

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
  const personDetail = (p: ExplorePerson) => `@${p.username} · ${p.countries} ${p.countries === 1 ? "country" : "countries"}`;

  return (
    <div className="mx-auto max-w-shell px-5 py-10 md:py-12">
      <p className="eyebrow">Explore</p>
      <h1 className="mt-2 text-4xl md:text-5xl">Explore your next memory.</h1>
      <p className="mt-3 max-w-xl text-muted">What&rsquo;s on around you, the people whose world overlaps yours, and the nights everyone is logging.</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <ExploreCity place={here?.place ?? null} picked={picked} />
        <form action="/explore" method="GET" className="min-w-[16rem] flex-1 sm:max-w-md">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input type="search" name="q" defaultValue={q} placeholder="Search people, places or artists…" aria-label="Search" className="field !pl-10" />
          </div>
        </form>
      </div>

      {q ? (
        <div className="mt-10 space-y-12">
          {people.length === 0 && places.length === 0 && live.length === 0 && (
            <p className="text-sm text-muted">Nothing matches &ldquo;{q}&rdquo; yet.</p>
          )}
          {places.length > 0 && (
            <section aria-labelledby="sp-h">
              <h2 id="sp-h" className="text-2xl">Places</h2>
              <ul className="mt-4 flex flex-wrap gap-2.5">
                {places.map((c) => (
                  <li key={c.code}>
                    <Link href={`/explore/country/${c.code.toLowerCase()}`} className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm hover:border-accent">
                      <span aria-hidden>{c.flag}</span> {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {live.length > 0 && (
            <section aria-labelledby="sl-h">
              <h2 id="sl-h" className="text-2xl">Artists &amp; events</h2>
              <div className={rail}>
                {live.map((t) => (
                  <TrendingCard key={t.key} t={t} />
                ))}
              </div>
            </section>
          )}
          {people.length > 0 && (
            <section aria-labelledby="sr-h">
              <h2 id="sr-h" className="text-2xl">People</h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {people.map((p) => (
                  <li key={p.id}>
                    <ProfileCard p={p} detail={`@${p.username} · ${countsByUser.get(p.id) ?? 0} countries`} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <>
          {here && (
            <Suspense fallback={null}>
              <NearbyRow here={here} />
            </Suspense>
          )}

          {data.locals.length > 0 && here && (
            <section className="mt-12" aria-labelledby="lo-h">
              <SectionHead
                id="lo-h"
                icon={MapPin}
                title={`Travellers who know ${here.city ?? here.place}`}
                sub={`People who've been here - ask them where to go.`}
              />
              <div className={rail}>
                {data.locals.map((p) => (
                  <Link key={p.id} href={`/u/${p.username}`} className="card group flex w-40 shrink-0 snap-start flex-col items-center px-3 py-5 text-center">
                    <Avatar p={p} size={64} />
                    <span className="mt-2 line-clamp-1 font-serif text-lg group-hover:text-accent">{p.display_name}</span>
                    <span className="text-[11px] text-muted">{p.knows}</span>
                    <span className="mt-0.5 text-[11px] text-muted">{p.countries} countries</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.clickWith.length > 0 ? (
            <section className="mt-12" aria-labelledby="cw-h">
              <SectionHead id="cw-h" icon={Users} title="People you may click with" sub="Their map and nights out overlap yours the most." />
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.clickWith.map((p, i) => (
                  <li key={p.id} className="card flex items-start gap-4 px-4 py-4">
                    <Link href={`/u/${p.username}`} aria-label={p.display_name}>
                      <Avatar p={p} size={56} />
                    </Link>
                    <div className="min-w-0 flex-1">
                      {i === 0 && (
                        <span className="mb-1 inline-block rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">Your travel twin</span>
                      )}
                      <Link href={`/u/${p.username}`} className="block truncate font-serif text-lg hover:text-accent">
                        {p.display_name}
                      </Link>
                      <p className="text-xs text-muted">{personDetail(p)}</p>
                      <p className="mt-1.5 text-xs leading-relaxed">{p.reason}</p>
                      <div className="mt-3">
                        <FollowButton targetId={p.id} visibility={p.visibility} initialFollowing={false} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            featured.length > 0 && (
              <section className="mt-12" aria-labelledby="ft-h">
                <SectionHead id="ft-h" icon={Globe2} title="Featured travellers" />
                <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {featured.map((p) => (
                    <li key={p.id}>
                      <ProfileCard p={p} detail={`@${p.username} · ${countsByUser.get(p.id) ?? 0} countries${following.has(p.id) ? " · following" : ""}`} />
                    </li>
                  ))}
                </ul>
              </section>
            )
          )}

          {data.trending.length > 0 && (
            <section className="mt-12" aria-labelledby="tr-h">
              <SectionHead id="tr-h" icon={Flame} title="Trending memories" sub="The artists and events people are logging most." />
              <div className={rail}>
                {data.trending.map((t) => (
                  <TrendingCard key={t.key} t={t} />
                ))}
              </div>
            </section>
          )}

          {data.places.length > 0 && (
            <section className="mt-12" aria-labelledby="pl-h">
              <SectionHead id="pl-h" icon={Globe2} title="Popular places" sub="Where travellers on ExpandiaX have been." />
              <div className={rail}>
                {data.places.map((p) => (
                  <PlaceCard key={p.code} code={p.code} travellers={p.travellers} />
                ))}
              </div>
            </section>
          )}

          {(recentEvents ?? []).length > 0 && (
            <section className="mt-12" aria-labelledby="cc-h">
              <SectionHead id="cc-h" icon={Sparkles} title="Fresh event memories" />
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(recentEvents ?? []).map((e) => {
                  const p = one(e.profiles as { username: string; display_name: string } | { username: string; display_name: string }[] | null);
                  if (!p) return null;
                  return (
                    <li key={e.id}>
                      <Link href={`/u/${p.username}/events/${e.id}`} className="card group block px-4 py-4">
                        <p className="font-serif text-lg group-hover:text-accent">{e.title}</p>
                        {e.subtitle && <p className="text-sm italic text-muted">{e.subtitle}</p>}
                        <p className="mt-1.5 text-xs text-muted">
                          {formatDate(e.event_date)} · {[e.city, e.country_name].filter(Boolean).join(", ")} · by {p.display_name}
                        </p>
                        <div className="mt-2">
                          <RatingStars value={e.rating} size={13} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

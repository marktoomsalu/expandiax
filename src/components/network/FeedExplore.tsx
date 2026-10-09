import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronRight, Compass, MapPin, Plane } from "lucide-react";
import { RatingStars } from "../Rating";
import { LocalCard, PopularCountryCard, TrendingCard } from "./ExploreCards";
import { loadExplore } from "@/lib/exploreData";
import type { Here } from "@/lib/location";
import { formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { slugify } from "@/lib/explore";
import { stockPhotoFor } from "@/lib/stockPhotos";
import { loadNetworkHome, type PersonCard, type PlaceCard, type TripIdea } from "@/lib/experienceNetworkData";
import { sourcesCredit } from "@/lib/eventSources";
import { loadNetworkEvents, type NetworkEventCard } from "@/lib/networkEvents";
import { flightTo, originFor, type Flight } from "@/lib/flights";
import { FollowButton } from "../FollowButton";
import { PartnerNote, TripLinks } from "../TripLinks";
import { InterestButton } from "./InterestButton";
import { StockImage } from "../StockImage";
import { FaceStack } from "./FaceStack";

const rail = "no-scrollbar -mx-5 mt-4 flex snap-x gap-3 overflow-x-auto px-5 pb-2";

function Head({ id, title, sub, href }: { id: string; title: string; sub: string; href?: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 id={id} className="font-serif text-xl leading-tight">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-muted">{sub}</p>
      </div>
      {href && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 pb-0.5 text-xs font-medium text-accent hover:underline">
          See all <ArrowRight size={13} aria-hidden />
        </Link>
      )}
    </div>
  );
}

/** "5 friends have been here" / "2 people you follow have been here". */
export function placeBeen(p: PlaceCard) {
  if (p.circle === "friends") return `${p.friends.length} ${p.friends.length === 1 ? "friend has" : "friends have"} been here`;
  return `${p.network.length} ${p.network.length === 1 ? "person you follow has" : "people you follow have"} been here`;
}

/** "Prague — 5 friends have been here": big, photo-first. `wide` fills its column, for the full list. */
export function PlaceCardBig({ p, wide = false }: { p: PlaceCard; wide?: boolean }) {
  const country = countryByCode(p.country);
  const stock = p.photo ? null : stockPhotoFor(p.country, p.key);
  return (
    <li className={wide ? "relative" : "relative w-60 shrink-0 snap-start sm:w-64"}>
      <Link
        href={`/explore/place/${p.country.toLowerCase()}/${slugify(p.name)}`}
        className={`group relative block overflow-hidden rounded-2xl bg-[#14110d] shadow-md ring-1 ring-black/5 ${wide ? "aspect-[16/10]" : "aspect-[5/4]"}`}
      >
        {p.photo ? (
          <Image src={p.photo} alt="" fill sizes={wide ? "(min-width: 640px) 336px, 100vw" : "256px"} className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
        ) : stock ? (
          <StockImage photo={stock} aspect={wide ? "16:10" : "5:4"} sizes={wide ? "(min-width: 640px) 336px, 100vw" : "256px"} className="transition-transform duration-700 group-hover:scale-[1.04]" />
        ) : null}
        <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" aria-hidden />
        <span className="absolute inset-x-0 bottom-0 p-3 pr-14 text-white">
          <FaceStack people={p.faces} size={26} className="[&>span]:ring-black/40" />
          <span className="mt-1 block text-[11px] text-white/85">{placeBeen(p)}</span>
          <span className="mt-0.5 block truncate font-serif text-2xl leading-tight">{p.name}</span>
          <span className="block text-xs text-white/85">
            {country?.flag} {country?.name}
          </span>
        </span>
        <span className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink shadow-lg transition-transform group-hover:translate-x-0.5">
          <ChevronRight size={17} aria-hidden />
        </span>
      </Link>
    </li>
  );
}

/** Someone a step ahead of you: where they've been, a glimpse of it, and a follow. */
export function PersonCardWide({ p, wide = false }: { p: PersonCard; wide?: boolean }) {
  const line = [p.headline, ...p.reasons]
    .filter(Boolean)
    .slice(0, 2)
    .map((r) => r!.text)
    .join(" · ");
  return (
    <li className={`flex flex-col rounded-2xl border border-line bg-surface p-3 shadow-sm ${wide ? "" : "w-[17rem] shrink-0 snap-start"}`}>
      <Link href={`/u/${p.username}`} className="group flex items-center gap-3">
        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft font-serif text-lg text-accent">
          {p.avatar_url ? <Image src={p.avatar_url} alt="" fill sizes="48px" className="object-cover" /> : p.display_name.charAt(0)}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-serif text-base leading-tight group-hover:text-accent">{p.display_name}</span>
          <span className="line-clamp-2 text-[11px] leading-snug text-muted">{line}</span>
        </span>
      </Link>
      <div className="mt-2.5 flex items-center gap-1.5">
        {p.photos.map((url) => (
          <span key={url} className="relative h-9 w-11 shrink-0 overflow-hidden rounded-md bg-raised">
            <Image src={url} alt="" fill sizes="44px" className="object-cover" />
          </span>
        ))}
        <span className="ml-auto">
          <FollowButton targetId={p.id} visibility={p.visibility} initialFollowing={false} />
        </span>
      </div>
    </li>
  );
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "Coldplay · Milan — 4 friends interested": an upcoming event, with its date and a ♥. */
export function EventCardSmall({ e, wide = false }: { e: NetworkEventCard; wide?: boolean }) {
  const n = e.friendIds.length;
  const where = [e.venue, e.city].filter(Boolean).join(", ");
  const card = (
    <>
      <span className="relative block aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-accent/60 to-brand-purple">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {e.image && <img src={e.image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}
        <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" aria-hidden />
        <span className="absolute left-2 top-2 flex flex-col items-center rounded-lg bg-black/70 px-2 py-1 leading-none text-white backdrop-blur">
          <span className="text-[9px] font-bold tracking-wider text-accent">{MONTHS[Number(e.date.slice(5, 7)) - 1]}</span>
          <span className="mt-0.5 text-base font-semibold">{Number(e.date.slice(8, 10))}</span>
        </span>
      </span>
      <span className="block p-2.5">
        <span className="line-clamp-1 font-serif text-base leading-tight">{e.name}</span>
        {where && (
          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
            <MapPin size={11} className="shrink-0" aria-hidden />
            <span className="truncate">{where}</span>
          </span>
        )}
        {(n > 0 || e.mine) && (
          <span className="mt-1.5 flex items-center gap-1.5">
            <FaceStack people={e.friends} size={22} />
            <span className="text-[11px] leading-tight text-muted">{n > 0 ? `${n} ${n === 1 ? "friend" : "friends"} interested` : "You're interested"}</span>
          </span>
        )}
      </span>
    </>
  );
  return (
    <li className={`relative overflow-hidden rounded-2xl border border-line bg-surface shadow-sm ${wide ? "" : "w-44 shrink-0 snap-start sm:w-48"}`}>
      {e.url ? (
        <a href={e.url} target="_blank" rel="noopener noreferrer" className="group block">
          {card}
        </a>
      ) : (
        <div className="group block">{card}</div>
      )}
      <span className="absolute right-2 top-2">
        <InterestButton event={e} />
      </span>
    </li>
  );
}

/** "Barcelona · 4 friends": smaller cards, for the next trip. */
export function IdeaCard({ i, flight, wide = false }: { i: TripIdea; flight?: React.ReactNode; wide?: boolean }) {
  const country = countryByCode(i.country);
  if (!country) return null;
  const stock = stockPhotoFor(i.country, "idea");
  const n = i.network || i.people;
  return (
    <li className={wide ? "" : "w-40 shrink-0 snap-start sm:w-44"}>
      <Link href={`/explore/country/${i.country.toLowerCase()}`} className="group relative block aspect-[4/3] overflow-hidden rounded-2xl bg-[#14110d] ring-1 ring-black/5">
        {stock && <StockImage photo={stock} aspect="4:3" sizes="176px" className="transition-transform duration-500 group-hover:scale-105" />}
        <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" aria-hidden />
        <span className="absolute inset-x-0 bottom-0 p-2.5 text-white">
          <span className="block truncate font-serif text-base leading-tight">
            {country.flag} {country.name}
          </span>
          <span className="block text-[11px] text-white/85">
            {n} {i.network ? (n === 1 ? "friend has" : "friends have") : n === 1 ? "traveller has" : "travellers have"} been here
          </span>
          <FaceStack people={i.friends} size={22} className="mt-1 [&>span]:ring-black/40" />
        </span>
      </Link>
      {flight}
      <TripLinks place={country.name} className="mt-1.5" />
    </li>
  );
}

/** "✈︎ from €90" for an idea card, arriving on its own so a slow price never holds up the cards. */
export function IdeaFlight({ origin, country }: { origin: string | null; country: string }) {
  return (
    <Suspense fallback={null}>
      <FlightPill origin={origin} country={country} />
    </Suspense>
  );
}

/** Keeps a city picked on Explore when following a "See all". */
export function cityQuery(here: Here | null) {
  if (here?.source !== "picked" || !("lat" in here.where)) return "";
  const qs = new URLSearchParams({ city: here.place, lat: String(here.where.lat), lng: String(here.where.lng), ...(here.countryCode ? { cc: here.countryCode } : {}) });
  return `?${qs}`;
}

/**
 * The Explore tab — all of Explore on one page: places your friends and
 * your wider network know, what's on near you, people to meet, ideas for
 * your next trip and what everyone's logging. Each row's "See all" opens
 * the full list on a page of its own.
 */
export function FeedExplore({
  viewerId,
  here,
  homeCountry,
  children,
}: {
  viewerId: string;
  here: Here | null;
  homeCountry: string | null;
  children?: React.ReactNode;
}) {
  const supabase = createClient();
  // Everything starts at once; each section shows as soon as its own data is in.
  const home = loadNetworkHome(supabase, viewerId);
  const events = loadNetworkEvents(supabase, viewerId, here?.where ?? null);
  const explore = loadExplore(supabase, viewerId, here);
  const origin = originFor(here?.where ?? null, homeCountry);
  const city = cityQuery(here);

  return (
    <div className="mt-8 space-y-10">
      <Suspense fallback={<RowSkeleton title="Places your friends know" tall />}>
        <PlacesSection home={home} circle="friends" />
      </Suspense>
      <Suspense fallback={null}>
        <PlacesSection home={home} circle="network" />
      </Suspense>
      <Suspense fallback={<RowSkeleton title={here ? `What's on near ${here.place}` : "What's on"} />}>
        <EventsSection events={events} here={here} city={city} />
      </Suspense>
      {children}
      <Suspense fallback={null}>
        <LocalsSection explore={explore} here={here} />
      </Suspense>
      <Suspense fallback={null}>
        <PeopleSection home={home} />
      </Suspense>
      <Suspense fallback={null}>
        <IdeasSection home={home} origin={origin} />
      </Suspense>
      <Suspense fallback={null}>
        <TrendingSection explore={explore} />
      </Suspense>
      <Suspense fallback={null}>
        <PopularSection explore={explore} />
      </Suspense>
      <Suspense fallback={null}>
        <FreshMemories viewerId={viewerId} />
      </Suspense>
      <Suspense fallback={null}>
        <EmptyNote home={home} events={events} />
      </Suspense>
    </div>
  );
}

type Home = Awaited<ReturnType<typeof loadNetworkHome>>;
type Explore = Awaited<ReturnType<typeof loadExplore>>;

/** A quiet stand-in while a row loads, the same size as the real one. */
function RowSkeleton({ title, tall }: { title: string; tall?: boolean }) {
  return (
    <section aria-busy="true" aria-label={`${title}, loading`}>
      <p className="font-serif text-xl leading-tight text-muted">{title}</p>
      <div className="-mx-5 mt-4 flex gap-3 overflow-hidden px-5 pb-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`block shrink-0 animate-pulse rounded-2xl bg-raised ${tall ? "h-48 w-60" : "h-52 w-44"}`} />
        ))}
      </div>
    </section>
  );
}

export const PLACE_ROWS = {
  friends: { title: "Places your friends know", sub: "Where friends - people you follow who follow you back - have been." },
  network: { title: "Places your network has been to", sub: "Where others you follow have been." },
};

/** Friends' places, or the wider network's — each town in one row only. */
async function PlacesSection({ home, circle }: { home: Promise<Home>; circle: "friends" | "network" }) {
  const data = await home;
  const places = circle === "friends" ? data.friendPlaces : data.networkPlaces;
  if (!places.length) return null;
  const id = `pk-${circle}-h`;
  return (
    <section aria-labelledby={id}>
      <Head id={id} title={PLACE_ROWS[circle].title} sub={PLACE_ROWS[circle].sub} href={`/explore/places${circle === "network" ? "?circle=network" : ""}`} />
      <ul className={rail}>
        {places.map((p) => (
          <PlaceCardBig key={p.key} p={p} />
        ))}
      </ul>
    </section>
  );
}

async function EventsSection({ events: pending, here, city }: { events: Promise<NetworkEventCard[]>; here: Here | null; city: string }) {
  const events = await pending;
  if (!events.length) return null;
  return (
    <section aria-labelledby="evn-h">
      <Head
        id="evn-h"
        title={here ? `What's on near ${here.place}` : "What's on"}
        sub="Concerts, sport and shows - and what people you follow are going to."
        href={`/explore/events${city}`}
      />
      <ul className={rail}>
        {events.slice(0, 12).map((e) => (
          <EventCardSmall key={e.key} e={e} />
        ))}
      </ul>
      {events.some((e) => e.source) && <p className="mt-1 text-[11px] text-muted">{sourcesCredit(events.map((e) => e.source))}</p>}
    </section>
  );
}

async function LocalsSection({ explore, here }: { explore: Promise<Explore>; here: Here | null }) {
  const { locals } = await explore;
  if (!here || locals.length === 0) return null;
  return (
    <section aria-labelledby="lo-h">
      <Head id="lo-h" title={`Travellers who know ${here.city ?? here.place}`} sub="People who've been here - ask them where to go." />
      <div className={rail}>
        {locals.map((p) => (
          <LocalCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}

async function PeopleSection({ home }: { home: Promise<Home> }) {
  const { people } = await home;
  if (!people.length) return null;
  return (
    <section aria-labelledby="osa-h">
      <Head id="osa-h" title="People you may click with" sub="Travellers whose places and events overlap yours." href="/explore/people" />
      <ul className={rail}>
        {people.map((p) => (
          <PersonCardWide key={p.id} p={p} />
        ))}
      </ul>
    </section>
  );
}

async function IdeasSection({ home, origin }: { home: Promise<Home>; origin: string | null }) {
  const { ideas } = await home;
  if (!ideas.length) return null;
  return (
    <section aria-labelledby="idea-h">
      <Head id="idea-h" title="Ideas for your next trip" sub="Countries your network knows - and you don't, yet." href="/explore/ideas" />
      <ul className={rail}>
        {ideas.map((i) => (
          <IdeaCard key={i.country} i={i} flight={<IdeaFlight origin={origin} country={i.country} />} />
        ))}
      </ul>
      <PartnerNote className="mt-1" />
    </section>
  );
}

async function TrendingSection({ explore }: { explore: Promise<Explore> }) {
  const { trending } = await explore;
  if (!trending.length) return null;
  return (
    <section aria-labelledby="tr-h">
      <Head id="tr-h" title="Trending memories" sub="The artists and events people are logging most." href="/explore/trending" />
      <div className={rail}>
        {trending.map((t) => (
          <TrendingCard key={t.key} t={t} />
        ))}
      </div>
    </section>
  );
}

async function PopularSection({ explore }: { explore: Promise<Explore> }) {
  const { places } = await explore;
  if (!places.length) return null;
  return (
    <section aria-labelledby="pl-h">
      <Head id="pl-h" title="Popular places" sub="Where travellers on ExpandiaX have been." />
      <div className={rail}>
        {places.map((p) => (
          <PopularCountryCard key={p.code} code={p.code} travellers={p.travellers} />
        ))}
      </div>
    </section>
  );
}

type FreshEvent = { id: string; title: string; subtitle: string; event_date: string; city: string; country_name: string; rating: number | null; profiles: unknown };

/** The newest public event memories from anyone. */
async function FreshMemories({ viewerId }: { viewerId: string }) {
  const { data } = await createClient()
    .from("events")
    .select("id, title, subtitle, event_date, city, country_name, rating, profiles(username, display_name)")
    .eq("is_public", true)
    .neq("user_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(6);
  const rows = ((data ?? []) as FreshEvent[])
    .map((e) => ({ e, p: (Array.isArray(e.profiles) ? e.profiles[0] : e.profiles) as { username: string; display_name: string } | null }))
    .filter((r) => r.p);
  if (!rows.length) return null;
  return (
    <section aria-labelledby="cc-h">
      <Head id="cc-h" title="Fresh event memories" sub="What people have just added." />
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map(({ e, p }) => (
          <li key={e.id}>
            <Link href={`/u/${p!.username}/events/${e.id}`} className="card group block px-4 py-4">
              <p className="font-serif text-lg group-hover:text-accent">{e.title}</p>
              {e.subtitle && <p className="text-sm italic text-muted">{e.subtitle}</p>}
              <p className="mt-1.5 text-xs text-muted">
                {formatDate(e.event_date)} · {[e.city, e.country_name].filter(Boolean).join(", ")} · by {p!.display_name}
              </p>
              <div className="mt-2">
                <RatingStars value={e.rating} size={13} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "✈︎ from €90" — the cheapest return flight from the nearest airport (only city codes are sent). */
async function FlightPill({ origin, country: code }: { origin: string | null; country: string }) {
  const flight: Flight | null = await flightTo(origin, code);
  const country = countryByCode(code);
  if (!flight || !country) return null;
  return (
    <a
      href={flight.url}
      target="_blank"
      rel="sponsored noopener noreferrer"
      aria-label={`Return flights to ${country.name} from ${flight.currency === "EUR" ? "€" : ""}${flight.price} (partner link)`}
      className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
    >
      <Plane size={12} aria-hidden /> from {flight.currency === "EUR" ? "€" : `${flight.currency} `}
      {Math.round(flight.price)}
    </a>
  );
}

async function EmptyNote({ home, events }: { home: Promise<Home>; events: Promise<NetworkEventCard[]> }) {
  const [{ friendPlaces, networkPlaces, people, ideas }, list] = await Promise.all([home, events]);
  if (friendPlaces.length || networkPlaces.length || people.length || ideas.length || list.length) return null;
  return (
    <div className="card flex items-center gap-3 px-4 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Compass size={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">This fills up as people you follow add trips</span>
        <span className="block text-xs text-muted">Meanwhile, search for people and places above.</span>
      </span>
    </div>
  );
}

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Compass, MapPin, Plane } from "lucide-react";
import { loadExplore } from "@/lib/exploreData";
import type { Here } from "@/lib/location";
import { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { slugify } from "@/lib/explore";
import { stockPhotoFor } from "@/lib/stockPhotos";
import { loadDreamBoard, loadNetworkHome, type PersonCard, type PlaceCard, type TripIdea } from "@/lib/experienceNetworkData";
import { featuredEvent } from "@/lib/sponsors";
import { BoardingPass } from "../explore/BoardingPass";
import { DeparturesBoard, type BoardRow } from "../explore/DeparturesBoard";
import { PlacesSwitch } from "../explore/PlacesSwitch";
import { sourcesCredit } from "@/lib/eventSources";
import { loadNetworkEvents, type NetworkEventCard } from "@/lib/networkEvents";
import { flightTo, originFor, type Flight } from "@/lib/flights";
import { FollowButton } from "../FollowButton";
import { PartnerNote, TripLinks } from "../TripLinks";
import { InterestButton } from "./InterestButton";
import { StockImage } from "../StockImage";
import { FaceStack } from "./FaceStack";
import { SuggestedPeopleRow } from "./SuggestedPeopleRow";


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

/**
 * A place as a postcard: the photo in a white frame, tilted a touch, a
 * postmark counting who's been, and the place written underneath. `wide`
 * fills its column (and sits straight), for the full list.
 */
export function PlaceCardBig({ p, wide = false, tilt = 0 }: { p: PlaceCard; wide?: boolean; tilt?: number }) {
  const country = countryByCode(p.country);
  const stock = p.photo ? null : stockPhotoFor(p.country, p.key);
  const n = p.circle === "friends" ? p.friends.length : p.network.length;
  return (
    <li className={wide ? "relative" : "relative w-60 shrink-0 snap-start sm:w-64"} style={wide ? undefined : { transform: `rotate(${tilt}deg)` }}>
      <Link
        href={`/explore/place/${p.country.toLowerCase()}/${slugify(p.name)}`}
        className="group block rounded-xl bg-white p-2 pb-3 shadow-md shadow-black/10 ring-1 ring-black/5 transition-transform duration-300 hover:-translate-y-1 hover:rotate-0 dark:bg-[#f6f1e7]"
      >
        <span className={`relative block overflow-hidden rounded-md bg-[#14110d] ${wide ? "aspect-[16/10]" : "aspect-[5/4]"}`}>
          {p.photo ? (
            <Image src={p.photo} alt="" fill sizes={wide ? "(min-width: 640px) 336px, 100vw" : "256px"} className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
          ) : stock ? (
            <StockImage photo={stock} aspect={wide ? "16:10" : "5:4"} sizes={wide ? "(min-width: 640px) 336px, 100vw" : "256px"} className="transition-transform duration-700 group-hover:scale-[1.04]" />
          ) : null}
          {/* The postmark */}
          <span
            aria-hidden
            className="absolute right-2 top-2 flex h-14 w-14 rotate-12 flex-col items-center justify-center rounded-full border-2 border-dashed border-white/85 text-center font-mono leading-none text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]"
          >
            <span className="text-lg font-bold">{n}</span>
            <span className="mt-0.5 text-[7px] tracking-[0.15em]">{p.circle === "friends" ? (n === 1 ? "FRIEND" : "FRIENDS") : "FOLLOWED"}</span>
            <span className="text-[7px] tracking-[0.15em]">{p.country}</span>
          </span>
        </span>
        <span className="mt-2 flex items-center justify-between gap-2 px-1 text-[#1c1712]">
          <span className="min-w-0">
            <span className="block truncate font-serif text-xl italic leading-tight">{p.name}</span>
            <span className="block truncate text-[11px] text-[#6b6257]">
              {country?.flag} {country?.name} · {placeBeen(p)}
            </span>
          </span>
          <FaceStack people={p.faces} size={24} className="shrink-0" />
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

// A postage stamp's perforated edge: holes punched along the padding, the middle left whole.
const STAMP_EDGE =
  "linear-gradient(#000 0 0) content-box, radial-gradient(circle at 5px 5px, transparent 2.6px, #000 3px) -5px -5px / 10px 10px padding-box";

/** A country for your next trip as a postage stamp: its picture, its name, and how many of your people have been. */
export function IdeaCard({ i, flight, wide = false }: { i: TripIdea; flight?: React.ReactNode; wide?: boolean }) {
  const country = countryByCode(i.country);
  if (!country) return null;
  const stock = stockPhotoFor(i.country, "idea");
  const n = i.network || i.people;
  return (
    <li className={wide ? "" : "w-40 shrink-0 snap-start sm:w-44"}>
      <Link
        href={`/explore/country/${i.country.toLowerCase()}`}
        className="group block bg-white p-[5px] drop-shadow-md transition-transform duration-300 hover:-rotate-2 dark:bg-[#f6f1e7]"
        style={{ WebkitMask: STAMP_EDGE, mask: STAMP_EDGE }}
      >
        <span className="block bg-white p-1.5 dark:bg-[#f6f1e7]">
          <span className="relative block aspect-[4/5] overflow-hidden bg-[#14110d]">
            {stock && <StockImage photo={stock} aspect="4:5" sizes="176px" className="transition-transform duration-500 group-hover:scale-105" />}
            <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" aria-hidden />
            <span className="absolute right-1.5 top-1 font-serif text-lg font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">{n}</span>
            <span className="absolute inset-x-0 bottom-0 p-2 text-white">
              <span className="block truncate font-serif text-base leading-tight">
                {country.flag} {country.name}
              </span>
              <span className="block text-[10px] uppercase tracking-[0.15em] text-white/80">
                {i.network ? (n === 1 ? "friend's been" : "friends been") : n === 1 ? "traveller" : "travellers"}
              </span>
            </span>
          </span>
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
 * The Explore tab, built around where you want to go next: your dream
 * destinations on a departures board, your travel twin's boarding pass,
 * the people who've been where you're dreaming, postcards from your people,
 * stamps for your next trip — and one event, only when it's personal.
 * Everything else is a tap away under "Keep exploring".
 */
export function FeedExplore({
  viewerId,
  here,
  homeCountry,
  me,
}: {
  viewerId: string;
  here: Here | null;
  homeCountry: string | null;
  me: { username: string; display_name: string; avatar_url: string | null };
}) {
  const supabase = createClient();
  // Everything starts at once; each section shows as soon as its own data is in.
  const home = loadNetworkHome(supabase, viewerId);
  const events = loadNetworkEvents(supabase, viewerId, here?.where ?? null);
  const explore = loadExplore(supabase, viewerId, here);
  const board = loadDreamBoard(supabase, viewerId);
  const origin = originFor(here?.where ?? null, homeCountry);
  const city = cityQuery(here);

  return (
    <div className="mt-6 space-y-10">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-[#140d18]" aria-busy="true" aria-label="Departures, loading" />}>
        <Departures board={board} home={home} />
      </Suspense>
      <Suspense fallback={<RowSkeleton title="Suggested for you" />}>
        <SuggestedPeopleRow viewerId={viewerId} />
      </Suspense>
      <Suspense fallback={null}>
        <Twin explore={explore} me={me} />
      </Suspense>
      <Suspense fallback={null}>
        <BeenWhereYouDream board={board} />
      </Suspense>
      <Suspense fallback={<RowSkeleton title="Postcards from your people" tall />}>
        <Postcards home={home} />
      </Suspense>
      <Suspense fallback={null}>
        <IdeasSection home={home} origin={origin} />
      </Suspense>
      <Suspense fallback={null}>
        <OnYourRadar events={events} board={board} homeCountry={homeCountry} />
      </Suspense>
      <KeepExploring city={city} place={here?.place ?? null} />
      <Suspense fallback={null}>
        <EmptyNote home={home} events={events} />
      </Suspense>
    </div>
  );
}

type Home = Awaited<ReturnType<typeof loadNetworkHome>>;
type Explore = Awaited<ReturnType<typeof loadExplore>>;
type Board = Awaited<ReturnType<typeof loadDreamBoard>>;

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

const placeHref = (code: string, place: string) =>
  place ? `/explore/place/${code.toLowerCase()}/${slugify(place)}` : `/explore/country/${code.toLowerCase()}`;

async function Departures({ board: pending, home }: { board: Promise<Board>; home: Promise<Home> }) {
  const board = await pending;
  let rows: BoardRow[];
  if (board.length) {
    rows = board.map((r) => {
      const c = countryByCode(r.code)!;
      const n = r.travellers.length;
      return {
        code: r.code,
        flag: c.flag,
        destination: r.place || c.name,
        href: placeHref(r.code, r.place),
        who: r.network
          ? `${r.network} ${r.network === 1 ? "person you follow has" : "people you follow have"} been`
          : n
            ? `${n} ${n === 1 ? "member has" : "members have"} been`
            : null,
        status: n ? "ask" : "dreaming",
      };
    });
  } else {
    // No dreams yet: places your network knows, to start the list from.
    const { ideas } = await home;
    rows = ideas.slice(0, 4).flatMap((i) => {
      const c = countryByCode(i.country);
      if (!c) return [];
      const n = i.network || i.people;
      return [
        {
          code: c.code,
          flag: c.flag,
          destination: c.name,
          href: placeHref(c.code, ""),
          who: `${n} ${i.network ? (n === 1 ? "person you follow has" : "people you follow have") : n === 1 ? "member has" : "members have"} been`,
          status: "suggested" as const,
        },
      ];
    });
  }
  return <DeparturesBoard rows={rows} seeAll={board.total > rows.length ? { href: "/my-world#dreams-h", total: board.total } : null} />;
}

async function Twin({ explore, me }: { explore: Promise<Explore>; me: { username: string; display_name: string; avatar_url: string | null } }) {
  const { clickWith } = await explore;
  return <BoardingPass me={me} twins={clickWith} />;
}

/** For each dream destination someone's been to: the closest few of them, and their latest trip there. */
async function BeenWhereYouDream({ board: pending }: { board: Promise<Board> }) {
  const rows = (await pending).filter((r) => r.travellers.length > 0).slice(0, 3);
  if (!rows.length) return null;
  return (
    <section aria-labelledby="dream-h">
      <Head id="dream-h" title="Been where you're dreaming" sub="Ask the people who've already been - where to stay, what to skip, when to go." />
      <ul className="mt-4 space-y-3">
        {rows.map((r) => {
          const c = countryByCode(r.code)!;
          const href = placeHref(r.code, r.place);
          return (
            <li key={r.code} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="flex items-center justify-between gap-3 border-b border-dashed border-line px-4 py-2.5">
                <Link href={href} className="min-w-0 truncate font-serif text-lg hover:text-accent">
                  {c.flag} {r.place || c.name}
                </Link>
                <Link href={`/explore/country/${r.code.toLowerCase()}#ask`} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-accent hover:underline">
                  Ask them <ArrowRight size={13} aria-hidden />
                </Link>
              </div>
              <ul className="divide-y divide-line">
                {r.travellers.slice(0, 3).map((t) => {
                  const stay = t.stays[0];
                  return (
                    <li key={t.id}>
                      <Link href={`/u/${t.username}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-raised/60">
                        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft font-serif text-accent">
                          {t.avatar_url ? <Image src={t.avatar_url} alt="" fill sizes="40px" className="object-cover" /> : t.display_name.charAt(0)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            <span className="truncate">{t.display_name}</span>
                            {t.following && <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-px text-[10px] font-semibold text-accent">You follow</span>}
                          </span>
                          {stay && (
                            <span className="block truncate text-xs text-muted">
                              {stay.kind === "lived" ? "Lived there" : stay.when}
                              {stay.places.length ? ` · ${stay.places.slice(0, 3).join(", ")}` : ""}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Tilted postcards and stamps need a little room, most of all on the left
// (and the snap keeps the first one there instead of at the screen's edge).
const postRail = "no-scrollbar -mx-5 mt-3 flex snap-x scroll-pl-7 gap-4 overflow-x-auto pb-4 pl-7 pr-5 pt-4";
const stampRail = "no-scrollbar -mx-5 mt-4 flex snap-x scroll-pl-7 gap-4 overflow-x-auto pb-3 pl-7 pr-5 pt-2";

/** Friends' places and the wider network's, as postcards behind one switch. */
async function Postcards({ home }: { home: Promise<Home> }) {
  const { friendPlaces, networkPlaces } = await home;
  if (!friendPlaces.length && !networkPlaces.length) return null;
  const row = (places: PlaceCard[]) =>
    places.length ? (
      <ul className={postRail}>
        {places.map((p, i) => (
          <PlaceCardBig key={p.key} p={p} tilt={i % 2 ? 1.4 : -1.4} />
        ))}
      </ul>
    ) : null;
  return <PlacesSwitch friends={row(friendPlaces)} network={row(networkPlaces)} />;
}

async function IdeasSection({ home, origin }: { home: Promise<Home>; origin: string | null }) {
  const { ideas } = await home;
  if (!ideas.length) return null;
  return (
    <section aria-labelledby="idea-h">
      <Head id="idea-h" title="Stamps for your passport" sub="Countries your network knows - and you don't, yet." href="/explore/ideas" />
      <ul className={stampRail}>
        {ideas.map((i) => (
          <IdeaCard key={i.country} i={i} flight={<IdeaFlight origin={origin} country={i.country} />} />
        ))}
      </ul>
      <PartnerNote className="mt-1" />
    </section>
  );
}

/**
 * One event, only when it's personal: a partner's featured event for people
 * who dream of (or live in) its country, else one your people are going to.
 */
async function OnYourRadar({ events, board, homeCountry }: { events: Promise<NetworkEventCard[]>; board: Promise<Board>; homeCountry: string | null }) {
  const [list, rows] = await Promise.all([events, board]);
  const featured = featuredEvent({ home: homeCountry, dreams: rows.map((r) => r.code) });
  const personal = list.find((e) => e.friendIds.length > 0 || e.mine);
  const ticket = featured
    ? { label: `Featured · ${featured.partner}`, name: featured.name, date: featured.date, where: [featured.venue, featured.city].filter(Boolean).join(", "), url: featured.url, sponsored: true, friends: [] as PlaceCard["faces"], line: null as string | null }
    : personal
      ? {
          label: "On your radar",
          name: personal.name,
          date: personal.date,
          where: [personal.venue, personal.city].filter(Boolean).join(", "),
          url: personal.url,
          sponsored: false,
          friends: personal.friends,
          line: personal.friendIds.length ? `${personal.friendIds.length} ${personal.friendIds.length === 1 ? "friend" : "friends"} interested` : "You're interested",
        }
      : null;
  if (!ticket) return null;
  const credit = !featured && personal?.source ? sourcesCredit([personal.source]) : null;
  const body = (
    <span className="flex items-stretch">
      <span className="gradient-travel flex w-20 shrink-0 flex-col items-center justify-center text-white">
        <span className="font-mono text-[10px] tracking-[0.2em]">{MONTHS[Number(ticket.date.slice(5, 7)) - 1]}</span>
        <span className="font-serif text-3xl leading-none">{Number(ticket.date.slice(8, 10))}</span>
      </span>
      <span className="relative min-w-0 flex-1 border-l-2 border-dashed border-line px-4 py-3">
        <span className="absolute -left-[9px] -top-2 h-4 w-4 rounded-full bg-canvas" aria-hidden />
        <span className="absolute -bottom-2 -left-[9px] h-4 w-4 rounded-full bg-canvas" aria-hidden />
        <span className="block font-mono text-[9px] tracking-[0.2em] text-muted">{ticket.label.toUpperCase()}</span>
        <span className="mt-0.5 block truncate font-serif text-lg leading-tight">{ticket.name}</span>
        {ticket.where && <span className="block truncate text-xs text-muted">{ticket.where}</span>}
        {ticket.line && (
          <span className="mt-1.5 flex items-center gap-1.5">
            <FaceStack people={ticket.friends} size={20} />
            <span className="text-[11px] text-muted">{ticket.line}</span>
          </span>
        )}
      </span>
    </span>
  );
  return (
    <section aria-label={ticket.label}>
      {ticket.url ? (
        <a href={ticket.url} target="_blank" rel={ticket.sponsored ? "sponsored noopener noreferrer" : "noopener noreferrer"} className="block overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-line transition-shadow hover:shadow-md">
          {body}
        </a>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-line">{body}</div>
      )}
      {credit && <p className="mt-1 text-[11px] text-muted">{credit}</p>}
    </section>
  );
}

/** Everything else Explore has, a tap away instead of more rows. */
function KeepExploring({ city, place }: { city: string; place: string | null }) {
  const links = [
    { href: `/explore/events${city}`, label: place ? `What's on near ${place}` : "What's on near you" },
    { href: "/explore/people", label: "People you may know" },
    { href: "/explore/trending", label: "Trending memories" },
    { href: "/explore/places?circle=network", label: "Places your network knows" },
  ];
  return (
    <section aria-labelledby="more-h">
      <h2 id="more-h" className="font-mono text-[10px] font-semibold tracking-[0.25em] text-muted">
        KEEP EXPLORING
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-sm hover:border-accent">
              {l.label} <ArrowRight size={13} className="text-muted" aria-hidden />
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

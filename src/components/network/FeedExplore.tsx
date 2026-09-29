import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronRight, Compass, MapPin, Plane } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { slugify } from "@/lib/explore";
import { placeKey } from "@/lib/photoPlaces";
import { stockPhotoFor } from "@/lib/stockPhotos";
import { loadNetworkHome, type PersonCard, type PlaceCard, type TripIdea } from "@/lib/experienceNetworkData";
import type { NearbyWhere } from "@/lib/concerts";
import { sourcesCredit } from "@/lib/eventSources";
import { loadNetworkEvents, type NetworkEventCard } from "@/lib/networkEvents";
import { flightTo, originFor, type Flight } from "@/lib/flights";
import { FollowButton } from "../FollowButton";
import { PartnerNote, TripLinks } from "../TripLinks";
import { InterestButton } from "./InterestButton";
import { StockImage } from "../StockImage";
import { DreamButton } from "./DreamButton";
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

const been = (n: number, friends: boolean) => `${n} ${friends ? (n === 1 ? "friend has" : "friends have") : n === 1 ? "traveller has" : "travellers have"} been here`;

/** "Prague — 5 friends have been here": big, photo-first. */
export function PlaceCardBig({ p, dreaming }: { p: PlaceCard; dreaming: boolean }) {
  const country = countryByCode(p.country);
  const stock = p.photo ? null : stockPhotoFor(p.country, p.key);
  const friends = p.network.length > 0;
  return (
    <li className="relative w-60 shrink-0 snap-start sm:w-64">
      <Link
        href={`/explore/place/${p.country.toLowerCase()}/${slugify(p.name)}`}
        className="group relative block aspect-[5/4] overflow-hidden rounded-2xl bg-[#14110d] shadow-md ring-1 ring-black/5"
      >
        {p.photo ? (
          <Image src={p.photo} alt="" fill sizes="256px" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
        ) : stock ? (
          <StockImage photo={stock} aspect="5:4" sizes="256px" className="transition-transform duration-700 group-hover:scale-[1.04]" />
        ) : null}
        <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" aria-hidden />
        <span className="absolute inset-x-0 bottom-0 p-3 pr-14 text-white">
          <FaceStack people={p.faces} size={26} className="[&>span]:ring-black/40" />
          <span className="mt-1 block text-[11px] text-white/85">{been(friends ? p.network.length : p.people.length, friends)}</span>
          <span className="mt-0.5 block truncate font-serif text-2xl leading-tight">{p.name}</span>
          <span className="block text-xs text-white/85">
            {country?.flag} {country?.name}
          </span>
        </span>
        <span className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink shadow-lg transition-transform group-hover:translate-x-0.5">
          <ChevronRight size={17} aria-hidden />
        </span>
      </Link>
      <span className="absolute right-2.5 top-2.5">
        <DreamButton variant="icon" target={{ kind: "place", countryCode: p.country, placeName: p.name, lat: p.lat, lng: p.lng }} initial={dreaming} label={p.name} />
      </span>
    </li>
  );
}

/** Someone a step ahead of you: where they've been, a glimpse of it, and a follow. */
export function PersonCardWide({ p }: { p: PersonCard }) {
  const line = [p.headline, ...p.reasons]
    .filter(Boolean)
    .slice(0, 2)
    .map((r) => r!.text)
    .join(" · ");
  return (
    <li className="flex w-[17rem] shrink-0 snap-start flex-col rounded-2xl border border-line bg-surface p-3 shadow-sm">
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
export function EventCardSmall({ e }: { e: NetworkEventCard }) {
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
    <li className="relative w-44 shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-surface shadow-sm sm:w-48">
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
export function IdeaCard({ i, flight }: { i: TripIdea; flight?: Flight | null }) {
  const country = countryByCode(i.country);
  if (!country) return null;
  const stock = stockPhotoFor(i.country, "idea");
  const n = i.network || i.people;
  return (
    <li className="w-40 shrink-0 snap-start sm:w-44">
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
      {flight && (
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
      )}
      <TripLinks place={country.name} className="mt-1.5" />
    </li>
  );
}

/**
 * The Explore side of the feed: places your friends know, events your
 * network is into (or what's on near you), people a step ahead of you, and
 * ideas for your next trip.
 */
export async function FeedExplore({
  viewerId,
  where,
  place,
  homeCountry,
  children,
}: {
  viewerId: string;
  where: NearbyWhere | null;
  place: string | null;
  homeCountry: string | null;
  children?: React.ReactNode;
}) {
  const supabase = createClient();
  const [{ places, people, ideas, dreams }, events] = await Promise.all([loadNetworkHome(supabase, viewerId), loadNetworkEvents(supabase, viewerId, where)]);
  // The cheapest return flight from the nearest airport to each idea (only city codes are sent).
  const origin = originFor(where, homeCountry);
  const flights = await Promise.all(ideas.map((i) => flightTo(origin, i.country)));
  const dreamed = new Set(dreams.map((w) => `${w.country_code}:${placeKey(w.place_name)}`));
  const empty = !places.length && !people.length && !ideas.length && !events.length;

  return (
    <div className="mt-8 space-y-10">
      {places.length > 0 && (
        <section aria-labelledby="pk-h">
          <Head id="pk-h" title="Places your friends know" sub="Get inspired by places your friends have been to." href="/explore#pl-h" />
          <ul className={rail}>
            {places.map((p) => (
              <PlaceCardBig key={p.key} p={p} dreaming={dreamed.has(`${p.country}:${placeKey(p.name)}`)} />
            ))}
          </ul>
        </section>
      )}

      {events.length > 0 && (
        <section aria-labelledby="evn-h">
          <Head id="evn-h" title="Events your network is into" sub="Concerts, sport, meetups and more." href="/explore#near-h" />
          {place && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted">
              <MapPin size={11} aria-hidden /> Near {place} ·{" "}
              <Link href="/explore" className="font-medium text-accent hover:underline">
                Change
              </Link>
            </p>
          )}
          <ul className={rail}>
            {events.map((e) => (
              <EventCardSmall key={e.key} e={e} />
            ))}
          </ul>
          {events.some((e) => e.source) && <p className="mt-1 text-[11px] text-muted">{sourcesCredit(events.map((e) => e.source))}</p>}
        </section>
      )}

      {people.length > 0 && (
        <section aria-labelledby="osa-h">
          <Head id="osa-h" title="People one step ahead" sub="Meet people with similar travel interests." href="/explore#cw-h" />
          <ul className={rail}>
            {people.map((p) => (
              <PersonCardWide key={p.id} p={p} />
            ))}
          </ul>
        </section>
      )}

      {ideas.length > 0 && (
        <section aria-labelledby="idea-h">
          <Head id="idea-h" title="Ideas for your next trip" sub="Countries your network knows - and you don't, yet." href="/explore#pl-h" />
          <ul className={rail}>
            {ideas.map((i) => (
              <IdeaCard key={i.country} i={i} flight={flights[ideas.indexOf(i)]} />
            ))}
          </ul>
          <PartnerNote className="mt-1" />
        </section>
      )}

      {empty && (
        <Link href="/explore" className="card flex items-center gap-3 px-4 py-4 transition-shadow hover:shadow-md">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Compass size={18} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">This fills up as people you follow add trips</span>
            <span className="block text-xs text-muted">Meanwhile, see where travellers on ExpandiaX have been.</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
        </Link>
      )}

      {children}
    </div>
  );
}

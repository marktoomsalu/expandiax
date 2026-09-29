import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronRight, Compass } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { slugify } from "@/lib/explore";
import { placeKey } from "@/lib/photoPlaces";
import { stockPhotoFor } from "@/lib/stockPhotos";
import { loadNetworkHome, type PersonCard, type PlaceCard, type TripIdea } from "@/lib/experienceNetworkData";
import { FollowButton } from "../FollowButton";
import { StockImage } from "../StockImage";
import { DreamButton } from "./DreamButton";
import { FaceStack } from "./FaceStack";

const rail = "no-scrollbar -mx-5 mt-4 flex snap-x gap-3 overflow-x-auto px-5 pb-2";

function Head({ id, title, sub, href }: { id: string; title: string; sub: string; href?: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 id={id} className="font-serif text-2xl leading-tight">
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-muted">{sub}</p>
      </div>
      {href && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 pb-0.5 text-sm font-medium text-accent hover:underline">
          See all <ArrowRight size={14} aria-hidden />
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
    <li className="relative w-64 shrink-0 snap-start sm:w-72">
      <Link
        href={`/explore/place/${p.country.toLowerCase()}/${slugify(p.name)}`}
        className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-[#14110d] shadow-lg ring-1 ring-black/5"
      >
        {p.photo ? (
          <Image src={p.photo} alt="" fill sizes="288px" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
        ) : stock ? (
          <StockImage photo={stock} aspect="4:5" sizes="288px" className="transition-transform duration-700 group-hover:scale-[1.04]" />
        ) : null}
        <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" aria-hidden />
        <span className="absolute inset-x-0 bottom-0 p-4 pr-16 text-white">
          <FaceStack people={p.faces} size={30} className="[&>span]:ring-black/40" />
          <span className="mt-1.5 block text-xs text-white/85">{been(friends ? p.network.length : p.people.length, friends)}</span>
          <span className="mt-1 block truncate font-serif text-3xl leading-none">{p.name}</span>
          <span className="mt-1 block text-sm text-white/85">
            {country?.flag} {country?.name}
          </span>
        </span>
        <span className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-lg transition-transform group-hover:translate-x-0.5">
          <ChevronRight size={20} aria-hidden />
        </span>
      </Link>
      <span className="absolute right-3 top-3">
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
    <li className="flex w-72 shrink-0 snap-start flex-col rounded-2xl border border-line bg-surface p-3.5 shadow-sm">
      <Link href={`/u/${p.username}`} className="group flex items-center gap-3">
        <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft font-serif text-xl text-accent">
          {p.avatar_url ? <Image src={p.avatar_url} alt="" fill sizes="56px" className="object-cover" /> : p.display_name.charAt(0)}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-serif text-lg leading-tight group-hover:text-accent">{p.display_name}</span>
          <span className="line-clamp-2 text-xs leading-snug text-muted">{line}</span>
        </span>
      </Link>
      <div className="mt-3 flex items-center gap-2">
        {p.photos.map((url) => (
          <span key={url} className="relative h-11 w-14 shrink-0 overflow-hidden rounded-lg bg-raised">
            <Image src={url} alt="" fill sizes="56px" className="object-cover" />
          </span>
        ))}
        <span className="ml-auto">
          <FollowButton targetId={p.id} visibility={p.visibility} initialFollowing={false} />
        </span>
      </div>
    </li>
  );
}

/** "Barcelona · 4 friends": smaller cards, for the next trip. */
export function IdeaCard({ i }: { i: TripIdea }) {
  const country = countryByCode(i.country);
  if (!country) return null;
  const stock = stockPhotoFor(i.country, "idea");
  const n = i.network || i.people;
  return (
    <li className="w-36 shrink-0 snap-start sm:w-40">
      <Link href={`/explore/country/${i.country.toLowerCase()}`} className="group relative block aspect-[3/4] overflow-hidden rounded-2xl bg-[#14110d] ring-1 ring-black/5">
        {stock && <StockImage photo={stock} aspect="3:4" sizes="160px" className="transition-transform duration-500 group-hover:scale-105" />}
        <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" aria-hidden />
        <span className="absolute inset-x-0 bottom-0 p-3 text-white">
          <span className="block truncate font-serif text-lg leading-tight">
            {country.flag} {country.name}
          </span>
          <span className="block text-xs text-white/85">
            {n} {i.network ? (n === 1 ? "friend" : "friends") : n === 1 ? "traveller" : "travellers"}
          </span>
          <FaceStack people={i.friends} size={24} className="mt-1.5 [&>span]:ring-black/40" />
        </span>
      </Link>
    </li>
  );
}

/**
 * The Explore side of the feed: places your friends know, people a step
 * ahead of you, and ideas for your next trip — then what's coming up.
 */
export async function FeedExplore({ viewerId, children }: { viewerId: string; children?: React.ReactNode }) {
  const supabase = createClient();
  const { places, people, ideas, dreams } = await loadNetworkHome(supabase, viewerId);
  const dreamed = new Set(dreams.map((w) => `${w.country_code}:${placeKey(w.place_name)}`));
  const empty = !places.length && !people.length && !ideas.length;

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
              <IdeaCard key={i.country} i={i} />
            ))}
          </ul>
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

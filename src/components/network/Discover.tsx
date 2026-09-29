import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronRight, MapPin, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { slugify } from "@/lib/explore";
import { placeKey } from "@/lib/photoPlaces";
import { stockPhotoFor } from "@/lib/stockPhotos";
import { loadNetworkHome, type Interest, type PlaceCard } from "@/lib/experienceNetworkData";
import { StockImage } from "../StockImage";
import { FaceStack } from "./FaceStack";
import { PeopleToMeet } from "./PeopleToMeet";
import { WantToGoButton } from "./WantToGoButton";

const placeHref = (country: string, town: string | null) =>
  town ? `/explore/place/${country.toLowerCase()}/${slugify(town)}` : `/explore/country/${country.toLowerCase()}`;

function Head({ id, title, href }: { id: string; title: string; href?: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 id={id} className="font-serif text-2xl">
        {title}
      </h2>
      {href && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent hover:underline">
          See all <ArrowRight size={14} aria-hidden />
        </Link>
      )}
    </div>
  );
}

/** "Because you're interested in Italy — Bologna": one place, big, to start from. */
export function InterestHero({ i }: { i: Interest }) {
  const country = countryByCode(i.country);
  if (!country) return null;
  const stock = i.photo ? null : stockPhotoFor(i.country, i.town ?? "hero");
  const parts = [
    i.people > 0 && `${i.people.toLocaleString("en-GB")} ${i.people === 1 ? "person" : "people"}`,
    i.places > 0 && `${i.places.toLocaleString("en-GB")} ${i.places === 1 ? "place" : "places"}`,
    i.events > 0 && `${i.events.toLocaleString("en-GB")} ${i.events === 1 ? "event" : "events"}`,
  ].filter(Boolean) as string[];
  const line = parts.length ? `Discover ${parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0]}` : `See who's been to ${i.town ?? country.name}`;
  return (
    <Link href={placeHref(i.country, i.town)} className="group relative block h-56 overflow-hidden rounded-2xl bg-[#14110d] shadow-lg ring-1 ring-black/5 sm:h-64">
      {i.photo ? (
        <Image src={i.photo} alt="" fill priority sizes="(min-width: 768px) 672px, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
      ) : stock ? (
        <StockImage photo={stock} priority sizes="(min-width: 768px) 672px, 100vw" className="transition-transform duration-700 group-hover:scale-[1.03]" />
      ) : null}
      <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" aria-hidden />
      <span className="absolute inset-x-0 bottom-0 p-5 pr-16 text-white">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
          {i.why === "want" ? `Because you want to go to ${country.name}` : `Popular with your network · ${country.flag} ${country.name}`}
        </span>
        <span className="mt-1 block font-serif text-4xl leading-none drop-shadow">{i.town ?? country.name}</span>
        <span className="mt-2 block text-sm text-white/85">{line}</span>
      </span>
      <span className="absolute bottom-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-lg transition-transform group-hover:translate-x-0.5">
        <ChevronRight size={20} aria-hidden />
      </span>
    </Link>
  );
}

export function PlaceForYou({ p, wanted }: { p: PlaceCard; wanted: boolean }) {
  const country = countryByCode(p.country);
  const stock = p.photo ? null : stockPhotoFor(p.country, p.key);
  const n = p.network.length || p.people.length;
  return (
    <li className="relative w-44 shrink-0 snap-start sm:w-52">
      <Link href={placeHref(p.country, p.name)} className="group block overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <span className="relative block aspect-[4/3] w-full overflow-hidden bg-raised">
          {p.photo ? (
            <Image src={p.photo} alt="" fill sizes="208px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : stock ? (
            <StockImage photo={stock} aspect="4:3" sizes="208px" className="transition-transform duration-500 group-hover:scale-105" />
          ) : null}
        </span>
        <span className="block p-3">
          <span className="block truncate font-serif text-lg leading-tight">{p.name}</span>
          <span className="block truncate text-xs text-muted">
            {country?.flag} {country?.name}
          </span>
          <span className="mt-2 flex items-center gap-2">
            <FaceStack people={p.faces} size={24} />
            <span className="text-[11px] leading-tight text-muted">
              {n} {n === 1 ? "person" : "people"}
              {p.network.length ? " from your network" : ""} {n === 1 ? "has" : "have"} been here
            </span>
          </span>
        </span>
      </Link>
      <span className="absolute right-2 top-2">
        <WantToGoButton variant="icon" countryCode={p.country} placeName={p.name} lat={p.lat} lng={p.lng} initial={wanted} label={p.name} />
      </span>
    </li>
  );
}

/**
 * The experience network, in the feed: a place to start, places your
 * network has been, and people worth meeting — with why.
 */
export async function Discover({ viewerId }: { viewerId: string }) {
  const supabase = createClient();
  const { interest, places, people, want } = await loadNetworkHome(supabase, viewerId);
  if (!interest && !places.length && !people.length) return null;
  const wanted = new Set(want.map((w) => `${w.country_code}:${placeKey(w.place_name)}`));

  return (
    <div className="space-y-10">
      {interest && <InterestHero i={interest} />}

      {places.length > 0 && (
        <section aria-labelledby="pfy-h">
          <Head id="pfy-h" title="Places for you" href="/explore#pl-h" />
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <MapPin size={13} aria-hidden /> Where your network has been - save the ones you want to go to.
          </p>
          <ul className="no-scrollbar -mx-5 mt-4 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
            {places.map((p) => (
              <PlaceForYou key={p.key} p={p} wanted={wanted.has(`${p.country}:${placeKey(p.name)}`)} />
            ))}
          </ul>
        </section>
      )}

      {people.length > 0 && (
        <section aria-labelledby="ptm-h">
          <Head id="ptm-h" title="People you may want to meet" href="/explore#cw-h" />
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <Users size={13} aria-hidden /> They&rsquo;ve been where you&rsquo;ve been - or where you want to go.
          </p>
          <PeopleToMeet people={people} />
        </section>
      )}
    </div>
  );
}

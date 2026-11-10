import Image from "next/image";
import Link from "next/link";
import { Home, Image as ImageIcon } from "lucide-react";
import { stockPhotoFor } from "@/lib/stockPhotos";
import type { CountryPlace } from "@/lib/tripPlaces";
import { PlacesMap } from "./PlacesMap";
import { StockImage } from "./StockImage";

/** "Places in this country": a card per town, and the map. */
export function CountryPlaces({ places, countryCode, hrefFor }: { places: CountryPlace[]; countryCode: string; hrefFor: (cityIds: string[]) => string }) {
  if (places.length === 0) return null;
  const mappedPlaces = places.filter((p) => p.lat != null && p.lng != null);
  return (
    <section aria-labelledby="places-h" className="scroll-mt-24">
      <h2 id="places-h" className="font-serif text-2xl">
        Places in this country
      </h2>
      <ul className="no-scrollbar -mx-5 mt-3 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-2">
        {places.map((p) => {
          const placeStock = p.cover ? null : stockPhotoFor(countryCode, p.cityIds[0]);
          const years = p.from && p.to ? (p.from.slice(0, 4) === p.to.slice(0, 4) ? p.from.slice(0, 4) : `${p.from.slice(0, 4)} – ${p.to.slice(0, 4)}`) : null;
          return (
            <li key={p.key} className="w-44 shrink-0 snap-start sm:w-52">
              <Link href={hrefFor(p.cityIds)} className="group relative block h-52 overflow-hidden rounded-2xl bg-[#14110d] shadow-sm ring-1 ring-black/5">
                {p.cover ? (
                  <Image src={p.cover} alt="" fill sizes="208px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : placeStock ? (
                  <StockImage photo={placeStock} aspect="4:5" sizes="208px" className="opacity-80" />
                ) : null}
                <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" aria-hidden />
                {p.lived && (
                  <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-accent shadow">
                    <Home size={11} aria-hidden /> Lived here
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 p-3 text-white">
                  <span className="block truncate font-serif text-lg leading-tight">{p.name}</span>
                  <span className="block text-xs text-white/80">
                    {p.trips} {p.trips === 1 ? (p.lived ? "stay" : "trip") : p.lived ? "visits" : "trips"}
                    {years ? ` · ${years}` : ""}
                  </span>
                  <span className="mt-1 flex items-center gap-1 text-xs text-white/80">
                    <ImageIcon size={12} aria-hidden /> {p.photos + p.videos}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {mappedPlaces.length > 0 && (
        <PlacesMap
          className="mt-4"
          points={mappedPlaces.map((p) => ({ id: p.key, name: p.name, lat: p.lat!, lng: p.lng!, label: `${p.trips} ${p.trips === 1 ? "visit" : "visits"}` }))}
        />
      )}
    </section>
  );
}

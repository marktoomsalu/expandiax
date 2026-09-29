import Link from "next/link";
import { Sparkles } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import { slugify } from "@/lib/explore";
import { stockPhotoFor } from "@/lib/stockPhotos";
import type { DreamPlaceCard } from "@/lib/dreams";
import { DreamButton } from "../network/DreamButton";
import { FaceStack } from "../network/FaceStack";
import { StockImage } from "../StockImage";
import { AddDream } from "./AddDream";
import { PartnerNote, TripLinks } from "../TripLinks";

function who(d: DreamPlaceCard): string {
  const n = d.friends.length;
  if (n) return `${n} ${n === 1 ? "person you follow has" : "people you follow have"} been`;
  if (d.travellers) return `${d.travellers.toLocaleString("en-GB")} ${d.travellers === 1 ? "traveller has" : "travellers have"} been`;
  return "Nobody you know yet - be the first";
}

/** Your dream places, under your map — and who you know that's been. */
export function DreamPlaces({ dreams }: { dreams: DreamPlaceCard[] }) {
  return (
    <section className="mt-10" aria-labelledby="dreams-h">
      <h2 id="dreams-h" className="flex items-center gap-2 text-xl">
        <Sparkles size={18} className="text-violet-500" aria-hidden /> Dream places
      </h2>
      <p className="mt-1 text-xs text-muted">Where you&rsquo;d love to go - and who you know that&rsquo;s been. Only you see this list.</p>
      <div className="mt-4 max-w-md">
        <AddDream />
      </div>
      {dreams.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Search above, or tap <Sparkles size={13} className="inline text-violet-500" aria-label="Dream" /> on any place in your feed or Explore.
        </p>
      ) : (
        <ul className="no-scrollbar -mx-5 mt-4 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
          {dreams.map((d) => {
            const country = countryByCode(d.country_code);
            const name = d.place_name || country?.name || d.country_code;
            const href = d.place_name ? `/explore/place/${d.country_code.toLowerCase()}/${slugify(d.place_name)}` : `/explore/country/${d.country_code.toLowerCase()}`;
            const photo = stockPhotoFor(d.country_code, d.place_name || "dream");
            return (
              <li key={`${d.country_code}:${d.place_name}`} className="relative w-44 shrink-0 snap-start sm:w-52">
                <Link href={href} className="group block overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                  <span className="relative block aspect-[4/3] w-full overflow-hidden bg-raised">
                    {photo && <StockImage photo={photo} aspect="4:3" sizes="208px" className="transition-transform duration-500 group-hover:scale-105" />}
                  </span>
                  <span className="block p-3">
                    <span className="block truncate font-serif text-lg leading-tight">{name}</span>
                    <span className="block truncate text-xs text-muted">
                      {country?.flag} {d.place_name ? country?.name : "The whole country"}
                    </span>
                    <span className="mt-2 flex items-center gap-2">
                      <FaceStack people={d.friends} size={24} />
                      <span className="text-[11px] leading-tight text-muted">{who(d)}</span>
                    </span>
                  </span>
                </Link>
                <span className="absolute right-2 top-2">
                  <DreamButton variant="icon" target={{ kind: "place", countryCode: d.country_code, placeName: d.place_name }} initial label={name} />
                </span>
                <TripLinks place={d.place_name ? `${d.place_name}, ${country?.name ?? ""}`.replace(/, $/, "") : name} className="mt-1.5" />
              </li>
            );
          })}
        </ul>
      )}
      {dreams.length > 0 && <PartnerNote className="mt-1" />}
    </section>
  );
}

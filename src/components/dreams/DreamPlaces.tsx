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
  if (n === 0) return "Your friends haven\u2019t been here yet. Be the first!";
  return n === 1 ? "1 friend has been" : `${n} friends have been`;
}

/** Your dream places, under your map — and who you know that's been. */
export function DreamPlaces({ dreams }: { dreams: DreamPlaceCard[] }) {
  return (
    <section className="mt-10" aria-labelledby="dreams-h">
      <h2 id="dreams-h" className="flex items-center gap-2 text-xl">
        <Sparkles size={18} className="text-violet-500" aria-hidden /> Dream places
      </h2>
      <p className="mt-1 text-xs text-muted">Every adventure starts with a dream. Only you see this list.</p>
      <div className="mt-4 max-w-md">
        <AddDream />
      </div>
      {dreams.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Search above, or tap <Sparkles size={13} className="inline text-violet-500" aria-label="Dream" /> on any place in your feed or Explore.
        </p>
      ) : (
        <ul className="no-scrollbar -mx-5 mt-4 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-2">
          {dreams.map((d) => {
            const country = countryByCode(d.country_code);
            const name = d.place_name || country?.name || d.country_code;
            const href = d.place_name ? `/explore/place/${d.country_code.toLowerCase()}/${slugify(d.place_name)}` : `/explore/country/${d.country_code.toLowerCase()}`;
            const photo = stockPhotoFor(d.country_code, d.place_name || "dream");
            return (
              <li key={`${d.country_code}:${d.place_name}`} className="relative flex w-44 shrink-0 snap-start flex-col sm:w-52">
                <Link href={href} className="group flex flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                  <span className="relative block aspect-[4/3] w-full overflow-hidden bg-raised">
                    {photo && <StockImage photo={photo} aspect="4:3" sizes="208px" className="transition-transform duration-500 group-hover:scale-105" />}
                  </span>
                  <span className="flex flex-1 flex-col p-3">
                    <span className="flex items-center gap-1.5 font-serif text-lg leading-tight">
                      <span aria-hidden className="shrink-0 font-sans text-base">{country?.flag}</span>
                      <span className="truncate">{name}</span>
                    </span>
                    {/* Two lines kept for this, so every card is the same height. */}
                    <span className="mt-2 flex min-h-[2.25rem] items-center gap-2">
                      <FaceStack people={d.friends} size={24} />
                      <span className="line-clamp-2 text-[11px] leading-tight text-muted">{who(d)}</span>
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

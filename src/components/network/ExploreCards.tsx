import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import { eventTypeMeta } from "@/lib/events";
import { flagGradientColors } from "@/lib/flagColors";
import { stockPhotoFor } from "@/lib/stockPhotos";
import type { Trending } from "@/lib/explore";
import type { Local } from "@/lib/exploreData";
import { StockImage } from "../StockImage";

/** An artist or event everyone's logging. `wide` fills its column, for the full list. */
export function TrendingCard({ t, wide = false }: { t: Trending; wide?: boolean }) {
  const Icon = eventTypeMeta(t.type).icon;
  return (
    <Link href={`/explore/live/${t.slug}`} className={`card group block overflow-hidden ${wide ? "" : "w-44 shrink-0 snap-start sm:w-52"}`}>
      <span className="relative block aspect-square w-full overflow-hidden bg-raised">
        {t.image ? (
          <Image src={t.image} alt="" fill sizes={wide ? "(min-width: 640px) 220px, 50vw" : "208px"} className="object-cover transition-transform duration-500 group-hover:scale-105" />
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

/** A country, with how many travellers have been. */
export function PopularCountryCard({ code, travellers }: { code: string; travellers: number }) {
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

/** Someone who's been to the Explore city — ask them where to go. */
export function LocalCard({ p }: { p: Local }) {
  return (
    <Link href={`/u/${p.username}`} className="card group flex w-40 shrink-0 snap-start flex-col items-center px-3 py-5 text-center">
      {p.avatar_url ? (
        <Image src={p.avatar_url} alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-full border border-line object-cover" />
      ) : (
        <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-line bg-raised font-serif text-lg text-muted">
          {p.display_name.charAt(0)}
        </span>
      )}
      <span className="mt-2 line-clamp-1 font-serif text-lg group-hover:text-accent">{p.display_name}</span>
      <span className="text-[11px] text-muted">{p.knows}</span>
      <span className="mt-0.5 text-[11px] text-muted">{p.countries} countries</span>
    </Link>
  );
}

/** The frame of every "See all" page: back to Explore, a title, then the list. */
export function ExploreListShell({ title, sub, back = "/feed?tab=explore", children }: { title: string; sub?: string; back?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-6">
      <Link href={back} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} aria-hidden /> Explore
      </Link>
      <h1 className="mt-4 text-3xl md:text-4xl">{title}</h1>
      {sub && <p className="mt-1.5 text-sm text-muted">{sub}</p>}
      {children}
    </div>
  );
}

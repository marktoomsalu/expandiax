"use client";

import { useState } from "react";
import Image from "next/image";
import { Drama, Music, Sparkles, Trophy, type LucideIcon } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import { flagGradientColors } from "@/lib/flagColors";
import type { NearbyCategory } from "@/lib/concerts";
import { cn } from "@/lib/utils";
import { ExternalLink } from "./ExternalLink";

export type CarouselCard = {
  id: string;
  title: string;
  date: string; // yyyy-mm-dd
  time?: string | null;
  venue: string;
  city: string;
  countryCode: string | null;
  url: string | null;
  image: string | null;
  category: NearbyCategory;
  priceFrom?: { amount: number; currency: string } | null;
  moreDates?: number;
  badge?: string | null; // e.g. "You've seen them live"
};

const CATEGORY: Record<NearbyCategory, { label: string; icon: LucideIcon }> = {
  music: { label: "Concerts", icon: Music },
  sport: { label: "Sport", icon: Trophy },
  arts: { label: "Theatre & arts", icon: Drama },
  other: { label: "More", icon: Sparkles },
};

const day = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });

function price(p: { amount: number; currency: string }) {
  try {
    return `From ${new Intl.NumberFormat("en-GB", { style: "currency", currency: p.currency, maximumFractionDigits: 0 }).format(p.amount)}`;
  } catch {
    return null;
  }
}

function Card({ card }: { card: CarouselCard }) {
  const country = countryByCode(card.countryCode);
  const Icon = CATEGORY[card.category].icon;
  const [from, to] = flagGradientColors(card.countryCode ?? "EE");
  const priceLabel = card.priceFrom ? price(card.priceFrom) : null;
  const inner = (
    <>
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-raised">
        {card.image ? (
          <Image src={card.image} alt="" fill unoptimized sizes="16rem" className="object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
            <Icon size={34} className="text-white/85" aria-hidden />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" aria-hidden />
        <span className="absolute left-2.5 top-2.5 flex w-11 flex-col items-center rounded-md bg-white/95 py-1 leading-none text-[#14110d] shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">{day(card.date, { month: "short" })}</span>
          <span className="mt-0.5 font-serif text-lg">{Number(card.date.slice(8, 10))}</span>
        </span>
        {card.badge && (
          <span className="absolute bottom-2.5 left-2.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">{card.badge}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
        <p className="line-clamp-2 font-serif text-[17px] leading-snug group-hover:text-accent">{card.title}</p>
        <p className="mt-1 truncate text-xs text-muted">
          {country?.flag} {[card.venue, card.city].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {day(card.date, { weekday: "short" })}
          {card.time ? ` ${card.time}` : ""}
          {card.moreDates ? ` · +${card.moreDates} more ${card.moreDates === 1 ? "date" : "dates"}` : ""}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs">
          <span className="font-medium">{priceLabel}</span>
          {card.url && <span className="font-semibold text-accent">Tickets →</span>}
        </div>
      </div>
    </>
  );
  const cls = "group flex h-full w-64 shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition-shadow hover:shadow-md";
  return card.url ? (
    <ExternalLink href={card.url} className={cls}>
      {inner}
    </ExternalLink>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/**
 * A swipeable row of event cards with photos. With `filter`, chips let you
 * narrow it to one kind (concerts, sport…) — only kinds that are actually on.
 */
export function EventCarousel({ cards, filter = false, label }: { cards: CarouselCard[]; filter?: boolean; label: string }) {
  const kinds = (Object.keys(CATEGORY) as NearbyCategory[]).filter((k) => cards.some((c) => c.category === k));
  const [kind, setKind] = useState<NearbyCategory | "all">("all");
  const shown = kind === "all" ? cards : cards.filter((c) => c.category === kind);

  return (
    <div>
      {filter && kinds.length > 1 && (
        <div className="no-scrollbar -mx-5 mb-3 flex gap-2 overflow-x-auto px-5" role="group" aria-label="Show">
          {(["all", ...kinds] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                kind === k ? "border-ink bg-ink text-canvas" : "border-line bg-surface text-muted hover:text-ink"
              )}
            >
              {k === "all" ? "All" : CATEGORY[k].label}
            </button>
          ))}
        </div>
      )}
      <ul aria-label={label} className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-2">
        {shown.map((c) => (
          <li key={c.id} className="flex">
            <Card card={c} />
          </li>
        ))}
      </ul>
    </div>
  );
}

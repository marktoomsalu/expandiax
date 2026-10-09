import { Camera, Globe2 } from "lucide-react";
import { RatingStars } from "@/components/Rating";
import { StockImage } from "@/components/StockImage";
import { StockCredit } from "@/components/StockCredit";
import { DEADVLEI, NEON_NIGHT, SAMPLE_CODES, SAMPLE_CONTINENTS, SAMPLE_PCT } from "./content";

/** Maya, the example traveller — the same story as the sample map. */
export function ExampleProfileCard() {
  return (
    <article className="card flex h-full flex-col overflow-hidden" aria-label="Example traveller profile">
      <div className="relative aspect-[16/8] w-full">
        <StockImage photo={DEADVLEI} alt={DEADVLEI.alt} aspect="2:1" sizes="(min-width: 1024px) 560px, 100vw" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
        <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2.5 py-1.5 backdrop-blur-sm">
          <StockCredit photo={DEADVLEI} />
        </span>
        <div className="absolute inset-x-0 bottom-0 px-6 py-5 text-white">
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-white/70">🇳🇦 Namibia · favourite memory</p>
          <p className="mt-1 font-serif text-2xl italic leading-snug">
            &ldquo;Deadvlei at sunrise - red dunes, black trees, and a silence you could hear.&rdquo;
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 border-b border-line px-6 py-4">
        <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft font-serif text-lg text-accent">M</span>
        <div>
          <p className="font-serif text-xl">Maya Laurent</p>
          <p className="text-xs text-muted">@mayalaurent · from 🇨🇦 Canada</p>
        </div>
        <Globe2 size={18} className="ml-auto text-muted" aria-hidden />
      </div>
      <div className="mt-auto grid grid-cols-3 divide-x divide-line text-center">
        {[
          [String(SAMPLE_CODES.length), "countries"],
          [SAMPLE_PCT, "of the world"],
          [String(SAMPLE_CONTINENTS), "continents"],
        ].map(([v, l]) => (
          <div key={l} className="px-2 py-5">
            <p className="font-serif text-3xl">{v}</p>
            <p className="eyebrow mt-1">{l}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

/** One example event memory. */
export function ExampleEventCard() {
  return (
    <article className="card flex h-full flex-col overflow-hidden" aria-label="Example event memory">
      <div className="relative flex aspect-[16/8] items-end px-6 py-5">
        <StockImage photo={NEON_NIGHT} alt={NEON_NIGHT.alt} aspect="2:1" sizes="(min-width: 1024px) 560px, 100vw" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2.5 py-1.5 backdrop-blur-sm">
          <StockCredit photo={NEON_NIGHT} />
        </span>
        <div className="relative text-white">
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-white/70">🇰🇷 Olympic Hall · Seoul</p>
          <p className="mt-1 font-serif text-3xl italic">The Neon Encore</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col px-6 py-5">
        <div className="flex items-center justify-between">
          <p className="font-serif text-xl">Neon night, Seoul</p>
          <RatingStars value={10} />
        </div>
        <p className="mt-2 text-sm italic leading-relaxed text-muted">
          &ldquo;The whole hall sang the last chorus in three languages. I didn&rsquo;t want the lights to come back on.&rdquo;
        </p>
        <p className="mt-auto flex items-center gap-1.5 pt-3 text-xs text-muted">
          <Camera size={13} aria-hidden /> 8 photos · 3 videos · favourite song saved
        </p>
      </div>
    </article>
  );
}

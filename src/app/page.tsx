import Link from "next/link";
import { Camera, Check, Globe2, Sparkles, Ticket } from "lucide-react";
import { WorldMap } from "@/components/WorldMap";
import { FadeIn } from "@/components/FadeIn";
import { HeroFilm } from "@/components/film/HeroFilm";
import { RatingStars } from "@/components/Rating";
import { COUNTRIES, TOTAL_COUNTRIES, countryByCode } from "@/lib/countries";
import type { StockPhoto } from "@/lib/stockPhotos";
import { StockImage } from "@/components/StockImage";
import { StockCredit } from "@/components/StockCredit";

const FREE_FEATURES = ["Up to 40 countries", "Up to 20 events", "5 photos & 3 videos per entry"];
const PREMIUM_FEATURES = [
  "Unlimited countries & events",
  "15 photos & 8 videos per entry",
  "US States tracking map",
  "Custom accent colour & Premium badge",
];

// Maya's map — the example traveller below, so the map and her profile tell one story.
const SAMPLE_CODES = [
  "CA", "US", "MX", "PE", "CL", "AR", "IS", "PT", "ES", "FR", "IT", "GR",
  "MA", "NA", "ZA", "TZ", "JO", "IN", "TH", "VN", "KR", "JP", "NZ",
];
const SAMPLE_CONTINENTS = new Set(SAMPLE_CODES.map((c) => countryByCode(c)?.continent)).size;
const SAMPLE_PCT = `${Math.round((SAMPLE_CODES.length / COUNTRIES.length) * 1000) / 10}%`;

// Example photos from Unsplash, hotlinked and credited like the country photos in the app.
const UTM = "utm_source=expandiax&utm_medium=referral";
const unsplash = (id: string, raw: string, color: string, alt: string, author: string, username: string, slug: string): StockPhoto => ({
  id,
  raw,
  color,
  alt,
  author,
  authorUrl: `https://unsplash.com/@${username}?${UTM}`,
  photoUrl: `https://unsplash.com/photos/${slug}?${UTM}`,
  unsplashUrl: `https://unsplash.com/?${UTM}`,
});
const DEADVLEI = unsplash(
  "M6xllhci484",
  "https://images.unsplash.com/photo-1597342809356-6dc1115906c1?ixlib=rb-4.1.0",
  "#0c2673",
  "A lone dead acacia on the white clay of Deadvlei, red dunes and deep blue sky behind",
  "Sean Robertson",
  "knuknuk",
  "bare-tree-on-desert-during-daytime-M6xllhci484"
);
const NEON_NIGHT = unsplash(
  "r3XvSBEQQLo",
  "https://images.unsplash.com/photo-1574155376612-bfa4ed8aabfd?ixlib=rb-4.1.0",
  "#260c0c",
  "A crowd with hands up under pink laser beams at a concert",
  "A J.",
  "antoinejulien",
  "group-of-people-enjoying-concert-r3XvSBEQQLo"
);

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="gradient-travel pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[64rem] -translate-x-1/2 rounded-full opacity-[0.16] blur-3xl dark:opacity-[0.22]"
        />
        <div className="relative mx-auto max-w-shell px-5 pb-10 pt-16 md:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_auto] lg:gap-16">
            <FadeIn className="text-center lg:text-left">
              <p className="eyebrow">ExpandiaX</p>
              <h1 className="mx-auto mt-4 max-w-3xl text-5xl lg:mx-0 leading-[1.02] md:text-7xl">
                Your world, <span className="italic text-accent">remembered.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted lg:mx-0">
                Track the countries you have explored, preserve the moments that mattered and build a
                visual archive of every event that made you feel alive.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
                <Link href="/start" className="btn-accent !px-10 !py-4 !text-lg font-semibold shadow-lg shadow-accent/25">
                  Start my world
                </Link>
                <Link href="/explore" className="btn-ghost !px-7 !py-3">Explore travellers</Link>
              </div>
              <p className="mt-4 text-sm text-muted">
                Already have an account?{" "}
                <Link href="/sign-in" className="text-accent underline-offset-4 hover:underline">Sign in</Link>
              </p>
            </FadeIn>
            <FadeIn delay={0.1}>
              <HeroFilm />
            </FadeIn>
          </div>

          <FadeIn delay={0.15} className="mt-14">
            <div className="overflow-hidden rounded-card border border-line bg-surface p-2 shadow-sm sm:p-5">
              <WorldMap visitedCodes={SAMPLE_CODES} interactive={false} />
              <p className="border-t border-line px-2 pb-1 pt-3 text-center text-xs text-muted">
                {SAMPLE_CODES.length} of {TOTAL_COUNTRIES} countries - a world in progress.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Two halves of a life */}
      <section className="mx-auto max-w-shell px-5 py-16 md:py-24" aria-labelledby="halves-h">
        <FadeIn>
          <p className="eyebrow">One archive, two obsessions</p>
          <h2 id="halves-h" className="mt-2 max-w-2xl text-3xl md:text-5xl">
            The places you&rsquo;ve stood. The songs you heard there.
          </h2>
        </FadeIn>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* Example traveller profile */}
          <FadeIn delay={0.05}>
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
          </FadeIn>

          {/* Example event memory */}
          <FadeIn delay={0.1}>
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
          </FadeIn>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-line bg-surface/60" aria-labelledby="how-h">
        <div className="mx-auto max-w-shell px-5 py-16 md:py-20">
          <FadeIn>
            <h2 id="how-h" className="text-3xl md:text-4xl">Three habits, one archive.</h2>
          </FadeIn>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: Globe2,
                title: "Pin your countries",
                body: `Mark each of the ${TOTAL_COUNTRIES} recognised countries as you go. Add years, cities and the one memory worth keeping.`,
              },
              {
                icon: Ticket,
                title: "Archive your events",
                body: "Concerts, festivals, matches, conferences, weddings - venue, rating, the moment that stuck, with photos and short videos.",
              },
              {
                icon: Camera,
                title: "Share your world",
                body: "A public profile that reads like a travel magazine about your life. Or keep it entirely private.",
              },
            ].map((s, i) => (
              <FadeIn key={s.title} delay={i * 0.07}>
                <div>
                  <s.icon size={22} className="text-accent" aria-hidden />
                  <h3 className="mt-4 font-serif text-xl">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-shell px-5 py-16 md:py-24" aria-labelledby="pricing-h">
        <FadeIn>
          <p className="eyebrow">Free to start</p>
          <h2 id="pricing-h" className="mt-2 max-w-2xl text-3xl md:text-5xl">
            Grows with the life you&rsquo;re archiving.
          </h2>
        </FadeIn>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <FadeIn delay={0.05}>
            <div className="card flex h-full flex-col px-7 py-8">
              <p className="eyebrow">Free</p>
              <p className="mt-2 font-serif text-4xl">$0</p>
              <ul className="mt-6 space-y-3 text-sm text-muted">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/start" className="btn-ghost mt-auto w-full !py-2.5 text-center">
                Start free
              </Link>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="card relative h-full overflow-hidden px-7 py-8 ring-1 ring-accent/30">
              <div aria-hidden className="gradient-travel pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-[0.18] blur-2xl" />
              <p className="eyebrow flex items-center gap-1.5 text-accent">
                <Sparkles size={13} aria-hidden /> Premium
              </p>
              <p className="mt-2 font-serif text-4xl">
                $4<span className="text-lg text-muted">/mo</span>
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {PREMIUM_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/sign-up" className="btn-accent mt-7 w-full !py-2.5 text-center">
                Go Premium
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-shell px-5 py-20 text-center md:py-28">
        <FadeIn>
          <h2 className="mx-auto max-w-2xl text-4xl leading-tight md:text-6xl">
            Your world deserves more than a camera roll.
          </h2>
          <div className="mt-9">
            <Link href="/start" className="btn-accent !px-8 !py-3.5 !text-base">Start my world</Link>
          </div>
        </FadeIn>
      </section>
    </div>
  );
}

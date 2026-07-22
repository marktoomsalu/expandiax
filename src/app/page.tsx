import Link from "next/link";
import { Camera, Globe2, Music2, Ticket } from "lucide-react";
import { WorldMap } from "@/components/WorldMap";
import { FadeIn } from "@/components/FadeIn";
import { RatingStars } from "@/components/Rating";
import { TOTAL_COUNTRIES } from "@/lib/countries";

const SAMPLE_CODES = ["EE", "FI", "SE", "PL", "ES", "IT", "PT", "GR", "JP", "TH", "MA", "MX", "PE", "GE", "NZ"];

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
          <FadeIn>
            <p className="eyebrow">ExpandiaX</p>
            <h1 className="mt-4 max-w-3xl text-5xl leading-[1.02] md:text-7xl">
              Your world, <span className="italic text-accent">remembered.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Track the countries you have explored, preserve the moments that mattered and build a
              visual archive of every event that made you feel alive.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/sign-in" className="btn-accent !px-7 !py-3">Sign in</Link>
              <Link href="/explore" className="btn-ghost !px-7 !py-3">Explore travellers</Link>
            </div>
          </FadeIn>

          <FadeIn delay={0.15} className="mt-14">
            <div className="overflow-hidden rounded-card border border-line bg-surface p-2 shadow-sm sm:p-5">
              <WorldMap visitedCodes={SAMPLE_CODES} interactive={false} />
              <p className="border-t border-line px-2 pb-1 pt-3 text-center text-xs text-muted">
                {SAMPLE_CODES.length} of {TOTAL_COUNTRIES} countries — a world in progress.
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
            <article className="card overflow-hidden" aria-label="Example traveller profile">
              <div className="flex items-center gap-4 border-b border-line px-6 py-5">
                <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft font-serif text-xl text-accent">L</span>
                <div>
                  <p className="font-serif text-xl">Liis Kask</p>
                  <p className="text-xs text-muted">@liiskask · from 🇪🇪 Estonia</p>
                </div>
                <Globe2 size={18} className="ml-auto text-muted" aria-hidden />
              </div>
              <div className="grid grid-cols-3 divide-x divide-line text-center">
                {[
                  ["15", "countries"],
                  ["7.7%", "of the world"],
                  ["4", "continents"],
                ].map(([v, l]) => (
                  <div key={l} className="px-2 py-5">
                    <p className="font-serif text-3xl">{v}</p>
                    <p className="eyebrow mt-1">{l}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-line px-6 py-5">
                <p className="text-sm italic leading-relaxed text-muted">
                  &ldquo;Saaremaa in June — juniper, sea wind, and the light that never quite leaves.&rdquo;
                </p>
                <p className="mt-2 text-xs text-muted">🇪🇪 Estonia · favourite memory</p>
              </div>
            </article>
          </FadeIn>

          {/* Example event memory */}
          <FadeIn delay={0.1}>
            <article className="card overflow-hidden" aria-label="Example event memory">
              <div className="relative flex aspect-[16/8] items-end bg-[#14110f] px-6 py-5">
                <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,rgba(255,99,71,0.35),transparent_60%),radial-gradient(ellipse_at_20%_100%,rgba(13,148,136,0.28),transparent_55%)]" />
                <div className="relative text-white">
                  <p className="text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-white/60">Estadio Metropolitano · Madrid</p>
                  <p className="mt-1 font-serif text-3xl italic">The Last Summer Tour</p>
                </div>
                <Music2 size={18} className="absolute right-5 top-5 text-white/50" aria-hidden />
              </div>
              <div className="px-6 py-5">
                <div className="flex items-center justify-between">
                  <p className="font-serif text-xl">Stadium night, Madrid</p>
                  <RatingStars value={10} />
                </div>
                <p className="mt-2 text-sm italic leading-relaxed text-muted">
                  &ldquo;60,000 phones went dark for the acoustic encore. You could hear the city breathing.&rdquo;
                </p>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                  <Camera size={13} aria-hidden /> 5 photos · 2 videos · favourite song saved
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
                body: "Concerts, festivals, matches, conferences, weddings — venue, rating, the moment that stuck, with photos and short videos.",
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

      {/* CTA */}
      <section className="mx-auto max-w-shell px-5 py-20 text-center md:py-28">
        <FadeIn>
          <h2 className="mx-auto max-w-2xl text-4xl leading-tight md:text-6xl">
            Some nights deserve more than a camera roll.
          </h2>
          <div className="mt-9">
            <Link href="/sign-in" className="btn-accent !px-8 !py-3.5 !text-base">Sign in</Link>
          </div>
        </FadeIn>
      </section>
    </div>
  );
}

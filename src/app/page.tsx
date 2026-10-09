import Link from "next/link";
import { Camera, Check, Globe2, Ticket } from "lucide-react";
import { WorldMap } from "@/components/WorldMap";
import { FadeIn } from "@/components/FadeIn";
import { WideFilm } from "@/components/film/WatchFilm";
import { TOTAL_COUNTRIES } from "@/lib/countries";
import { EVERYTHING, SAMPLE_CODES } from "@/components/home/content";
import { ExampleEventCard, ExampleProfileCard } from "@/components/home/ExampleCards";

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
          <FadeIn className="text-center">
            <p className="eyebrow">ExpandiaX</p>
            <h1 className="mx-auto mt-4 max-w-3xl text-5xl leading-[1.02] md:text-7xl">
              Your life, <span className="italic text-accent">remembered.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Track the countries you have explored, preserve the moments that mattered and build a
              visual archive of every event that made you feel alive.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/start" className="btn-accent !px-10 !py-4 !text-lg font-semibold shadow-lg shadow-accent/25">
                Start my journey
              </Link>
              <Link href="/explore" className="btn-ghost !px-7 !py-3">Explore travellers</Link>
            </div>
            <p className="mt-4 text-sm text-muted">
              Already have an account?{" "}
              <Link href="/sign-in" className="text-accent underline-offset-4 hover:underline">Sign in</Link>
            </p>
          </FadeIn>

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

      {/* The film */}
      <section className="mx-auto max-w-shell px-5 pt-6 md:pt-10" aria-label="The ExpandiaX film">
        <FadeIn>
          <WideFilm />
        </FadeIn>
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
            <ExampleProfileCard />
          </FadeIn>

          {/* Example event memory */}
          <FadeIn delay={0.1}>
            <ExampleEventCard />
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

      {/* Free for everyone */}
      <section className="mx-auto max-w-shell px-5 py-16 md:py-24" aria-labelledby="free-h">
        <FadeIn>
          <p className="eyebrow">Free for everyone</p>
          <h2 id="free-h" className="mt-2 max-w-2xl text-3xl md:text-5xl">
            Everything, for everyone. No subscriptions.
          </h2>
          <p className="mt-4 max-w-xl text-muted">
            No plans, no paywalls, no ads. We earn a small commission when you book a stay, a tour or a flight through
            ExpandiaX, and from partners who sponsor what we build - so all of it is free, for everyone.
          </p>
        </FadeIn>

        <FadeIn delay={0.05}>
          <div className="card relative mt-10 overflow-hidden px-7 py-8 ring-1 ring-accent/30">
            <div aria-hidden className="gradient-travel pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-[0.18] blur-2xl" />
            <p className="font-serif text-4xl">
              €0 <span className="text-lg text-muted">- now and always</span>
            </p>
            <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              {EVERYTHING.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/start" className="btn-accent mt-7 inline-flex !px-8 !py-2.5">
              Start my journey
            </Link>
          </div>
        </FadeIn>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-shell px-5 py-20 text-center md:py-28">
        <FadeIn>
          <h2 className="mx-auto max-w-2xl text-4xl leading-tight md:text-6xl">
            Your world deserves more than a camera roll.
          </h2>
          <div className="mt-9">
            <Link href="/start" className="btn-accent !px-8 !py-3.5 !text-base">Start my journey</Link>
          </div>
        </FadeIn>
      </section>
    </div>
  );
}

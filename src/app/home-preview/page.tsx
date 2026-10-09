import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";
import { FadeIn } from "@/components/FadeIn";
import { TOTAL_COUNTRIES } from "@/lib/countries";
import { EVERYTHING } from "@/components/home/content";
import { ExampleEventCard, ExampleProfileCard } from "@/components/home/ExampleCards";
import { HeroScene } from "@/components/home/HeroScene";
import { RevealText } from "@/components/home/RevealText";
import { FilmScene, PillarRows } from "@/components/home/Scenes";
import { SmoothScroll } from "@/components/home/SmoothScroll";

// A candidate for the homepage, to compare against the live one before it
// replaces it. Not for search engines meanwhile.
export const metadata: Metadata = { title: "Home preview", robots: { index: false, follow: false } };

const STEPS = [
  ["Pin your countries.", `Mark each of the ${TOTAL_COUNTRIES} countries as you go - the years, the cities, the one memory worth keeping.`],
  ["Keep your events.", "Every concert, festival, match and wedding - the venue, your rating, the moment that stuck, with photos and video."],
  ["Share your world.", "A public profile that reads like a travel magazine about your life. Or keep it entirely private."],
] as const;

export default function HomePreviewPage() {
  return (
    <div>
      <SmoothScroll />
      <HeroScene />

      {/* A statement that lights up as you read it */}
      <section className="mx-auto max-w-shell px-5 pb-24 pt-4 md:pb-36">
        <RevealText
          as="h2"
          lead={5}
          text="This isn’t just about travel. It’s about the songs you sang along to, the places that changed you, and the people who were there."
          className="max-w-4xl text-4xl leading-[1.12] md:text-6xl"
        />
      </section>

      {/* The film */}
      <section className="px-5" aria-label="The ExpandiaX film">
        <FilmScene />
      </section>

      {/* Three steps */}
      <section className="mx-auto grid max-w-shell gap-10 px-5 py-24 md:py-36 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-16">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <h2 className="text-5xl leading-[1.02] md:text-6xl">
            Three habits,
            <br />
            <span className="text-muted">one archive.</span>
          </h2>
          <Link href="/start" className="btn-accent mt-8 inline-flex !px-7 !py-3">
            Start my journey <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
        <ol className="border-b border-line">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 border-t border-line py-8 md:py-10">
              <span className="pt-2 text-sm tabular-nums text-muted">0{i + 1}</span>
              <RevealText
                lead={title.split(" ").length}
                text={`${title} ${body}`}
                className="font-serif text-2xl leading-snug md:text-3xl"
              />
            </li>
          ))}
        </ol>
      </section>

      {/* Pin · Remember · Share */}
      <section className="bg-brand-purple text-white" aria-label="What ExpandiaX does">
        <div className="mx-auto max-w-shell px-5 py-20 md:py-28">
          <p className="eyebrow !text-white/60">One archive, two obsessions</p>
          <PillarRows />
          <div className="border-t border-white/10 pt-14">
            <RevealText
              text="The places you’ve stood. The songs you heard there. All of it, in one place that’s yours."
              className="max-w-3xl font-serif text-3xl leading-snug md:text-5xl"
            />
          </div>
        </div>
      </section>

      {/* Two examples */}
      <section className="mx-auto max-w-shell px-5 py-24 md:py-32" aria-label="Examples">
        <div className="grid gap-6 lg:grid-cols-2">
          <FadeIn>
            <ExampleProfileCard />
          </FadeIn>
          <FadeIn delay={0.1}>
            <ExampleEventCard />
          </FadeIn>
        </div>
      </section>

      {/* Free for everyone */}
      <section className="border-y border-line bg-surface/60" aria-labelledby="free-h">
        <div className="mx-auto grid max-w-shell gap-10 px-5 py-20 md:py-28 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="eyebrow">Free for everyone</p>
            <h2 id="free-h" className="mt-3 text-5xl leading-[1.02] md:text-6xl">
              Everything. <span className="text-muted">No subscriptions.</span>
            </h2>
            <p className="mt-5 max-w-lg text-muted">
              No plans, no paywalls, no ads. We earn a small commission when you book a stay, a tour or a flight through
              ExpandiaX, and from partners who sponsor what we build - so all of it is free, for everyone.
            </p>
          </div>
          <FadeIn>
            <div className="card relative overflow-hidden px-7 py-8 ring-1 ring-accent/30">
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
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Last word */}
      <section className="mx-auto max-w-shell px-5 py-28 text-center md:py-40">
        <RevealText
          as="h2"
          text="Your world deserves more than a camera roll."
          className="mx-auto max-w-3xl justify-center text-5xl leading-[1.05] md:text-7xl"
        />
        <Link href="/start" className="btn-accent mt-10 inline-flex !px-9 !py-4 !text-lg font-semibold shadow-lg shadow-accent/25">
          Start my journey <ArrowRight size={18} aria-hidden />
        </Link>
        <p className="mt-4 text-sm text-muted">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-accent underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </section>
    </div>
  );
}

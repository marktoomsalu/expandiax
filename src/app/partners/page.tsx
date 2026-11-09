import type { Metadata } from "next";
import { Check, Infinity as Forever, Rocket, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { company } from "@/lib/company";
import { cn } from "@/lib/utils";
import { PartnerFilm } from "@/components/partners/PartnerFilm";

export const metadata: Metadata = {
  title: "For partners",
  description: "Festivals, events, tours and destinations on ExpandiaX: a home for your crowd's memories, and a place in front of people planning what's next.",
};

// The page renders fresh numbers at most every hour.
export const revalidate = 3600;

type Audience = { members: number; dreamers: number; top_dreams: { country_code: string; dreamers: number }[] };

// Live audience numbers appear once they're big enough to mean something;
// until then the page talks about the start, not the size.
const SHOW_AUDIENCE_FROM = 1000;

const MAIL = (subject: string) => `mailto:${company.supportEmail}?subject=${encodeURIComponent(subject)}`;

const PLANS = [
  {
    name: "Event page",
    price: "Free",
    per: "",
    for: "Any festival, race, concert or tour",
    features: ["An official page with your name on it", "“I was there” for your crowd", "Their photos, videos and memories in one place", "A QR poster for your venue"],
    cta: "Claim your page",
  },
  {
    name: "Featured event",
    price: "€149",
    per: "per event",
    for: "When you want more people to come",
    features: ["Everything in Event page", "Featured on Explore for people nearby and those dreaming of your country", "Partner label and a link to your tickets", "A report after the event"],
    cta: "Feature an event",
  },
  {
    name: "Season partner",
    price: "€490",
    per: "per season",
    for: "Festivals and organisers with a season",
    features: ["Up to 5 featured events", "Your partner card on your city or country page for 3 months", "A launch post on our social channels", "A season report"],
    cta: "Become a season partner",
    best: true,
  },
  {
    name: "Destination",
    price: "from €990",
    per: "per quarter",
    for: "Tourism boards, hotels and tour operators",
    features: ["Your partner card on your country’s page", "Campaigns to people with your destination on their dream list", "Quarterly insights on what travellers dream of"],
    cta: "Plan a campaign",
  },
];

/** For partners: how it works (a short film), why now, the price list, the rules, and how to start. */
export default async function PartnersPage() {
  const { data } = await createClient().rpc("explore_audience");
  const audience = (data ?? null) as Audience | null;
  const showAudience = !!audience && audience.members >= SHOW_AUDIENCE_FROM;

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 md:py-16">
      {/* Hero */}
      <div className="max-w-3xl">
        <p className="eyebrow">For partners</p>
        <h1 className="mt-3 text-4xl leading-tight md:text-6xl">
          Be part of the memories <span className="italic text-accent">people keep.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
          On ExpandiaX people keep the countries they&rsquo;ve been to, the festivals and races they loved, and the places they dream of next. Give your event
          or destination a home there, and meet people while they plan.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a href="#prices" className="btn-accent !px-6 !py-3">See prices</a>
          <a href={MAIL("Partnering with ExpandiaX")} className="btn-ghost !px-6 !py-3">Talk to us</a>
        </div>
      </div>

      {/* Facts */}
      <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl bg-[#140d18] text-[#fdf3e3] sm:grid-cols-3">
        {[
          { icon: Trophy, big: "No. 4", small: "in Lifestyle on the App Store in Estonia" },
          { icon: Sparkles, big: "Free", small: "for everyone, so nothing stands between your event and its crowd" },
          { icon: Rocket, big: "iPhone + web", small: "with Android on its way" },
        ].map((f) => (
          <li key={f.big} className="bg-[#140d18] px-6 py-5">
            <f.icon size={18} className="text-[#FB7822]" aria-hidden />
            <p className="mt-2 font-serif text-3xl">{f.big}</p>
            <p className="mt-1 text-sm text-white/65">{f.small}</p>
          </li>
        ))}
      </ul>

      {/* How it works */}
      <section aria-labelledby="how-h" className="mt-20">
        <p className="eyebrow">How it works</p>
        <h2 id="how-h" className="mt-2 text-3xl md:text-4xl">
          From the gates opening <span className="italic text-accent">to the memories after.</span>
        </h2>
        <div className="mt-10">
          <PartnerFilm />
        </div>
      </section>

      {/* Why now */}
      <section aria-labelledby="now-h" className="mt-20">
        <p className="eyebrow">Why now</p>
        <h2 id="now-h" className="mt-2 text-3xl md:text-4xl">
          Get in at the start, <span className="italic text-accent">grow with it.</span>
        </h2>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Trophy,
              title: "Founding partners",
              body: "Join in 2026 and keep launch prices for 12 months, with your first featured event free. The first festivals in the app are the ones people remember.",
            },
            {
              icon: Forever,
              title: "It lasts",
              body: "An ad is gone when the campaign ends. Every “I was there” puts your event on someone’s map for good, and their friends see it there.",
            },
            {
              icon: Sparkles,
              title: "Before, during and after",
              body: "Dream lists before the trip, “I was there” on the day, memories afterwards: the whole journey, not one scroll past an ad.",
            },
          ].map((f) => (
            <li key={f.title} className="card px-5 py-5">
              <f.icon size={20} className="text-accent" aria-hidden />
              <p className="mt-3 font-serif text-xl leading-snug">{f.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
            </li>
          ))}
        </ul>

        {showAudience && audience && (
          <div className="mt-6 overflow-hidden rounded-2xl bg-[#140d18] text-[#fdf3e3]">
            <div className="grid grid-cols-2 divide-x divide-white/10">
              <div className="px-5 py-4">
                <p className="font-serif text-4xl">{audience.members.toLocaleString("en-GB")}</p>
                <p className="mt-1 text-xs text-white/60">members</p>
              </div>
              <div className="px-5 py-4">
                <p className="font-serif text-4xl">{audience.dreamers.toLocaleString("en-GB")}</p>
                <p className="mt-1 text-xs text-white/60">with a dream list</p>
              </div>
            </div>
            {audience.top_dreams.length > 0 && (
              <div className="border-t border-white/10 px-5 py-4">
                <p className="font-mono text-[10px] tracking-[0.2em] text-white/60">MOST DREAMED-OF</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {audience.top_dreams.map((d) => {
                    const c = countryByCode(d.country_code.slice(0, 2));
                    return c ? (
                      <li key={d.country_code} className="rounded-full bg-white/10 px-3 py-1.5 text-sm">
                        {c.flag} {c.name}
                      </li>
                    ) : null;
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Prices */}
      <section id="prices" aria-labelledby="prices-h" className="mt-20 scroll-mt-24">
        <p className="eyebrow">Prices</p>
        <h2 id="prices-h" className="mt-2 text-3xl md:text-4xl">
          Start free. <span className="italic text-accent">Grow when it works.</span>
        </h2>
        <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p) => (
            <li
              key={p.name}
              className={cn(
                "relative flex flex-col rounded-2xl px-5 py-6",
                p.best ? "bg-[#140d18] text-[#fdf3e3] shadow-xl ring-2 ring-accent" : "border border-line bg-surface"
              )}
            >
              {p.best && (
                <span className="gradient-travel absolute -top-3 left-5 rounded-full px-3 py-1 font-mono text-[10px] font-bold tracking-[0.2em] text-white">
                  MOST POPULAR
                </span>
              )}
              <p className="font-serif text-xl">{p.name}</p>
              <p className={cn("mt-1 text-xs", p.best ? "text-white/60" : "text-muted")}>{p.for}</p>
              <p className="mt-5">
                <span className="font-serif text-4xl">{p.price}</span>
                {p.per && <span className={cn("ml-1.5 text-sm", p.best ? "text-white/60" : "text-muted")}>{p.per}</span>}
              </p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm leading-snug">
                    <Check size={16} className={cn("mt-0.5 shrink-0", p.best ? "text-[#FB7822]" : "text-accent")} aria-hidden />
                    <span className={p.best ? "text-white/85" : undefined}>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href={MAIL(`ExpandiaX: ${p.name}`)}
                className={cn("mt-6 inline-flex justify-center rounded-full px-4 py-2.5 text-sm font-semibold", p.best ? "gradient-travel text-white" : "border border-line hover:border-accent hover:text-accent")}
              >
                {p.cta}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm text-muted">
          Launch prices, excluding VAT. Founding partners who join in 2026 keep them for 12 months, and their first featured event is free.
        </p>
      </section>

      {/* Rules */}
      <section aria-labelledby="rules-h" className="mt-16 rounded-2xl border border-line bg-surface px-5 py-5">
        <h2 id="rules-h" className="flex items-center gap-2 font-serif text-xl">
          <ShieldCheck size={20} className="text-accent" aria-hidden /> How we keep it good
        </h2>
        <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-muted">
          <li>Every placement is clearly labelled, and there&rsquo;s at most one per screen.</li>
          <li>Only shown where it&rsquo;s relevant: your event&rsquo;s country, or people who dream of going there.</li>
          <li>We never sell or share personal data. Partners see counts, never people.</li>
        </ul>
      </section>

      <div className="mt-16 rounded-3xl bg-[#140d18] px-6 py-12 text-center text-[#fdf3e3]">
        <h2 className="text-3xl md:text-4xl">
          Let&rsquo;s put your event <span className="italic text-[#FB7822]">on the map.</span>
        </h2>
        <p className="mx-auto mt-3 max-w-md text-white/65">Tell us about your festival, race, tour or destination.</p>
        <a href={MAIL("Partnering with ExpandiaX")} className="gradient-travel mt-7 inline-flex rounded-full px-8 py-3.5 text-base font-semibold text-white">
          Talk to us
        </a>
        <p className="mt-3 text-sm text-white/50">{company.supportEmail}</p>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { Ticket, MapPinned, ShieldCheck, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { company } from "@/lib/company";

export const metadata: Metadata = {
  title: "For businesses",
  description: "Reach travellers who dream of your destination - tourism boards, hotels, festivals and venues on ExpandiaX.",
};

// The page renders fresh numbers at most every hour.
export const revalidate = 3600;

type Audience = { members: number; dreamers: number; top_dreams: { country_code: string; dreamers: number }[] };

const FORMATS = [
  {
    icon: MapPinned,
    title: "Partner card on a destination",
    body: "Your guide, offer or campaign on a country's page - right where people plan, next to the trips and tips of travellers who've been. One partner per destination.",
  },
  {
    icon: Ticket,
    title: "Featured event",
    body: "Your festival, match or concert as the one event on Explore - shown only to people who live in its country or have it on their dream list.",
  },
  {
    icon: Sparkles,
    title: "Dream-list campaigns",
    body: "Reach the members who've put your destination on their dream list, at the moment they're deciding where to go next.",
  },
];

/** "For businesses": what partners get on ExpandiaX, the audience in numbers (counts only), and how to start. */
export default async function PartnersPage() {
  const { data } = await createClient().rpc("explore_audience");
  const audience = (data ?? null) as Audience | null;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 md:py-16">
      <p className="eyebrow">For businesses</p>
      <h1 className="mt-3 text-4xl leading-tight md:text-5xl">
        Meet travellers <span className="italic text-accent">before they book.</span>
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
        On ExpandiaX people keep the countries they&rsquo;ve been to, the events they loved - and the places they dream of next. Tourism boards,
        hotels, festivals and venues can be part of that moment.
      </p>

      {audience && audience.members > 0 && (
        <section aria-labelledby="aud-h" className="mt-10 overflow-hidden rounded-2xl bg-[#140d18] text-[#fdf3e3]">
          <h2 id="aud-h" className="border-b border-white/10 px-5 py-3 font-mono text-xs font-semibold tracking-[0.3em]">
            THE AUDIENCE
          </h2>
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
                  if (!c) return null;
                  return (
                    <li key={d.country_code} className="rounded-full bg-white/10 px-3 py-1.5 text-sm">
                      {c.flag} {c.name} <span className="text-white/60">{d.dreamers}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="fmt-h" className="mt-12">
        <h2 id="fmt-h" className="text-2xl md:text-3xl">Ways to be there</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {FORMATS.map((f) => (
            <li key={f.title} className="card px-5 py-5">
              <f.icon size={20} className="text-accent" aria-hidden />
              <p className="mt-3 font-serif text-lg leading-snug">{f.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="rules-h" className="mt-12 rounded-2xl border border-line bg-surface px-5 py-5">
        <h2 id="rules-h" className="flex items-center gap-2 font-serif text-xl">
          <ShieldCheck size={20} className="text-accent" aria-hidden /> How we keep it good
        </h2>
        <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-muted">
          <li>Every placement is clearly labelled - at most one per screen.</li>
          <li>Only shown where it&rsquo;s relevant: your destination&rsquo;s page, or people who dream of going there.</li>
          <li>We never sell or share personal data. Partners see counts, never people.</li>
        </ul>
      </section>

      <div className="mt-12 text-center">
        <a href={`mailto:${company.supportEmail}?subject=${encodeURIComponent("Partnering with ExpandiaX")}`} className="btn-accent inline-flex !px-8 !py-3.5 !text-base font-semibold">
          Talk to us
        </a>
        <p className="mt-3 text-sm text-muted">{company.supportEmail}</p>
      </div>
    </div>
  );
}

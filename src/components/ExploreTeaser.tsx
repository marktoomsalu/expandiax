import Link from "next/link";
import Image from "next/image";
import { Flame, Globe2, Lock, MapPin, Sparkles, Ticket, Users } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import { flagGradientColors } from "@/lib/flagColors";
import { stockPhotoFor } from "@/lib/stockPhotos";
import type { PopularPlace } from "@/lib/explore";
import type { Trending } from "@/lib/explore";
import { StockImage } from "./StockImage";

// Made-up faces for the previews — visitors never see real members.
const MOCK = [
  ["S", "#7c5cff"],
  ["J", "#0ea5e9"],
  ["A", "#f59e0b"],
  ["L", "#10b981"],
  ["K", "#ef4444"],
] as const;

function MockFaces({ n = 5, size = 34 }: { n?: number; size?: number }) {
  return (
    <span className="flex">
      {MOCK.slice(0, n).map(([l, c], i) => (
        <span
          key={i}
          className="flex items-center justify-center rounded-full border-2 border-surface font-serif text-white blur-[1.5px]"
          style={{ width: size, height: size, background: c, marginLeft: i ? -size / 3 : 0, fontSize: size * 0.42 }}
          aria-hidden
        >
          {l}
        </span>
      ))}
    </span>
  );
}

function Feature({ icon: Icon, title, body, children }: { icon: typeof Users; title: string; body: string; children: React.ReactNode }) {
  return (
    <li className="card flex flex-col overflow-hidden">
      <div className="relative flex min-h-40 items-center justify-center overflow-hidden bg-raised px-5 py-6">{children}</div>
      <div className="flex-1 border-t border-line px-5 py-4">
        <p className="flex items-center gap-2 font-serif text-xl">
          <Icon size={18} className="text-accent" aria-hidden /> {title}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
      </div>
    </li>
  );
}

/**
 * Explore for signed-out visitors: what's inside and why it's worth an
 * account — with real artists and places, but never real members.
 */
export function ExploreTeaser({ trending, places, place }: { trending: Trending[]; places: PopularPlace[]; place: string | null }) {
  const artist = trending.find((t) => t.image) ?? trending[0];
  const city = place ?? "your city";
  return (
    <div className="mx-auto max-w-shell px-5 py-10 md:py-14">
      <div className="relative overflow-hidden rounded-card border border-line bg-surface px-6 py-10 text-center md:px-12 md:py-14">
        <div aria-hidden className="gradient-travel pointer-events-none absolute -top-32 left-1/2 h-72 w-[48rem] -translate-x-1/2 rounded-full opacity-[0.14] blur-3xl" />
        <p className="eyebrow relative">Explore · for members</p>
        <h1 className="relative mx-auto mt-3 max-w-2xl text-4xl leading-tight md:text-6xl">
          Where your world <span className="italic text-accent">meets theirs.</span>
        </h1>
        <p className="relative mx-auto mt-4 max-w-xl text-muted">
          Find the people who were in the same crowd, whose travels overlap yours, and what&rsquo;s on in {city} tonight. Free with an account.
        </p>
        <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href="/start" className="btn-accent !px-8 !py-3.5 text-base font-semibold shadow-lg shadow-accent/25">
            Create my free account
          </Link>
          <Link href="/sign-in?next=/explore" className="btn-ghost !px-6 !py-3">
            Sign in
          </Link>
        </div>
      </div>

      <h2 className="mt-14 text-2xl md:text-3xl">What&rsquo;s inside Explore</h2>
      <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Feature icon={Users} title="Your travel twin" body="The member whose map and nights out overlap yours the most - and why.">
          <div className="flex w-full max-w-xs items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-sm">
            <MockFaces n={1} size={48} />
            <div className="min-w-0 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">Your travel twin</p>
              <p className="truncate text-sm font-medium blur-[3px]" aria-hidden>
                Someone like you
              </p>
              <p className="text-xs text-muted">14 countries in common · both saw the same band live</p>
            </div>
          </div>
        </Feature>

        <Feature icon={Ticket} title="Who was there" body="Open any concert, festival or race and see everyone who logged the same night.">
          <div className="flex w-full max-w-xs items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-sm">
            <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-accent to-orange-500">
              {artist?.image && <Image src={artist.image} alt="" fill sizes="56px" className="object-cover" />}
            </span>
            <div className="min-w-0 text-left">
              <p className="truncate font-serif text-base">{artist?.name ?? "The night you remember"}</p>
              <div className="mt-1 flex items-center gap-2">
                <MockFaces n={4} size={24} />
                <span className="text-xs text-muted">were there</span>
              </div>
            </div>
          </div>
        </Feature>

        <Feature icon={Sparkles} title={`Happening near ${place ?? "you"}`} body="Concerts, sport and shows in your city for the next three months - with tickets.">
          <div className="grid w-full max-w-xs grid-cols-2 gap-2">
            {["Tonight · 20:00", "Sat · 18:30"].map((t, i) => (
              <div key={t} className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
                <div className="h-14" style={{ background: i ? "linear-gradient(135deg,#0ea5e9,#6366f1)" : "linear-gradient(135deg,#FA51A2,#F97316)" }} />
                <div className="px-2 py-1.5 text-left">
                  <p className="text-[11px] font-medium">{i ? "Home match" : "Live concert"}</p>
                  <p className="text-[10px] text-muted">{t}</p>
                </div>
              </div>
            ))}
          </div>
        </Feature>

        <Feature icon={MapPin} title={`Travellers who know ${place ?? "your city"}`} body="Members who've been where you are - so you know who to ask where to go.">
          <div className="flex flex-col items-center gap-2">
            <MockFaces n={5} size={40} />
            <span className="rounded-full bg-surface px-3 py-1 text-xs text-muted shadow-sm">Has been to {place ?? "your city"}</span>
          </div>
        </Feature>

        <Feature icon={Flame} title="Trending memories" body="The artists and events everyone is logging right now.">
          <div className="flex gap-2">
            {trending.slice(0, 3).map((t) => (
              <span key={t.key} className="relative h-20 w-16 overflow-hidden rounded-lg bg-gradient-to-br from-accent to-orange-500 shadow-sm">
                {t.image && <Image src={t.image} alt="" fill sizes="64px" className="object-cover" />}
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[9px] text-white">{t.name}</span>
              </span>
            ))}
            {trending.length === 0 && <Flame size={40} className="text-accent" aria-hidden />}
          </div>
        </Feature>

        <Feature icon={Globe2} title="Popular places" body="Where members have been, with everyone's nights and trips from each country.">
          <div className="flex gap-2">
            {(places.length ? places.map((p) => p.code) : ["IT", "JP", "PT"]).slice(0, 3).map((code) => {
              const photo = stockPhotoFor(code, "explore");
              const [a, b] = flagGradientColors(code);
              return (
                <span key={code} className="relative h-20 w-16 overflow-hidden rounded-lg shadow-sm" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
                  {photo && <StockImage photo={photo} aspect="4:5" sizes="64px" />}
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[9px] text-white">
                    {countryByCode(code)?.flag} {countryByCode(code)?.name}
                  </span>
                </span>
              );
            })}
          </div>
        </Feature>
      </ul>

      <div className="mt-12 flex flex-col items-center gap-3 text-center">
        <p className="flex items-center gap-2 text-sm text-muted">
          <Lock size={14} aria-hidden /> Members only see what others choose to share.
        </p>
        <Link href="/start" className="btn-accent !px-8 !py-3.5 text-base font-semibold">
          Start my journey - it&rsquo;s free
        </Link>
      </div>
    </div>
  );
}

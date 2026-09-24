import Image from "next/image";
import { BarChart3, CalendarDays, Clock, Globe2, MapPin, Plus, Ticket, Users } from "lucide-react";
import { FeedMemoryCard } from "@/components/FeedMemoryCard";
import { ThenCard, type ThenMemory } from "@/components/ThenCard";
import { LikeButton } from "@/components/LikeButton";
import { WorldMap } from "@/components/WorldMap";
import { StatCard } from "@/components/StatCard";
import { RatingStars } from "@/components/Rating";
import { EVENT_TYPES, eventTypeMeta } from "@/lib/events";
import { flagGradientColors } from "@/lib/flagColors";
import { cn } from "@/lib/utils";

// Sample content for the App Store screenshots. Photos are free-licence
// Unsplash images via picsum.photos (already an allowed next/image host);
// no real people's likeness, artists, songs or event brands — those would
// need permission to appear in store marketing.
const photo = (id: number, w = 1200, h = 1500) => `https://picsum.photos/id/${id}/${w}/${h}`;
const NO_ID = "00000000-0000-0000-0000-000000000000";

const EMMA = { username: "emma", display_name: "Emma Laine", avatar_url: photo(64, 160, 160) };

export function FeedScreen() {
  return (
    <div className="mx-auto max-w-2xl px-5 pt-7 md:pt-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Home</p>
          <h1 className="mt-2 text-3xl md:text-4xl">
            Good evening, <span className="text-accent">Maria</span>
          </h1>
        </div>
        <span className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-line">
          <Image src={photo(1011, 160, 160)} alt="" width={40} height={40} className="h-full w-full object-cover" />
        </span>
      </div>

      <div className="card mt-5 hidden flex-wrap items-center justify-between gap-3 px-4 py-3.5 md:flex">
        <p className="font-serif text-lg">What&rsquo;s worth remembering?</p>
        <div className="flex gap-2">
          <span className="btn-ghost !px-3.5 !py-2 text-sm">
            <Globe2 size={15} /> A place
          </span>
          <span className="btn-accent !px-3.5 !py-2 text-sm">
            <Ticket size={15} /> An event
          </span>
        </div>
      </div>

      <h2 className="mt-6 text-sm font-medium text-muted">New</h2>
      <div className="card mt-4 overflow-hidden">
        <FeedMemoryCard
          href="#"
          kind="country"
          eventType={null}
          flag="🇬🇷"
          countryName="Greece"
          title="Zakynthos"
          subtitle={null}
          body="Bluest water we have ever seen."
          dateLabel="June 2025"
          location="Navagio Beach"
          track={null}
          media={[
            { id: "s1", url: photo(323), type: "image", alt: "" },
            { id: "s2", url: photo(49), type: "image", alt: "" },
            { id: "s3", url: photo(211), type: "image", alt: "" },
          ]}
          gradient={flagGradientColors("GR")}
          priority
          actor={EMMA}
          actionLabel="added a country"
          when="2h"
          actions={<LikeButton kind="country" targetId={NO_ID} initialLiked />}
        />
      </div>
    </div>
  );
}

const VISITED = [
  "EE", "FI", "SE", "NO", "DK", "LV", "LT", "PL", "DE", "NL", "BE", "FR", "ES", "PT", "IT", "GR", "AT", "CZ", "HU",
  "HR", "GB", "IE", "IS", "CH", "US", "CA", "MX", "JP", "TH", "VN", "ID", "AU", "KE", "MA", "EG", "TR", "AE", "IN",
];

export function WorldScreen() {
  return (
    <div className="mx-auto max-w-shell px-5 pt-7 md:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">My World</p>
          <h1 className="mt-2 text-3xl md:text-4xl">{VISITED.length} of 195 countries.</h1>
        </div>
        <p className="text-sm text-muted">
          Most recent: <span className="text-accent">🇳🇴 Norway</span>
        </p>
        <div className="hidden items-center gap-3 md:flex">
          <span className="btn-ghost !py-2 text-sm">
            <BarChart3 size={16} /> Stats
          </span>
          <span className="btn-accent">
            <Plus size={17} /> Add country
          </span>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-card border border-line bg-surface p-1.5">
        <WorldMap visitedCodes={VISITED} visitCounts={{ FI: 4, SE: 3, DE: 3, IT: 2, ES: 2, GR: 2 }} homeCode="EE" interactive={false} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-2 pb-1 pt-3 text-xs text-muted">
          <span className="flex items-center gap-2">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-accent" /> Visited
          </span>
          <span className="flex items-center gap-2">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#f59e0b" }} /> Home
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:mt-8 md:gap-4 lg:grid-cols-4">
        <StatCard label="Countries" value={VISITED.length} detail="of 195 recognised countries" className="hidden md:block" />
        <StatCard label="World explored" value="19%" detail="and counting" className="!px-4 !py-5 md:!px-5 md:!py-6" />
        <StatCard label="Continents" value="6/6" detail="have your footprints" className="!px-4 !py-5 md:!px-5 md:!py-6" />
        <StatCard label="Photos kept" value={214} detail="memories in your archive" className="hidden md:block" />
      </div>
    </div>
  );
}

export function EventScreen() {
  const meta = eventTypeMeta("concert");
  const TypeIcon = meta.icon;
  return (
    <div>
      <div className="relative flex min-h-[52vh] items-end overflow-hidden bg-[#14110d]">
        <Image src={photo(158, 1200, 1400)} alt="" fill priority sizes="100vw" className="object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" aria-hidden />
        <div className="relative mx-auto w-full max-w-shell px-5 pb-8 pt-28 text-white md:pb-10">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
            <TypeIcon size={12} aria-hidden /> {meta.label} · 12 Jul 2025
          </p>
          <h1 className="mt-2 max-w-3xl text-5xl leading-[1.05] md:text-7xl">The Northern Lights</h1>
          <p className="mt-3 font-serif text-xl italic text-white/85">Night two, front row</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/80">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} aria-hidden /> Song Festival Grounds, Tallinn
            </span>
            <RatingStars value={10} tone="light" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-7 md:py-10">
        <blockquote className="border-l-2 border-accent pl-5 font-serif text-xl italic leading-relaxed md:text-2xl">
          &ldquo;Forty thousand people singing the last chorus back at the band. I&rsquo;ll never forget it.&rdquo;
        </blockquote>
        <div className="card mt-6 px-4 py-3.5">
          <p className="eyebrow flex items-center gap-1.5">
            <TypeIcon size={12} aria-hidden /> {meta.highlightLabel}
          </p>
          <p className="mt-1.5 font-serif text-lg">Summer Static</p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {[195, 407].map((id) => (
            <div key={id} className="relative aspect-[4/3] overflow-hidden rounded-lg border border-line">
              <Image src={photo(id, 600, 450)} alt="" fill sizes="180px" className="object-cover" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const PORTUGAL: ThenMemory = {
  href: "#",
  eyebrow: "1 year ago today",
  kind: "country",
  eventType: null,
  flag: "🇵🇹",
  title: "Portugal",
  dateLabel: "September 2025 · 2 trips",
  place: null,
  words: "Pastéis de nata at 8am, every single day. No regrets.",
  photos: [419, 369, 164, 211, 392, 1015, 49].map((id) => ({ id: String(id), url: photo(id, 1200, 900), focalX: null, focalY: null })),
  fallbackImage: null,
  gradient: flagGradientColors("PT"),
};

export function ThenScreen() {
  return (
    <div className="mx-auto max-w-2xl px-5 pt-7 md:pt-10">
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted">
        <Clock size={14} aria-hidden /> Then
      </h2>
      <ThenCard m={PORTUGAL} />

      <h2 className="mt-8 flex items-center gap-1.5 text-sm font-medium text-muted">
        <Users size={14} aria-hidden /> Together
      </h2>
      <ul className="mt-4 space-y-3">
        <li className="card flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-sm">
              You and <span className="font-medium">Jonas</span> were both at
            </p>
            <p className="truncate font-serif text-lg">The Northern Lights</p>
          </div>
          <span className="btn-ghost shrink-0 !py-2 text-xs">Your version</span>
        </li>
        <li className="card flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-sm">
              <span className="font-medium">Emma</span> was at
            </p>
            <p className="truncate font-serif text-lg">Riverside Jazz Night</p>
            <p className="mt-0.5 text-xs text-muted">Were you there too?</p>
          </div>
          <span className="btn-accent shrink-0 !py-2 text-xs">I was there</span>
        </li>
      </ul>

    </div>
  );
}

export function CreateScreen() {
  return (
    <div className="mx-auto max-w-2xl px-5 pt-7 md:pt-10">
      <p className="eyebrow">New entry</p>
      <h1 className="mt-2 text-3xl md:text-4xl">A moment worth keeping.</h1>

      <section className="mt-6">
        <p className="eyebrow mb-3">Photos &amp; videos</p>
        <ul className="grid grid-cols-3 gap-2.5">
          {[158, 195, 407].map((id) => (
            <li key={id} className="relative aspect-square overflow-hidden rounded-lg border border-line bg-raised">
              <Image src={photo(id, 400, 400)} alt="" fill sizes="110px" className="object-cover" />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 space-y-5">
        <div>
          <span className="mb-1.5 block text-sm font-medium">Type of event</span>
          <div className="flex flex-wrap gap-2">
            {EVENT_TYPES.map((t, i) => {
              const Icon = t.icon;
              const on = t.value === "concert";
              return (
                <span
                  key={t.value}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
                    i >= 3 && "hidden md:flex",
                    on ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"
                  )}
                >
                  <Icon size={14} /> {t.label}
                </span>
              );
            })}
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium">Artist or band *</span>
          <span className="field block">The Northern Lights</span>
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium">Country *</span>
          <span className="field flex items-center justify-between">
            <span>🇪🇪 Estonia</span>
            <span className="text-xs text-accent">Change</span>
          </span>
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium">Date *</span>
          <span className="field flex items-center justify-between">
            <span>12 July 2025</span>
            <CalendarDays size={16} className="text-muted" />
          </span>
        </div>
      </section>
    </div>
  );
}


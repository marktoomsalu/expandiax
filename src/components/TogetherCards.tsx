import Image from "next/image";
import Link from "next/link";
import { countryByCode } from "@/lib/countries";
import { eventTypeMeta } from "@/lib/events";
import { flagGradientColors } from "@/lib/flagColors";
import type { Shared, TogetherEvent } from "@/lib/together";
import type { TogetherPerson } from "@/lib/togetherData";
import { formatDate, formatMonthYear } from "@/lib/utils";

export type Me = { username: string; display_name: string; avatar_url: string | null };

export function Avatar({ person, size = 28, className = "" }: { person: { display_name: string; avatar_url: string | null }; size?: number; className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-surface bg-raised font-serif text-xs text-muted ${className}`}
      style={{ width: size, height: size }}
    >
      {person.avatar_url ? (
        <Image src={person.avatar_url} alt="" width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        person.display_name.charAt(0)
      )}
    </span>
  );
}

export function AvatarPair({ me, person, size = 28 }: { me: Me; person: TogetherPerson; size?: number }) {
  return (
    <span className="flex">
      <Avatar person={person} size={size} />
      <Avatar person={me} size={size} className="-ml-2.5" />
    </span>
  );
}

const lastDay = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/** "April 2025", "12 April 2025", "10–14 April 2025" or a full range. */
export function formatOverlap(from: string, to: string) {
  if (from === to) return formatDate(from);
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  if (sameMonth && from.endsWith("-01") && Number(to.slice(8)) === lastDay(to)) return formatMonthYear(from);
  if (sameMonth) return `${Number(from.slice(8))}–${formatDate(to)}`;
  return `${formatDate(from)} – ${formatDate(to)}`;
}

const place = (e: TogetherEvent) => [e.venue, e.city || countryByCode(e.country_code)?.name].filter(Boolean).join(", ");

function Tile({ url, label, gradient, tall = false }: { url?: string; label?: string; gradient: [string, string]; tall?: boolean }) {
  return (
    <span className={`relative block w-full overflow-hidden rounded-lg bg-raised ${tall ? "aspect-[4/5]" : "aspect-[4/3]"}`}>
      {url ? (
        <Image src={url} alt="" fill sizes="(max-width: 640px) 40vw, 180px" className="object-cover" />
      ) : (
        <span className="block h-full w-full" style={{ background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` }} />
      )}
      {label && (
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-6 text-[11px] font-semibold text-white">
          {label}
        </span>
      )}
    </span>
  );
}

/**
 * One shared moment. In the feed the whole card opens the Together page;
 * on the Together page each half opens that person's own memory.
 */
export function SharedCard({
  item,
  person,
  me,
  covers,
  variant,
}: {
  item: Shared;
  person: TogetherPerson;
  me: Me;
  covers: Record<string, string>;
  variant: "feed" | "page";
}) {
  const first = person.display_name.split(" ")[0];

  if (item.kind === "trip") {
    const country = countryByCode(item.countryCode);
    const [a, b] = flagGradientColors(item.countryCode);
    const body = (
      <>
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-3xl" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
          <span aria-hidden>{country?.flag}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm">
            You and <span className="font-medium">{first}</span> were both in
          </span>
          <span className="block truncate font-serif text-lg">{country?.name ?? item.countryCode}</span>
          <span className="block text-xs text-muted">{formatOverlap(item.from, item.to)}</span>
        </span>
        <AvatarPair me={me} person={person} />
      </>
    );
    return variant === "feed" ? (
      <Link href={`/together#trip-${person.username}-${item.countryCode}-${item.from}`} className="card flex items-center gap-3.5 p-3.5 transition-shadow hover:shadow-md">
        {body}
      </Link>
    ) : (
      <div id={`trip-${person.username}-${item.countryCode}-${item.from}`} className="card scroll-mt-24 p-3.5">
        <div className="flex items-center gap-3.5">{body}</div>
        <div className="mt-3 flex gap-2 text-xs">
          <Link href={`/u/${person.username}/countries/${item.countryCode.toLowerCase()}`} className="btn-ghost !px-3 !py-1.5">
            {first}&rsquo;s trip
          </Link>
          <Link href={`/my-world/${item.countryCode.toLowerCase()}`} className="btn-ghost !px-3 !py-1.5">
            Your trip
          </Link>
        </div>
      </div>
    );
  }

  const { mine, theirs } = item;
  const TypeIcon = eventTypeMeta(theirs.event_type).icon;
  const gradient = flagGradientColors(theirs.country_code);
  const text = (
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-1.5 text-sm">
        <TypeIcon size={13} className="shrink-0 text-accent" aria-hidden />
        <span>
          You and <span className="font-medium">{first}</span> were both at
        </span>
      </span>
      <span className="block truncate font-serif text-lg">{theirs.title}</span>
      <span className="block truncate text-xs text-muted">
        {formatDate(theirs.event_date)}
        {place(theirs) ? ` · ${place(theirs)}` : ""}
      </span>
    </span>
  );

  if (variant === "feed") {
    return (
      <Link href={`/together#event-${theirs.id}`} className="card flex items-center gap-3.5 p-3.5 transition-shadow hover:shadow-md">
        <span className="grid w-24 shrink-0 grid-cols-2 gap-1">
          <Tile url={covers[theirs.id]} gradient={gradient} tall />
          <Tile url={covers[mine.id]} gradient={gradient} tall />
        </span>
        {text}
      </Link>
    );
  }

  return (
    <div id={`event-${theirs.id}`} className="card scroll-mt-24 p-4">
      <div className="flex items-start gap-3">{text}</div>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Link href={`/u/${person.username}/events/${theirs.id}`} className="group block">
          <Tile url={covers[theirs.id]} label={`${first}’s memory`} gradient={gradient} />
        </Link>
        <Link href={`/u/${me.username}/events/${mine.id}`} className="group block">
          <Tile url={covers[mine.id]} label="Your memory" gradient={gradient} />
        </Link>
      </div>
    </div>
  );
}

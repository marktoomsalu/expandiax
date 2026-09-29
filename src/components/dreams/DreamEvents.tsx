import Image from "next/image";
import Link from "next/link";
import { CalendarClock, Sparkles } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import { eventTypeMeta } from "@/lib/events";
import { slugify } from "@/lib/explore";
import type { DreamEventCard } from "@/lib/dreams";
import { shortDays } from "@/lib/tripPlaces";
import { DreamButton } from "../network/DreamButton";
import { FaceStack } from "../network/FaceStack";
import { AddDreamEvent } from "./AddDreamEvent";

function Wrap({ href, children }: { href: string | null; children: React.ReactNode }) {
  return href ? (
    <Link href={href} className="group block">
      {children}
    </Link>
  ) : (
    <div className="group block">{children}</div>
  );
}

/** Your dream events — who you follow has been, and when the artist plays next. */
export function DreamEvents({ dreams }: { dreams: DreamEventCard[] }) {
  return (
    <section className="mt-10" aria-labelledby="dream-events-h">
      <h2 id="dream-events-h" className="flex items-center gap-2 text-xl">
        <Sparkles size={18} className="text-violet-500" aria-hidden /> Dream events
      </h2>
      <p className="mt-1 text-xs text-muted">Artists, festivals and races you&rsquo;d love to be at. Only you see this list.</p>
      <div className="mt-4 max-w-md">
        <AddDreamEvent />
      </div>
      {dreams.length > 0 && (
        <ul className="no-scrollbar -mx-5 mt-4 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
          {dreams.map((d) => {
            const meta = eventTypeMeta(d.event_type);
            const Icon = meta.icon;
            const n = d.friends.length;
            const country = d.next ? countryByCode(d.next.countryCode) : null;
            return (
              <li key={d.id} className="relative flex w-44 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm sm:w-52">
                {/* Its page on ExpandiaX exists once someone has logged it. */}
                <Wrap href={n > 0 ? `/explore/live/${slugify(d.name)}` : null}>
                  <span className="relative block aspect-square w-full overflow-hidden bg-gradient-to-br from-violet-500 to-accent">
                    {d.image ? (
                      <Image src={d.image} alt="" fill sizes="208px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        <Icon size={44} className="text-white/85" aria-hidden />
                      </span>
                    )}
                  </span>
                  <span className="block px-3 pt-3">
                    <span className="block truncate font-serif text-lg leading-tight">{d.name}</span>
                    <span className="block text-xs text-muted">{meta.label}</span>
                    {n > 0 && (
                      <span className="mt-2 flex items-center gap-2">
                        <FaceStack people={d.friends} size={24} />
                        <span className="text-[11px] leading-tight text-muted">
                          {n} you follow {n === 1 ? "has" : "have"} been
                        </span>
                      </span>
                    )}
                  </span>
                </Wrap>
                {d.next && (
                  <a
                    href={d.next.url ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mx-3 mt-2 flex items-center gap-1.5 rounded-lg bg-violet-500/10 px-2 py-1.5 text-[11px] font-medium text-violet-700 hover:bg-violet-500/20 dark:text-violet-300"
                  >
                    <CalendarClock size={12} className="shrink-0" aria-hidden />
                    <span className="line-clamp-2 leading-tight">
                      Live next {shortDays(d.next.date, d.next.date)} {d.next.date.slice(0, 4)} · {d.next.city || country?.name}
                    </span>
                  </a>
                )}
                <span className="pb-3" />
                <span className="absolute right-2 top-2">
                  <DreamButton variant="icon" target={{ kind: "event", name: d.name, eventType: d.event_type }} initial label={d.name} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

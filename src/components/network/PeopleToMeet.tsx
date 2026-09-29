"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Flag, Globe2, Home, MapPin, Ticket, X } from "lucide-react";
import type { PersonCard } from "@/lib/experienceNetworkData";
import type { Reason } from "@/lib/experienceNetwork";
import { FollowButton } from "../FollowButton";

const ICONS: Record<Reason["icon"], typeof Home> = { home: Home, globe: Globe2, pin: MapPin, flag: Flag, ticket: Ticket };
const KEY = "expandiax:people-dismissed";

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/** "People you may want to meet" — each with why, a follow, and a way to say not now. */
export function PeopleToMeet({ people }: { people: PersonCard[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => setDismissed(readDismissed()), []);
  const shown = people.filter((p) => !dismissed.includes(p.id));
  if (!shown.length) return null;

  function dismiss(id: string) {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next.slice(-200)));
    } catch {
      // Still hidden for now, just not remembered.
    }
  }

  return (
    <ul className="no-scrollbar -mx-5 mt-4 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
      {shown.map((p) => {
        const Head = p.headline ? ICONS[p.headline.icon] : null;
        return (
          <li key={p.id} className="relative flex w-44 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm sm:w-52">
            <Link href={`/u/${p.username}`} className="relative block aspect-[4/3] w-full bg-gradient-to-br from-accent/30 via-accent-soft to-raised">
              {p.avatar_url ? (
                <Image src={p.avatar_url} alt="" fill sizes="208px" className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-serif text-4xl text-accent">{p.display_name.charAt(0)}</span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => dismiss(p.id)}
              aria-label={`Not now - hide ${p.display_name}`}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-ink shadow hover:bg-white"
            >
              <X size={14} />
            </button>
            <div className="flex flex-1 flex-col p-3">
              <Link href={`/u/${p.username}`} className="truncate font-serif text-lg leading-tight hover:text-accent">
                {p.display_name}
              </Link>
              {p.headline && Head && (
                <p className="mt-0.5 flex items-center gap-1 text-xs font-medium">
                  <Head size={12} className="shrink-0 text-accent" aria-hidden />
                  <span className="truncate">{p.headline.text}</span>
                </p>
              )}
              <ul className="mt-2 space-y-1">
                {p.reasons.map((r) => {
                  const Icon = ICONS[r.icon];
                  return (
                    <li key={r.text} className="flex items-center gap-1.5 text-[11px] text-muted">
                      <Icon size={11} className="shrink-0" aria-hidden />
                      <span className="truncate">{r.text}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-auto pt-3">
                <FollowButton targetId={p.id} visibility={p.visibility} initialFollowing={false} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

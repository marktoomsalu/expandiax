import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { whereAmI } from "@/lib/location";
import { loadNetworkEvents } from "@/lib/networkEvents";
import { sourcesCredit } from "@/lib/eventSources";
import { NEARBY_CATEGORY_LABEL } from "@/lib/eventCategories";
import type { NearbyCategory } from "@/lib/concerts";
import { ExploreCity } from "@/components/ExploreCity";
import { ExploreListShell } from "@/components/network/ExploreCards";
import { EventCardSmall, cityQuery } from "@/components/network/FeedExplore";
import { cn } from "@/lib/utils";
import { whenOptions } from "@/lib/whenRange";
import { CalendarDays } from "lucide-react";

export const metadata = { title: "What's on" };

type Params = { city?: string; cc?: string; lat?: string; lng?: string; kind?: string; when?: string };

/** "See all" for the Explore tab's events: everything on near the Explore city, by kind. */
export default async function ExploreEventsPage({ searchParams }: { searchParams?: Params }) {
  const user = await getAuthUser();
  if (!user) redirect("/sign-in?next=/explore/events");
  const supabase = createClient();
  const { data: me } = await supabase.from("profiles").select("home_country_code").eq("id", user.id).single();
  const here = whereAmI(me?.home_country_code ?? null, searchParams);
  const whenChoices = whenOptions(new Date());
  const when = whenChoices.find((w) => w.key === searchParams?.when) ?? null;
  const events = await loadNetworkEvents(supabase, user.id, here?.where ?? null, 80, when ?? undefined, 80);

  const kinds = (Object.keys(NEARBY_CATEGORY_LABEL) as NearbyCategory[]).filter((k) => events.some((e) => e.category === k));
  const kind = kinds.find((k) => k === searchParams?.kind) ?? null;
  const shown = kind ? events.filter((e) => e.category === kind) : events;
  const city = cityQuery(here);
  // City, kind and when travel together, so changing one keeps the others.
  const href = (k: NearbyCategory | null, w: string | null = when?.key ?? null) => {
    const qs = new URLSearchParams(city.slice(1));
    if (k) qs.set("kind", k);
    if (w) qs.set("when", w);
    const s = qs.toString();
    return `/explore/events${s ? `?${s}` : ""}`;
  };
  const chip = (on: boolean, soft = false) =>
    cn(
      "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
      on
        ? soft
          ? "border-accent bg-accent-soft text-accent"
          : "border-accent bg-accent text-white"
        : "border-line bg-surface text-muted hover:border-accent/50 hover:text-ink"
    );

  return (
    <ExploreListShell
      title={here ? `What's on near ${here.place}` : "What's on"}
      sub={`Concerts, sport and shows ${when ? (when.key.length === 7 ? `in ${when.label}` : when.label.toLowerCase()) : "in the next three months"} - and what people you follow are going to.`}
      back={`/feed?tab=explore${city ? `&${city.slice(1)}` : ""}`}
    >
      <div className="mt-5">
        <ExploreCity place={here?.place ?? null} picked={here?.source === "picked"} basePath="/explore/events" />
      </div>
      {kinds.length > 1 && (
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
          <Link href={href(null)} scroll={false} className={chip(!kind)}>
            All
          </Link>
          {kinds.map((k) => (
            <Link key={k} href={href(k)} scroll={false} className={chip(kind === k)}>
              {NEARBY_CATEGORY_LABEL[k]}
            </Link>
          ))}
        </div>
      )}
      <div className="no-scrollbar -mx-5 mt-3 flex items-center gap-2 overflow-x-auto px-5 pb-1" role="group" aria-label="When">
        <CalendarDays size={16} className="shrink-0 text-muted" aria-hidden />
        <Link href={href(kind, null)} scroll={false} className={chip(!when, true)}>
          Any time
        </Link>
        {whenChoices.map((w) => (
          <Link key={w.key} href={href(kind, w.key)} scroll={false} className={chip(when?.key === w.key, true)}>
            {w.label}
          </Link>
        ))}
      </div>
      {shown.length > 0 ? (
        <>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {shown.map((e) => (
              <EventCardSmall key={e.key} e={e} wide />
            ))}
          </ul>
          {shown.some((e) => e.source) && <p className="mt-3 text-[11px] text-muted">{sourcesCredit(shown.map((e) => e.source))}</p>}
        </>
      ) : (
        <p className="mt-10 text-center text-sm text-muted">
          {when ? `Nothing on here ${when.key.length === 7 ? `in ${when.label}` : when.label.toLowerCase()} yet - try other dates or another city.` : "Nothing on here in the next three months yet - try another city."}
        </p>
      )}
    </ExploreListShell>
  );
}

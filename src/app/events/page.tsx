import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EventList } from "@/components/EventList";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { RatingStars } from "@/components/Rating";
import { formatDate } from "@/lib/utils";
import type { Event, EventMedia } from "@/lib/types";

export const metadata = { title: "Events" };

type Row = Event & { event_media: EventMedia[] };

export default async function EventsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data } = await supabase
    .from("events")
    .select("*, event_media!event_media_event_id_fkey(*)")
    .eq("user_id", user.id)
    .order("event_date", { ascending: false });

  const events = (data ?? []) as Row[];

  const uniqueTitles = new Set(events.map((e) => e.title)).size;
  const uniqueCountries = new Set(events.map((e) => e.country_code)).size;
  const uniqueCities = new Set(events.map((e) => e.city.toLowerCase()).filter(Boolean)).size;

  const byTitle = new Map<string, number>();
  for (const e of events) byTitle.set(e.title, (byTitle.get(e.title) ?? 0) + 1);
  const mostSeen = [...byTitle.entries()].sort((a, b) => b[1] - a[1])[0];

  const byYear = new Map<string, number>();
  for (const e of events) {
    const y = e.event_date.slice(0, 4);
    byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }
  const yearRows = [...byYear.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const maxYear = Math.max(1, ...yearRows.map(([, n]) => n));

  const favourite = events.find((e) => e.is_favourite);
  const topRated = [...events].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 3).filter((e) => e.rating);
  const latest = events[0];

  return (
    <div className="mx-auto max-w-shell px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Events</p>
          <h1 className="mt-2 text-3xl md:text-4xl">
            {events.length === 0 ? "Nothing logged yet." : `${events.length} moment${events.length === 1 ? "" : "s"} to remember.`}
          </h1>
        </div>
        <Link href="/events/new" className="btn-accent"><Plus size={17} /> Add event</Link>
      </div>

      {events.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Every unforgettable moment starts somewhere."
            body="Add the first event you never want to forget — a concert, a festival, a match, a wedding, anything."
            actionLabel="Add your first event"
            actionHref="/events/new"
          />
        </div>
      ) : (
        <>
          <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Events" value={events.length} detail={latest ? `latest: ${latest.title}, ${formatDate(latest.event_date)}` : undefined} />
            <StatCard label="Distinct" value={uniqueTitles} detail={mostSeen && mostSeen[1] > 1 ? `most repeated: ${mostSeen[0]} ×${mostSeen[1]}` : "every one a first"} />
            <StatCard label="Countries" value={uniqueCountries} detail="where these happened" />
            <StatCard label="Cities" value={uniqueCities} detail="stages, venues and cities" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <section className="card px-5 py-5" aria-labelledby="years-h">
              <h2 id="years-h" className="eyebrow">Events by year</h2>
              <ul className="mt-4 space-y-2.5">
                {yearRows.map(([y, n]) => (
                  <li key={y} className="flex items-center gap-3 text-sm">
                    <span className="w-10 tabular-nums text-muted">{y}</span>
                    <span className="h-2 rounded-full bg-accent" style={{ width: `${(n / maxYear) * 70}%` }} aria-hidden />
                    <span className="tabular-nums">{n}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card px-5 py-5" aria-labelledby="top-h">
              <h2 id="top-h" className="eyebrow">Highest rated</h2>
              <ul className="mt-4 space-y-3">
                {topRated.length === 0 && <li className="text-sm text-muted">Rate your events to see them here.</li>}
                {topRated.map((e) => (
                  <li key={e.id}>
                    <Link href={`/events/${e.id}/edit`} className="group block">
                      <p className="font-serif group-hover:text-accent">{e.title}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                        <RatingStars value={e.rating} size={12} /> {e.event_date.slice(0, 4)} · {e.city || e.country_name}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card flex flex-col px-5 py-5" aria-labelledby="fav-h">
              <h2 id="fav-h" className="eyebrow">Your favourite</h2>
              {favourite ? (
                <Link href={`/events/${favourite.id}/edit`} className="group mt-4">
                  <p className="font-serif text-2xl leading-tight group-hover:text-accent">{favourite.title}</p>
                  {favourite.subtitle && <p className="mt-1 text-sm italic text-muted">{favourite.subtitle}</p>}
                  <p className="mt-2 text-xs text-muted">{formatDate(favourite.event_date)} · {favourite.city || favourite.country_name}</p>
                </Link>
              ) : (
                <p className="mt-4 text-sm text-muted">Mark one event as your favourite when editing it, and it will live here.</p>
              )}
            </section>
          </div>

          <section className="mt-12" aria-labelledby="all-h">
            <h2 id="all-h" className="text-xl">All events</h2>
            <div className="mt-4">
              <EventList events={events} hrefBase="/events" editable />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

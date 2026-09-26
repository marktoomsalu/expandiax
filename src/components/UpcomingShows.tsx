import { CalendarClock, Ticket } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import { tourHighlights, upcomingConfigured, upcomingShows, type UpcomingShow } from "@/lib/concerts";
import { formatDate } from "@/lib/utils";
import { ExternalLink } from "./ExternalLink";

// Server components — render them inside <Suspense> so a slow outside service
// never holds up the rest of the page. With no key configured, or nothing
// coming up, they render nothing at all.

function ShowRow({ show }: { show: UpcomingShow }) {
  const country = countryByCode(show.countryCode);
  const where = [show.city, country?.name ?? show.countryName].filter(Boolean).join(", ");
  const body = (
    <>
      <span className="flex w-12 shrink-0 flex-col items-center rounded-md border border-line bg-raised py-1 leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">
          {new Date(`${show.date}T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}
        </span>
        <span className="font-serif text-lg">{Number(show.date.slice(8, 10))}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {country?.flag} {where || show.venue}
        </span>
        <span className="block truncate text-xs text-muted">
          {show.venue} · {formatDate(show.date)}
        </span>
      </span>
      {show.url && (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent">
          <Ticket size={13} aria-hidden /> Tickets
        </span>
      )}
    </>
  );
  const cls = "flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5";
  return show.url ? (
    <ExternalLink href={show.url} className={`${cls} transition-colors hover:border-accent`}>
      {body}
    </ExternalLink>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function SourceNote({ shows }: { shows: UpcomingShow[] }) {
  const source = shows[0]?.source;
  if (!source) return null;
  return (
    <p className="mt-2 text-[11px] text-muted">
      Dates from {source === "bandsintown" ? "Bandsintown" : "Ticketmaster"}
    </p>
  );
}

/** Concert page: where this artist plays next. */
export async function ArtistUpcomingShows({ artist, limit = 5 }: { artist: string; limit?: number }) {
  if (!upcomingConfigured() || !artist.trim()) return null;
  const shows = await upcomingShows(artist, limit).catch(() => []);
  if (shows.length === 0) return null;
  return (
    <section className="mt-12 border-t border-line pt-8" aria-labelledby="upcoming-h">
      <h2 id="upcoming-h" className="flex items-center gap-2 text-xl">
        <CalendarClock size={18} className="text-accent" aria-hidden /> {artist} live next
      </h2>
      <ul className="mt-4 space-y-2">
        {shows.map((s) => (
          <li key={s.id}>
            <ShowRow show={s} />
          </li>
        ))}
      </ul>
      <SourceNote shows={shows} />
    </section>
  );
}

/** Feed: the artists you've seen live who are playing again — dates near you first. */
export async function ArtistsOnTour({ artists, homeCountry }: { artists: string[]; homeCountry: string | null }) {
  if (!upcomingConfigured() || artists.length === 0) return null;
  const byArtist = await Promise.all(
    artists.map(async (artist) => ({ artist, shows: await upcomingShows(artist, 20).catch(() => []) }))
  );
  const tours = tourHighlights(byArtist, homeCountry);
  if (tours.length === 0) return null;
  return (
    <section className="mt-10" aria-labelledby="on-tour-h">
      <h2 id="on-tour-h" className="flex items-center gap-1.5 text-sm font-medium text-muted">
        <CalendarClock size={14} aria-hidden /> Seen them live? They&rsquo;re back
      </h2>
      <div className="mt-4 space-y-5">
        {tours.map((t) => (
          <div key={t.artist}>
            <p className="font-serif text-lg">
              {t.artist}
              {t.total > t.shows.length && (
                <span className="ml-2 font-sans text-xs text-muted">+{t.total - t.shows.length} more dates</span>
              )}
            </p>
            <ul className="mt-2 space-y-2">
              {t.shows.map((s) => (
                <li key={s.id}>
                  <ShowRow show={s} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <SourceNote shows={tours[0].shows} />
    </section>
  );
}

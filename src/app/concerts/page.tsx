import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ConcertList } from "@/components/ConcertList";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { RatingStars } from "@/components/Rating";
import { formatDate } from "@/lib/utils";
import type { Concert, ConcertMedia } from "@/lib/types";

export const metadata = { title: "Concerts" };

type Row = Concert & { concert_media: ConcertMedia[] };

export default async function ConcertsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data } = await supabase
    .from("concerts")
    .select("*, concert_media!concert_media_concert_id_fkey(*)")
    .eq("user_id", user.id)
    .order("concert_date", { ascending: false });

  const concerts = (data ?? []) as Row[];

  const uniqueArtists = new Set(concerts.map((c) => c.artist_name)).size;
  const uniqueCountries = new Set(concerts.map((c) => c.country_code)).size;
  const uniqueCities = new Set(concerts.map((c) => c.city.toLowerCase()).filter(Boolean)).size;

  const byArtist = new Map<string, number>();
  for (const c of concerts) byArtist.set(c.artist_name, (byArtist.get(c.artist_name) ?? 0) + 1);
  const mostSeen = [...byArtist.entries()].sort((a, b) => b[1] - a[1])[0];

  const byYear = new Map<string, number>();
  for (const c of concerts) {
    const y = c.concert_date.slice(0, 4);
    byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }
  const yearRows = [...byYear.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const maxYear = Math.max(1, ...yearRows.map(([, n]) => n));

  const favourite = concerts.find((c) => c.is_favourite);
  const topRated = [...concerts].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 3).filter((c) => c.rating);
  const latest = concerts[0];

  return (
    <div className="mx-auto max-w-shell px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Concerts</p>
          <h1 className="mt-2 text-3xl md:text-4xl">
            {concerts.length === 0 ? "The setlist of your life." : `${concerts.length} night${concerts.length === 1 ? "" : "s"} to remember.`}
          </h1>
        </div>
        <Link href="/concerts/new" className="btn-accent"><Plus size={17} /> Add concert</Link>
      </div>

      {concerts.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Every unforgettable night starts somewhere."
            body="Add the first concert you never want to forget — the artist, the venue, the moment."
            actionLabel="Add your first concert"
            actionHref="/concerts/new"
          />
        </div>
      ) : (
        <>
          <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Concerts" value={concerts.length} detail={latest ? `latest: ${latest.artist_name}, ${formatDate(latest.concert_date)}` : undefined} />
            <StatCard label="Artists seen" value={uniqueArtists} detail={mostSeen && mostSeen[1] > 1 ? `most seen: ${mostSeen[0]} ×${mostSeen[1]}` : "every one a first"} />
            <StatCard label="Countries" value={uniqueCountries} detail="where the music found you" />
            <StatCard label="Cities" value={uniqueCities} detail="stages under different skies" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <section className="card px-5 py-5" aria-labelledby="years-h">
              <h2 id="years-h" className="eyebrow">Concerts by year</h2>
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
                {topRated.length === 0 && <li className="text-sm text-muted">Rate your concerts to see them here.</li>}
                {topRated.map((c) => (
                  <li key={c.id}>
                    <Link href={`/concerts/${c.id}/edit`} className="group block">
                      <p className="font-serif group-hover:text-accent">{c.artist_name}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                        <RatingStars value={c.rating} size={12} /> {c.concert_date.slice(0, 4)} · {c.city || c.country_name}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card flex flex-col px-5 py-5" aria-labelledby="fav-h">
              <h2 id="fav-h" className="eyebrow">Your favourite</h2>
              {favourite ? (
                <Link href={`/concerts/${favourite.id}/edit`} className="group mt-4">
                  <p className="font-serif text-2xl leading-tight group-hover:text-accent">{favourite.artist_name}</p>
                  {favourite.concert_name && <p className="mt-1 text-sm italic text-muted">{favourite.concert_name}</p>}
                  <p className="mt-2 text-xs text-muted">{formatDate(favourite.concert_date)} · {favourite.city || favourite.country_name}</p>
                </Link>
              ) : (
                <p className="mt-4 text-sm text-muted">Mark one concert as your favourite when editing it, and it will live here.</p>
              )}
            </section>
          </div>

          <section className="mt-12" aria-labelledby="all-h">
            <h2 id="all-h" className="text-xl">All concerts</h2>
            <div className="mt-4">
              <ConcertList concerts={concerts} hrefBase="/concerts" editable />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

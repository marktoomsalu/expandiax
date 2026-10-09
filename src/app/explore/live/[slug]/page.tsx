import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { eventTypeMeta } from "@/lib/events";
import { liveKey, liveName, type LiveRow } from "@/lib/explore";
import { LIVE_TYPES } from "@/lib/exploreData";
import { IWasThereButton } from "@/components/IWasThereButton";
import { ArtistUpcomingShows } from "@/components/UpcomingShows";
import { formatDate } from "@/lib/utils";
import { MembersOnly } from "@/components/MembersOnly";
import { DreamButton } from "@/components/network/DreamButton";
import { isDreamEvent } from "@/lib/dreams";

type Row = LiveRow & {
  venue: string;
  city: string;
  country_code: string;
  country_name: string;
  spotify_artist_id: string | null;
  profiles: { username: string; display_name: string; avatar_url: string | null } | null;
};

async function load(slug: string) {
  const words = slug.split("-").filter(Boolean).slice(0, 6);
  if (words.length === 0) return null;
  const pattern = `%${words.join("%")}%`;
  const supabase = createClient();
  const { data } = await supabase
    .from("events")
    .select("id, user_id, event_type, title, spotify_artist_id, spotify_artist_name, spotify_artist_image, event_date, venue, city, country_code, country_name, profiles(username, display_name, avatar_url)")
    .eq("is_public", true)
    .in("event_type", [...LIVE_TYPES])
    .or(`title.ilike.${pattern},spotify_artist_name.ilike.${pattern}`)
    .order("event_date", { ascending: false })
    .limit(500);
  const key = liveKey(words.join(""));
  const rows = ((data ?? []) as unknown as Row[]).filter((e) => liveKey(liveName(e)) === key);
  return rows.length ? rows : null;
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const rows = await load(params.slug);
  return { title: rows ? liveName(rows[0]) : "Explore" };
}

/**
 * Everyone's memories of one artist, festival or event — grouped by the
 * night it happened, so you can see who else was there and add your own.
 */
export default async function LiveHubPage({ params }: { params: { slug: string } }) {
  const rows = await load(params.slug);
  if (!rows) notFound();
  const viewer = await getAuthUser();
  const name = liveName(rows[0]);
  const type = rows[0].event_type;
  const Icon = eventTypeMeta(type).icon;
  const image = rows.find((r) => r.spotify_artist_image)?.spotify_artist_image ?? null;
  const people = new Set(rows.map((r) => r.user_id)).size;
  const dreaming = viewer ? await isDreamEvent(createClient(), name) : false;

  // One group per night (festivals and races can span a few days — the date people logged is fine).
  const nights = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${r.event_date}|${(r.city || r.country_code).toLowerCase()}`;
    nights.set(k, [...(nights.get(k) ?? []), r]);
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/explore" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Explore
      </Link>

      <div className="mt-6 flex items-center gap-5">
        <span className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-raised sm:h-28 sm:w-28">
          {image ? (
            <Image src={image} alt="" fill sizes="112px" className="object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent to-orange-500">
              <Icon size={40} className="text-white/85" aria-hidden />
            </span>
          )}
        </span>
        <div className="min-w-0">
          <p className="eyebrow">{eventTypeMeta(type).label}</p>
          <h1 className="mt-1 text-4xl md:text-5xl">{name}</h1>
          <p className="mt-1 text-sm text-muted">
            {rows.length} {rows.length === 1 ? "memory" : "memories"} · {people} {people === 1 ? "person" : "people"} · {nights.size} {nights.size === 1 ? "date" : "dates"}
          </p>
          {viewer && (
            <div className="mt-3">
              <DreamButton target={{ kind: "event", name, eventType: type, image }} initial={dreaming} label={name} />
            </div>
          )}
        </div>
      </div>

      {type === "concert" && (
        <Suspense fallback={null}>
          <ArtistUpcomingShows artist={name} />
        </Suspense>
      )}

      <section className="mt-10" aria-labelledby="nights-h">
        <h2 id="nights-h" className="text-2xl">Who was there</h2>
        <ul className="mt-4 space-y-3">
          {[...nights.values()].map((group) => {
            const first = group[0];
            const country = countryByCode(first.country_code);
            const where = [first.venue, first.city || country?.name].filter(Boolean).join(", ");
            const mine = viewer ? group.find((r) => r.user_id === viewer.id) : undefined;
            return (
              <li key={first.id} className="card px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-serif text-lg">{formatDate(first.event_date)}</p>
                    <p className="truncate text-xs text-muted">
                      {country?.flag} {where}
                    </p>
                  </div>
                  {viewer && !mine && (
                    <IWasThereButton
                      label="I was there too"
                      prefill={{
                        title: first.title,
                        event_type: first.event_type,
                        event_date: first.event_date,
                        venue: first.venue,
                        city: first.city,
                        country_code: first.country_code,
                        country_name: first.country_name || country?.name || "",
                        spotify_artist_id: first.spotify_artist_id,
                        spotify_artist_name: first.spotify_artist_name,
                        spotify_artist_image: first.spotify_artist_image,
                      }}
                    />
                  )}
                  {mine && <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">You were there</span>}
                </div>
                {!viewer ? (
                  <MembersOnly count={new Set(group.map((r) => r.user_id)).size} next={`/explore/live/${params.slug}`} />
                ) : (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {group.map((r) =>
                      r.profiles ? (
                      <li key={r.id}>
                        <Link
                          href={`/u/${r.profiles.username}/events/${r.id}`}
                          className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-xs hover:border-accent"
                        >
                          {r.profiles.avatar_url ? (
                            <Image src={r.profiles.avatar_url} alt="" width={24} height={24} className="h-6 w-6 rounded-full object-cover" />
                          ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-raised font-serif text-[11px] text-muted">{r.profiles.display_name.charAt(0)}</span>
                          )}
                          {r.profiles.display_name}
                        </Link>
                      </li>
                      ) : null
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {viewer && (
        <Link href="/events/new" className="btn-accent mt-10 inline-flex">
          <Plus size={16} /> Log a {eventTypeMeta(type).label.toLowerCase()}
        </Link>
      )}
    </div>
  );
}

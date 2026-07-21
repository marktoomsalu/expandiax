import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, CalendarDays, MapPin, Music4 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { RatingStars } from "@/components/Rating";
import { ReportButton } from "@/components/ReportButton";
import { formatDate } from "@/lib/utils";
import type { Concert, ConcertFull } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: { username: string; id: string };
}): Promise<Metadata> {
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", params.username.toLowerCase())
    .maybeSingle();
  if (!profile) return { title: "Concert" };

  const { data: concert } = await supabase
    .from("concerts")
    .select("artist_name, concert_name, city, country_name, cover_media_id, concert_media!concert_media_concert_id_fkey(id, public_url, media_type)")
    .eq("id", params.id)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!concert) return { title: "Concert" };

  const title = `${concert.artist_name} — ${profile.display_name}`;
  const description = `${profile.display_name} saw ${concert.artist_name}${concert.concert_name ? ` (${concert.concert_name})` : ""} in ${[concert.city, concert.country_name].filter(Boolean).join(", ")}.`;
  const cover =
    concert.concert_media.find((m) => m.id === concert.cover_media_id && m.media_type === "image") ??
    concert.concert_media.find((m) => m.media_type === "image");

  return {
    title,
    description,
    openGraph: { title, description, images: cover ? [cover.public_url] : undefined },
    twitter: { title, description },
  };
}

export default async function PublicConcertPage({
  params,
}: {
  params: { username: string; id: string };
}) {
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", params.username.toLowerCase())
    .maybeSingle();
  if (!profile) notFound();

  const { data } = await supabase
    .from("concerts")
    .select("*, concert_media!concert_media_concert_id_fkey(*)")
    .eq("id", params.id)
    .eq("user_id", profile.id)
    .maybeSingle();
  const concert = data as ConcertFull | null;
  if (!concert) notFound();

  const { data: sameArtist } = await supabase
    .from("concerts")
    .select("id, artist_name, concert_name, concert_date, city, country_name, rating")
    .eq("user_id", profile.id)
    .eq("artist_name", concert.artist_name)
    .neq("id", concert.id)
    .order("concert_date", { ascending: false });

  const media = [...concert.concert_media].sort((a, b) => a.display_order - b.display_order);
  const images = media.filter((m) => m.media_type === "image");
  const videos = media.filter((m) => m.media_type === "video");
  const cover = media.find((m) => m.id === concert.cover_media_id) ?? images[0];
  const galleryImages = images.filter((m) => m.id !== cover?.id);
  const meta = countryByCode(concert.country_code);
  const others = (sameArtist ?? []) as Concert[];

  return (
    <div>
      {/* Cinematic header */}
      <div className="relative flex min-h-[52vh] items-end overflow-hidden bg-[#14110d]">
        {cover && (
          <Image
            src={cover.public_url}
            alt=""
            aria-hidden
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-80"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" aria-hidden />
        <div className="relative mx-auto w-full max-w-shell px-5 pb-10 pt-28 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
            {formatDate(concert.concert_date)}
          </p>
          <h1 className="mt-2 max-w-3xl text-5xl leading-[1.05] md:text-7xl">{concert.artist_name}</h1>
          {concert.concert_name && <p className="mt-3 font-serif text-xl italic text-white/85">{concert.concert_name}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/80">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} aria-hidden /> {[concert.venue, concert.city, meta?.name].filter(Boolean).join(", ")}
            </span>
            <RatingStars value={concert.rating} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link href={`/u/${profile.username}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft size={15} /> {profile.display_name}&rsquo;s archive
        </Link>

        {concert.review && (
          <blockquote className="mt-8 border-l-2 border-accent pl-5 font-serif text-xl italic leading-relaxed md:text-2xl">
            &ldquo;{concert.review}&rdquo;
          </blockquote>
        )}

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          {concert.favourite_song && (
            <div className="card px-4 py-3.5">
              <dt className="eyebrow flex items-center gap-1.5"><Music4 size={12} aria-hidden /> Favourite song</dt>
              <dd className="mt-1.5 font-serif text-lg">{concert.favourite_song}</dd>
            </div>
          )}
          {concert.setlist_notes && (
            <div className="card px-4 py-3.5">
              <dt className="eyebrow flex items-center gap-1.5"><CalendarDays size={12} aria-hidden /> Setlist notes</dt>
              <dd className="mt-1.5 text-sm leading-relaxed">{concert.setlist_notes}</dd>
            </div>
          )}
        </dl>

        {galleryImages.length > 0 && (
          <section className="mt-10" aria-label="Photo gallery">
            <div className="grid grid-cols-2 gap-3">
              {galleryImages.map((m) => (
                <div key={m.id} className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-line">
                  <Image
                    src={m.public_url}
                    alt={m.caption || `${concert.artist_name} live`}
                    fill
                    sizes="50vw"
                    loading="lazy"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {videos.length > 0 && (
          <section className="mt-10" aria-label="Videos">
            <div className="space-y-5">
              {videos.map((m) => (
                <figure key={m.id}>
                  <video src={m.public_url} controls preload="metadata" className="w-full rounded-lg border border-line bg-black" />
                  {m.caption && <figcaption className="mt-1.5 text-xs text-muted">{m.caption}</figcaption>}
                </figure>
              ))}
            </div>
          </section>
        )}

        {meta && (
          <p className="mt-10 text-sm text-muted">
            Part of{" "}
            <Link href={`/u/${profile.username}/countries/${meta.code.toLowerCase()}`} className="text-accent underline-offset-4 hover:underline">
              {meta.flag} {meta.name}
            </Link>{" "}
            in {profile.display_name}&rsquo;s world.
          </p>
        )}

        {others.length > 0 && (
          <section className="mt-12 border-t border-line pt-8" aria-labelledby="others-h">
            <h2 id="others-h" className="text-xl">More nights with {concert.artist_name}</h2>
            <ul className="mt-4 space-y-3">
              {others.map((c) => (
                <li key={c.id}>
                  <Link href={`/u/${profile.username}/concerts/${c.id}`} className="card group flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-serif group-hover:text-accent">{c.concert_name || formatDate(c.concert_date)}</p>
                      <p className="text-xs text-muted">{formatDate(c.concert_date)} · {[c.city, c.country_name].filter(Boolean).join(", ")}</p>
                    </div>
                    <RatingStars value={c.rating} size={13} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-12 flex justify-center border-t border-line pt-6">
          <ReportButton targetType="concert" targetId={concert.id} targetUrl={`/u/${profile.username}/concerts/${concert.id}`} />
        </div>
      </div>
    </div>
  );
}

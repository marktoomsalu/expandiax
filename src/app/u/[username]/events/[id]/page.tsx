import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, FileText, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { eventTypeMeta } from "@/lib/events";
import { RatingStars } from "@/components/Rating";
import { ReportButton } from "@/components/ReportButton";
import { SpotifyEmbed } from "@/components/SpotifyEmbed";
import { formatDate } from "@/lib/utils";
import type { Event, EventFull } from "@/lib/types";

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
  if (!profile) return { title: "Event" };

  const { data: event } = await supabase
    .from("events")
    .select("title, subtitle, city, country_name, cover_media_id, event_media!event_media_event_id_fkey(id, public_url, media_type)")
    .eq("id", params.id)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!event) return { title: "Event" };

  const title = `${event.title} — ${profile.display_name}`;
  const description = `${profile.display_name} was at ${event.title}${event.subtitle ? ` (${event.subtitle})` : ""} in ${[event.city, event.country_name].filter(Boolean).join(", ")}.`;
  const cover =
    event.event_media.find((m) => m.id === event.cover_media_id && m.media_type === "image") ??
    event.event_media.find((m) => m.media_type === "image");

  return {
    title,
    description,
    openGraph: { title, description, images: cover ? [cover.public_url] : undefined },
    twitter: { title, description },
  };
}

export default async function PublicEventPage({
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
    .from("events")
    .select("*, event_media!event_media_event_id_fkey(*)")
    .eq("id", params.id)
    .eq("user_id", profile.id)
    .maybeSingle();
  const event = data as EventFull | null;
  if (!event) notFound();

  const { data: sameTitle } = await supabase
    .from("events")
    .select("id, title, subtitle, event_date, city, country_name, rating")
    .eq("user_id", profile.id)
    .eq("title", event.title)
    .neq("id", event.id)
    .order("event_date", { ascending: false });

  const media = [...event.event_media].sort((a, b) => a.display_order - b.display_order);
  const images = media.filter((m) => m.media_type === "image");
  const videos = media.filter((m) => m.media_type === "video");
  const cover = media.find((m) => m.id === event.cover_media_id) ?? images[0];
  const galleryImages = images.filter((m) => m.id !== cover?.id);
  const meta = countryByCode(event.country_code);
  const typeMeta = eventTypeMeta(event.event_type);
  const TypeIcon = typeMeta.icon;
  const others = (sameTitle ?? []) as Event[];

  return (
    <div>
      {/* Cinematic header */}
      <div className="relative flex min-h-[52vh] items-end overflow-hidden bg-[#14110d]">
        {(cover || event.spotify_artist_image) && (
          <Image
            src={cover?.public_url ?? event.spotify_artist_image!}
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
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
            <TypeIcon size={12} aria-hidden /> {typeMeta.label} · {formatDate(event.event_date)}
          </p>
          <h1 className="mt-2 max-w-3xl text-5xl leading-[1.05] md:text-7xl">{event.title}</h1>
          {event.subtitle && <p className="mt-3 font-serif text-xl italic text-white/85">{event.subtitle}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/80">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} aria-hidden /> {[event.venue, event.city, meta?.name].filter(Boolean).join(", ")}
            </span>
            <RatingStars value={event.rating} tone="light" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link href={`/u/${profile.username}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft size={15} /> {profile.display_name}&rsquo;s archive
        </Link>

        {event.review && (
          <blockquote className="mt-8 border-l-2 border-accent pl-5 font-serif text-xl italic leading-relaxed md:text-2xl">
            &ldquo;{event.review}&rdquo;
          </blockquote>
        )}

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          {event.highlight && (
            <div className="card px-4 py-3.5">
              <dt className="eyebrow flex items-center gap-1.5"><TypeIcon size={12} aria-hidden /> {typeMeta.highlightLabel}</dt>
              <dd className="mt-1.5 font-serif text-lg">{event.highlight}</dd>
              {event.spotify_favourite_track_id && (
                <div className="mt-3">
                  <SpotifyEmbed trackId={event.spotify_favourite_track_id} compact />
                </div>
              )}
            </div>
          )}
          {event.notes && (
            <div className="card px-4 py-3.5">
              <dt className="eyebrow flex items-center gap-1.5"><FileText size={12} aria-hidden /> {typeMeta.notesLabel}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed">{event.notes}</dd>
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
                    alt={m.caption || event.title}
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
            <h2 id="others-h" className="text-xl">More with {event.title}</h2>
            <ul className="mt-4 space-y-3">
              {others.map((e) => (
                <li key={e.id}>
                  <Link href={`/u/${profile.username}/events/${e.id}`} className="card group flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-serif group-hover:text-accent">{e.subtitle || formatDate(e.event_date)}</p>
                      <p className="text-xs text-muted">{formatDate(e.event_date)} · {[e.city, e.country_name].filter(Boolean).join(", ")}</p>
                    </div>
                    <RatingStars value={e.rating} size={13} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-12 flex justify-center border-t border-line pt-6">
          <ReportButton targetType="event" targetId={event.id} targetUrl={`/u/${profile.username}/events/${event.id}`} />
        </div>
      </div>
    </div>
  );
}

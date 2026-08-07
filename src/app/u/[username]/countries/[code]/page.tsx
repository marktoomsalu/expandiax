import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Pencil } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { RatingStars } from "@/components/Rating";
import { ReportButton } from "@/components/ReportButton";
import { ShareButton } from "@/components/ShareButton";
import { SpotifyEmbed } from "@/components/SpotifyEmbed";
import { PhotoGallery } from "@/components/PhotoGallery";
import { CommentSection } from "@/components/CommentSection";
import { formatDate, formatVisitRange, visitSortKey } from "@/lib/utils";
import type { CommentWithAuthor, Event, VisitedCountryFull } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: { username: string; code: string };
}): Promise<Metadata> {
  const meta = countryByCode(params.code);
  if (!meta) return { title: "Country" };

  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", params.username.toLowerCase())
    .maybeSingle();
  if (!profile) return { title: meta.name };

  const { data: country } = await supabase
    .from("visited_countries")
    .select(
      "cover_media_id, country_media!country_media_visited_country_id_fkey(id, public_url), country_visits(highlight, year, visited_from, visited_to)"
    )
    .eq("user_id", profile.id)
    .eq("country_code", meta.code)
    .maybeSingle();

  const title = `${meta.flag} ${meta.name} - ${profile.display_name}`;
  const recentVisit = country?.country_visits.length
    ? [...country.country_visits].sort((a, b) => visitSortKey(b).localeCompare(visitSortKey(a)))[0]
    : undefined;
  const description = recentVisit?.highlight || `${profile.display_name}'s memories from ${meta.name} on ExpandiaX.`;
  const cover = country?.country_media.find((m) => m.id === country.cover_media_id) ?? country?.country_media[0];

  return {
    title,
    description,
    openGraph: { title, description, images: cover ? [cover.public_url] : undefined },
    twitter: { title, description },
  };
}

export default async function PublicCountryPage({
  params,
}: {
  params: { username: string; code: string };
}) {
  const meta = countryByCode(params.code);
  if (!meta) notFound();

  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", params.username.toLowerCase())
    .maybeSingle();
  if (!profile) notFound();

  const viewer = await getAuthUser();
  const isOwnProfile = viewer?.id === profile.id;

  const [{ data }, { data: allCountries }, { data: relatedEvents }] = await Promise.all([
    supabase
      .from("visited_countries")
      .select("*, country_visits(*), country_cities(*), country_media!country_media_visited_country_id_fkey(*)")
      .eq("user_id", profile.id)
      .eq("country_code", meta.code)
      .maybeSingle(),
    supabase
      .from("visited_countries")
      .select("country_code, country_name")
      .eq("user_id", profile.id)
      .order("country_name"),
    supabase
      .from("events")
      .select("*")
      .eq("user_id", profile.id)
      .eq("country_code", meta.code)
      .eq("is_public", true)
      .order("event_date", { ascending: false }),
  ]);

  const country = data as VisitedCountryFull | null;
  if (!country) notFound();

  const { data: commentRows } = await supabase
    .from("comments")
    .select("*, profiles(username, display_name, avatar_url)")
    .eq("kind", "country")
    .eq("target_id", country.id)
    .order("created_at", { ascending: true });
  const comments = (commentRows ?? []) as CommentWithAuthor[];

  const allMedia = [...country.country_media].sort((a, b) => a.display_order - b.display_order);
  const visitsByRecency = [...country.country_visits].sort((a, b) => visitSortKey(b).localeCompare(visitSortKey(a)));
  const mostRecentVisit = visitsByRecency[0];
  // Cover priority: an explicit pick, else the most recent trip's own
  // photo, else any photo — every photo now belongs to some trip.
  const cover =
    allMedia.find((m) => m.id === country.cover_media_id) ??
    (mostRecentVisit ? allMedia.find((m) => m.country_visit_id === mostRecentVisit.id) : undefined) ??
    allMedia[0];
  const years = [...new Set(country.country_visits.map((v) => v.year))].sort();
  const highlightedVisits = [...country.country_visits]
    .filter(
      (v) =>
        v.highlight.trim() ||
        v.spotify_track_id ||
        country.country_media.some((m) => m.country_visit_id === v.id) ||
        country.country_cities.some((c) => c.country_visit_id === v.id)
    )
    .sort((a, b) => visitSortKey(b).localeCompare(visitSortKey(a)));
  const events = (relatedEvents ?? []) as Event[];

  const list = allCountries ?? [];
  const idx = list.findIndex((c) => c.country_code === meta.code);
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;

  return (
    <div>
      {cover && (
        <div className="relative h-[42vh] min-h-64 w-full overflow-hidden">
          <Image
            src={cover.public_url}
            alt={cover.caption || `Photo from ${meta.name}`}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" aria-hidden />
        </div>
      )}

      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link href={`/u/${profile.username}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft size={15} /> {profile.display_name}&rsquo;s world
        </Link>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{meta.continent}{years.length > 0 && <> · {years.join(" · ")}</>}</p>
            <h1 className="mt-2 text-4xl md:text-5xl">
              <span aria-hidden className="mr-2">{meta.flag}</span>{meta.name}
            </h1>
          </div>
          {isOwnProfile && (
            <Link
              href={`/my-world/${meta.code.toLowerCase()}`}
              className="inline-flex items-center gap-1.5 text-sm text-accent underline-offset-4 hover:underline"
            >
              <Pencil size={14} /> Edit
            </Link>
          )}
        </div>

        {highlightedVisits.length > 0 && (
          <section className="mt-10" aria-label="Trips">
            <ul className="space-y-6">
              {highlightedVisits.map((v) => {
                const visitPhotos = country.country_media
                  .filter((m) => m.country_visit_id === v.id)
                  .sort((a, b) => a.display_order - b.display_order);
                const visitCities = country.country_cities.filter((c) => c.country_visit_id === v.id).map((c) => c.city_name);
                return (
                  <li key={v.id} className="border-l-2 border-line pl-5">
                    <p className="eyebrow">{formatVisitRange(v)}</p>
                    {visitCities.length > 0 && <p className="mt-1 text-sm text-muted">{visitCities.join(" · ")}</p>}
                    {v.highlight && <p className="mt-1 text-sm leading-relaxed">{v.highlight}</p>}
                    {visitPhotos.length > 0 && (
                      <div className="mt-3">
                        <PhotoGallery
                          photos={visitPhotos.map((m) => ({ id: m.id, url: m.public_url, alt: m.caption || `Photo from this trip to ${meta.name}` }))}
                          gridClassName="grid grid-cols-3 gap-2"
                          itemClassName="relative aspect-square w-full overflow-hidden rounded-lg border border-line"
                          sizes="33vw"
                          coverId={v.cover_media_id}
                        />
                      </div>
                    )}
                    {v.spotify_track_id && (
                      <div className="mt-3">
                        <SpotifyEmbed trackId={v.spotify_track_id} compact />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {events.length > 0 && (
          <section className="mt-12" aria-labelledby="rel-h">
            <h2 id="rel-h" className="text-xl">Events in {meta.name}</h2>
            <ul className="mt-4 space-y-3">
              {events.map((e) => (
                <li key={e.id}>
                  <Link href={`/u/${profile.username}/events/${e.id}`} className="card group flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-serif group-hover:text-accent">{e.title}</p>
                      <p className="text-xs text-muted">{formatDate(e.event_date)} · {[e.venue, e.city].filter(Boolean).join(", ")}</p>
                    </div>
                    <RatingStars value={e.rating} size={13} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-12 border-t border-line pt-8" aria-labelledby="comments-h">
          <h2 id="comments-h" className="text-xl">Comments</h2>
          <div className="mt-4">
            <CommentSection kind="country" targetId={country.id} posterId={profile.id} initialComments={comments} />
          </div>
        </section>

        <nav aria-label="Other countries" className="mt-14 flex items-center justify-between border-t border-line pt-6 text-sm">
          {prev ? (
            <Link href={`/u/${profile.username}/countries/${prev.country_code.toLowerCase()}`} className="inline-flex items-center gap-1.5 text-muted hover:text-accent">
              <ArrowLeft size={14} /> {prev.country_name}
            </Link>
          ) : <span />}
          {next ? (
            <Link href={`/u/${profile.username}/countries/${next.country_code.toLowerCase()}`} className="inline-flex items-center gap-1.5 text-muted hover:text-accent">
              {next.country_name} <ArrowRight size={14} />
            </Link>
          ) : <span />}
        </nav>

        <div className="mt-6 flex items-center justify-center gap-6">
          {isOwnProfile && <ShareButton kind="country" targetId={country.id} title={`${meta.flag} ${meta.name}`} />}
          <ReportButton targetType="country" targetId={country.id} targetUrl={`/u/${profile.username}/countries/${meta.code.toLowerCase()}`} />
        </div>
      </div>
    </div>
  );
}

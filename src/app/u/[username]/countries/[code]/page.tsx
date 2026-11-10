import { buildCountryView } from "@/lib/countryView";
import { countrySummary } from "@/lib/tripPlaces";
import { CountryHero } from "@/components/CountryHero";
import { CountryPlaces } from "@/components/CountryPlaces";
import { StayRow } from "@/components/StayRow";
import Link from "next/link";
import { stockPhotoFor } from "@/lib/stockPhotos";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Pencil } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { territoryByCode, territoryToMeta } from "@/lib/territories";
import { RatingStars } from "@/components/Rating";
import { ReportButton } from "@/components/ReportButton";
import { BlockButton } from "@/components/BlockButton";
import { ShareButton } from "@/components/ShareButton";
import { SpotifyEmbed } from "@/components/SpotifyEmbed";
import { PhotoGallery } from "@/components/PhotoGallery";
import { CommentSection } from "@/components/CommentSection";
import { formatDate, formatVisitRange, visitSortKey } from "@/lib/utils";
import type { CommentWithAuthor, Event, VisitedCountryFull } from "@/lib/types";
import { signMedia } from "@/lib/signedMedia";

export async function generateMetadata({
  params,
}: {
  params: { username: string; code: string };
}): Promise<Metadata> {
  const recognisedCountry = countryByCode(params.code);
  const territory = recognisedCountry ? null : territoryByCode(params.code);
  const meta = recognisedCountry ?? (territory ? territoryToMeta(territory) : null);
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
    // Link previews are fetched by other apps later, so they get a longer-lived link (public pages only).
    openGraph: { title, description, images: cover ? [await signMedia(cover.public_url, { lifetimeDays: 30 })] : undefined },
    twitter: { title, description },
  };
}

export default async function PublicCountryPage({
  params,
}: {
  params: { username: string; code: string };
}) {
  const recognisedCountry = countryByCode(params.code);
  const territory = recognisedCountry ? null : territoryByCode(params.code);
  const meta = recognisedCountry ?? (territory ? territoryToMeta(territory) : null);
  if (!meta) notFound();
  const isTerritory = !!territory;

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
  ]).then((r) => signMedia(r));

  const country = data as VisitedCountryFull | null;
  if (!country) notFound();

  const { data: commentRows } = await supabase
    .from("comments")
    .select("*, profiles(username, display_name, avatar_url)")
    .eq("kind", "country")
    .eq("target_id", country.id)
    .order("created_at", { ascending: true });
  const comments = (commentRows ?? []) as CommentWithAuthor[];

  // The same page the owner sees on My World, read-only: their stays and
  // trips on a timeline, the places, and each trip's photos and notes below.
  // Row-level security has already left out anything they keep to themselves.
  const { heroPhoto, trips, places, cities } = buildCountryView(country, meta);
  const stock = heroPhoto ? null : stockPhotoFor(meta.code, profile.id);
  const tripById = new Map(trips.map((t) => [t.id, t]));
  const visitsNewest = [...country.country_visits].sort((a, b) => visitSortKey(b).localeCompare(visitSortKey(a)));
  const highlightedVisits = visitsNewest.filter(
    (v) =>
      v.highlight.trim() ||
      v.spotify_track_id ||
      country.country_media.some((m) => m.country_visit_id === v.id) ||
      cities.some((c) => c.country_visit_id === v.id)
  );
  // A place opens its most recent trip further down the page.
  const placeHref = (cityIds: string[]) => {
    const c = visitsNewest.map((v) => cities.find((x) => x.country_visit_id === v.id && cityIds.includes(x.id))).find(Boolean);
    return c ? `#trip-${c.country_visit_id}` : "#trips";
  };
  const events = (relatedEvents ?? []) as Event[];

  const list = allCountries ?? [];
  const idx = list.findIndex((c) => c.country_code === meta.code);
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;

  return (
    <div>
      <CountryHero
        visitedCountryId={country.id}
        flag={meta.flag}
        name={meta.name}
        continent={meta.continent}
        isTerritory={isTerritory}
        onlyMe={false}
        summary={countrySummary(visitsNewest, places.length, country.country_media.length)}
        photo={heroPhoto?.public_url ?? null}
        stock={stock}
        publicHref={null}
        initialFavourite={false}
        visitor={{
          backHref: `/u/${profile.username}`,
          backLabel: `${profile.display_name}\u2019s world`,
          exploreHref: `/explore/country/${meta.code.toLowerCase()}`,
        }}
      />

      <div className="mx-auto max-w-3xl space-y-8 px-5 pb-10 pt-8">
        {isOwnProfile && (
          <Link
            href={`/my-world/${meta.code.toLowerCase()}`}
            className="inline-flex items-center gap-1.5 text-sm text-accent underline-offset-4 hover:underline"
          >
            <Pencil size={14} /> Edit on My World
          </Link>
        )}

        <CountryPlaces places={places} countryCode={meta.code} hrefFor={placeHref} />

        {trips.length > 0 && (
          <section id="trips" aria-labelledby="trips-h" className="scroll-mt-24">
            <h2 id="trips-h" className="font-serif text-2xl">All stays &amp; trips</h2>
            <div className="mt-3">
              {trips.map((t, i) => (
                <StayRow key={t.id} stay={t} href={`#trip-${t.id}`} first={i === 0} last={i === trips.length - 1} readOnly />
              ))}
            </div>
          </section>
        )}

        {highlightedVisits.length > 0 && (
          <section aria-labelledby="memories-h">
            <h2 id="memories-h" className="font-serif text-2xl">Memories</h2>
            <ul className="mt-4 space-y-8">
              {highlightedVisits.map((v) => {
                const visitPhotos = country.country_media
                  .filter((m) => m.country_visit_id === v.id)
                  .sort((a, b) => a.display_order - b.display_order);
                const t = tripById.get(v.id);
                return (
                  <li key={v.id} id={`trip-${v.id}`} className="scroll-mt-24 border-l-2 pl-5" style={{ borderColor: v.kind === "lived" ? "#fa51a2" : "#fb7822" }}>
                    <p className="eyebrow">{formatVisitRange(v)}</p>
                    {t && <p className="mt-1 font-serif text-xl">{t.name}</p>}
                    {t?.places && t.places !== t.name && t.places !== v.highlight.trim() && <p className="mt-0.5 text-sm text-muted">{t.places}</p>}
                    {v.highlight && <p className="mt-2 text-sm leading-relaxed">{v.highlight}</p>}
                    {visitPhotos.length > 0 && (
                      <div className="mt-3">
                        <PhotoGallery
                          photos={visitPhotos.map((m) => ({ id: m.id, url: m.public_url, alt: m.caption || `Photo from this trip to ${meta.name}`, type: m.media_type }))}
                          gridClassName="grid grid-cols-3 gap-2"
                          itemClassName="relative aspect-square w-full overflow-hidden rounded-lg border border-line"
                          sizes="33vw"
                          coverId={isOwnProfile ? v.cover_media_id : null}
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
          {viewer && !isOwnProfile && <BlockButton targetId={profile.id} targetName={profile.display_name} targetUsername={profile.username} />}
        </div>
      </div>
    </div>
  );
}

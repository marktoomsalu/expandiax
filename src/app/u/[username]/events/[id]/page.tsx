import Link from "next/link";
import { Suspense } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, FileText, MapPin, Pencil } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { eventTypeMeta } from "@/lib/events";
import { RatingStars } from "@/components/Rating";
import { ReportButton } from "@/components/ReportButton";
import { BlockButton } from "@/components/BlockButton";
import { ShareButton } from "@/components/ShareButton";
import { SpotifyEmbed } from "@/components/SpotifyEmbed";
import { CommentSection } from "@/components/CommentSection";
import { IWasThereButton } from "@/components/IWasThereButton";
import { MomentPeople } from "@/components/trip/MomentPeople";
import { CollabInviteActions, MakeItMineButton, RequestCollabButton, UseExistingButton } from "@/components/CollabInviteActions";
import { MomentInviteCard } from "@/components/MomentInviteCard";
import { findOwnMatch } from "@/lib/companions";
import { invitePreview } from "@/lib/invitePreview";
import { alsoThere } from "@/lib/companions";
import type { TogetherEvent } from "@/lib/together";
import { PhotoGallery } from "@/components/PhotoGallery";
import { ArtistUpcomingShows } from "@/components/UpcomingShows";
import { formatDate } from "@/lib/utils";
import { focalPosition } from "@/lib/media";
import type { CommentWithAuthor, Event, EventFull } from "@/lib/types";
import { signMedia } from "@/lib/signedMedia";
import { loadCollaborators, loadMoment, namesTogether } from "@/lib/collab";
import { Users } from "lucide-react";

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
    .maybeSingle();
  if (!event) return { title: "Event" };

  const title = `${event.title} - ${profile.display_name}`;
  const description = `${profile.display_name} was at ${event.title}${event.subtitle ? ` (${event.subtitle})` : ""} in ${[event.city, event.country_name].filter(Boolean).join(", ")}.`;
  const cover =
    event.event_media.find((m) => m.id === event.cover_media_id && m.media_type === "image") ??
    event.event_media.find((m) => m.media_type === "image");

  return {
    title,
    description,
    // Link previews are fetched by other apps later, so they get a longer-lived link (public pages only).
    openGraph: { title, description, images: cover ? [await signMedia(cover.public_url, { lifetimeDays: 30 })] : undefined },
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

  const { data } = await signMedia(await supabase
    .from("events")
    .select("*, event_media!event_media_event_id_fkey(*)")
    .eq("id", params.id)
    .maybeSingle());
  const event = data as EventFull | null;
  if (!event) notFound();
  // Theirs, or an event they're a collaborator on (one shared post, migration 075).
  const collaborators = (await loadCollaborators(supabase, "event", event.id)).filter((c) => c.status === "accepted");
  if (event.user_id !== profile.id && !collaborators.some((c) => c.user_id === profile.id)) notFound();

  const viewer = await getAuthUser();
  const isOwnProfile = viewer?.id === profile.id;
  // Editing: its owner, or a collaborator given edit rights.
  const canEdit = !!viewer && (viewer.id === event.user_id || collaborators.some((c) => c.user_id === viewer.id && c.can_edit));
  // Who else was there, besides the person whose page this is.
  let ownerName = "";
  if (event.user_id !== profile.id) {
    const { data: o } = await supabase.from("profiles").select("display_name").eq("id", event.user_id).maybeSingle();
    ownerName = o?.display_name ?? "";
  }
  const together = namesTogether([ownerName, ...collaborators.filter((c) => c.user_id !== profile.id).map((c) => c.person?.display_name ?? "")].filter(Boolean));

  const [{ data: sameTitle }, { data: commentRows }, moment, { data: myPart }, { data: owner }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, subtitle, event_date, city, country_name, rating")
      .eq("user_id", profile.id)
      .eq("title", event.title)
      .neq("id", event.id)
      .order("event_date", { ascending: false }),
    supabase
      .from("comments")
      .select("*, profiles(username, display_name, avatar_url)")
      .eq("kind", "event")
      .eq("target_id", event.id)
      .order("created_at", { ascending: true }),
    loadMoment(supabase, "event", event.id, (username, id) => `/u/${username}/events/${id}`),
    // Your own part in it, if any: invited (to choose), or joined (to make it your own).
    viewer ? supabase.from("post_collaborators").select("id, status, own_target_id").eq("kind", "event").eq("target_id", event.id).eq("user_id", viewer.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("profiles").select("display_name").eq("id", event.user_id).maybeSingle(),
  ]);
  const ownerFull = (owner?.display_name ?? profile.display_name) as string;
  const onIt = !!moment?.memories.some((m) => m.person.id === viewer?.id) || !!moment?.joined.some((p) => p.id === viewer?.id);
  // Friends who logged this same concert or game themselves: "also there", not on this post.
  const together_ = [event.user_id, ...(moment?.memories.map((m) => m.person.id) ?? []), ...(moment?.joined.map((p) => p.id) ?? [])];
  const also = await alsoThere(supabase, viewer?.id ?? null, event as unknown as TogetherEvent, together_);
  // Invited: the invitation card, and your own log of the same event if you have one.
  const [match, preview] =
    myPart?.status === "invited" && viewer
      ? await Promise.all([findOwnMatch(supabase, viewer.id, "event", event.id), invitePreview(supabase, "event", event.id)])
      : [null, null];
  // Your own memory of someone's event, when you'd already logged it yourself.
  const { data: linkRow } =
    viewer && viewer.id === event.user_id
      ? await supabase.from("post_collaborators").select("id, target_id").eq("kind", "event").eq("own_target_id", event.id).eq("user_id", viewer.id).maybeSingle()
      : { data: null };
  const earlier = linkRow && viewer ? await findOwnMatch(supabase, viewer.id, "event", linkRow.target_id as string, [event.id]) : null;
  const alreadyMine = myPart?.status === "accepted" && !myPart.own_target_id && viewer ? await findOwnMatch(supabase, viewer.id, "event", event.id) : null;
  const comments = (commentRows ?? []) as CommentWithAuthor[];

  const media = [...event.event_media].sort((a, b) => a.display_order - b.display_order);
  const images = media.filter((m) => m.media_type === "image");
  const cover = media.find((m) => m.id === event.cover_media_id) ?? images[0];
  const gallery = media.filter((m) => m.id !== cover?.id);
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
            style={{ objectPosition: cover ? focalPosition(cover) : "50% 50%" }}
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
            {together && (
              <span className="inline-flex items-center gap-1.5">
                <Users size={14} aria-hidden /> with {together}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/u/${profile.username}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft size={15} /> {profile.display_name}&rsquo;s archive
          </Link>
          {canEdit ? (
            <Link href={`/events/${event.id}/edit`} className="inline-flex items-center gap-1.5 text-sm text-accent underline-offset-4 hover:underline">
              <Pencil size={14} /> Edit
            </Link>
          ) : isOwnProfile ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted">
              <Users size={14} aria-hidden /> Shared with you
            </span>
          ) : (
            viewer && (
              <IWasThereButton
                prefill={{
                  title: event.title,
                  event_type: event.event_type,
                  event_date: event.event_date,
                  venue: event.venue,
                  city: event.city,
                  country_code: event.country_code,
                  country_name: event.country_name,
                  spotify_artist_id: event.spotify_artist_id,
                  spotify_artist_name: event.spotify_artist_name,
                  spotify_artist_image: event.spotify_artist_image,
                  from: profile.display_name.split(" ")[0],
                }}
              />
            )
          )}
        </div>

        {moment && <MomentPeople moment={moment} noun="event" />}
        {linkRow && earlier && <UseExistingButton collabId={linkRow.id as string} match={earlier} kind="event" />}
        {myPart?.status === "invited" ? (
          <section className="mt-6">
            <MomentInviteCard cover={preview?.cover ?? null} inviter={ownerFull} title={preview?.title ?? event.title} when={preview?.when ?? ""} place={preview?.place} photos={preview?.photos} flag={preview?.flag}>
              <p className="text-sm font-medium">Unlock this memory: did you go together?</p>
              <CollabInviteActions collabId={myPart.id} kind="event" ownerName={ownerFull} match={match} openHref={`/u/${profile.username}/events/${event.id}`} />
            </MomentInviteCard>
          </section>
        ) : myPart?.status === "accepted" && !myPart.own_target_id ? (
          alreadyMine ? (
            <UseExistingButton collabId={myPart.id} match={alreadyMine} kind="event" />
          ) : (
            <MakeItMineButton collabId={myPart.id} kind="event" ownerName={ownerFull} />
          )
        ) : (
          viewer &&
          viewer.id !== event.user_id &&
          !onIt && (
            <div className="mt-4">
              <RequestCollabButton kind="event" targetId={event.id} ownerName={ownerFull} />
            </div>
          )
        )}

        {/* Also there: friends at the same event on their own (each their own post). */}
        {also.length > 0 && (
          <section id="also-there" className="mt-8 scroll-mt-24" aria-labelledby="also-h">
            <h2 id="also-h" className="font-serif text-2xl">
              {also.length === 1 ? "1 friend was there too" : `${also.length} friends were there too`}
            </h2>
            <p className="mt-0.5 text-sm text-muted">They logged it themselves. Tap one to see their {typeMeta.label.toLowerCase()}.</p>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {also.map((a) => (
                <li key={a.eventId}>
                  <Link href={`/u/${a.person.username}/events/${a.eventId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised">
                    <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-raised">
                      {a.person.avatar_url ? (
                        <Image src={a.person.avatar_url} alt="" fill sizes="36px" className="object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center font-serif text-accent">{a.person.display_name.slice(0, 1)}</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{a.person.display_name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

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

        {gallery.length > 0 && (
          <section className="mt-10" aria-label="Photos and videos">
            {/* Photos and videos together, in the order they were added, as
                even tiles — a full-width video in a column of small photos
                read as a mismatch. */}
            <PhotoGallery
              photos={gallery.map((m) => ({ id: m.id, url: m.public_url, alt: m.caption || event.title, caption: m.caption, type: m.media_type }))}
              gridClassName={`grid gap-1.5 ${gallery.length === 1 ? "grid-cols-1" : gallery.length === 2 || gallery.length === 4 ? "grid-cols-2" : "grid-cols-3"}`}
              itemClassName={`relative w-full overflow-hidden rounded-lg bg-raised ${gallery.length === 1 ? "aspect-[4/3]" : "aspect-square"}`}
              sizes={gallery.length === 1 ? "(min-width: 768px) 720px, 100vw" : "(min-width: 768px) 240px, 33vw"}
            />
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

        {event.event_type === "concert" && (
          <Suspense fallback={null}>
            <ArtistUpcomingShows artist={event.spotify_artist_name || event.title} />
          </Suspense>
        )}

        <section className="mt-12 border-t border-line pt-8" aria-labelledby="comments-h">
          <h2 id="comments-h" className="text-xl">Comments</h2>
          <div className="mt-4">
            <CommentSection kind="event" targetId={event.id} posterId={event.user_id} initialComments={comments} />
          </div>
        </section>

        <div className="mt-8 flex items-center justify-center gap-6 border-t border-line pt-6">
          {isOwnProfile && <ShareButton kind="event" targetId={event.id} title={event.title} />}
          <ReportButton targetType="event" targetId={event.id} targetUrl={`/u/${profile.username}/events/${event.id}`} />
          {viewer && !isOwnProfile && <BlockButton targetId={profile.id} targetName={profile.display_name} targetUsername={profile.username} />}
        </div>
      </div>
    </div>
  );
}

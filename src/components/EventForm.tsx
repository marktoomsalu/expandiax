"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Music2, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { COUNTRIES, countryByCode } from "@/lib/countries";
import { EVENT_TYPES, eventTypeMeta, type RecentArtist } from "@/lib/events";
import { RatingInput } from "./Rating";
import { ArtistPicker, type SpotifyArtist } from "./ArtistPicker";
import { TrackPicker, type SpotifyTrackChoice } from "./TrackPicker";
import { cn } from "@/lib/utils";
import type { Event, EventType } from "@/lib/types";

export function EventForm({ event, recentArtists = [] }: { event?: Event; recentArtists?: RecentArtist[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [f, setF] = useState({
    event_type: event?.event_type ?? ("concert" as EventType),
    title: event?.title ?? "",
    subtitle: event?.subtitle ?? "",
    event_date: event?.event_date ?? "",
    venue: event?.venue ?? "",
    city: event?.city ?? "",
    country_code: event?.country_code ?? "",
    rating: event?.rating ?? null,
    review: event?.review ?? "",
    highlight: event?.highlight ?? "",
    notes: event?.notes ?? "",
    is_public: event?.is_public ?? true,
    is_favourite: event?.is_favourite ?? false,
    share_to_feed: event?.share_to_feed ?? true,
    spotify_artist_id: event?.spotify_artist_id ?? null,
    spotify_artist_name: event?.spotify_artist_name ?? null,
    spotify_artist_image: event?.spotify_artist_image ?? null,
    spotify_favourite_track_id: event?.spotify_favourite_track_id ?? null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) =>
    setF((cur) => ({ ...cur, [key]: value }));

  const applyArtist = (artist: SpotifyArtist | null) =>
    setF((cur) => ({
      ...cur,
      spotify_artist_id: artist?.id ?? null,
      spotify_artist_name: artist?.name ?? null,
      spotify_artist_image: artist?.image ?? null,
      title: artist ? artist.name : cur.title,
    }));

  const meta = eventTypeMeta(f.event_type);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!f.title.trim() || !f.event_date || !f.country_code) {
      setError(`${meta.titleLabel}, date and country are required.`);
      return;
    }
    setBusy(true);
    const countryMeta = countryByCode(f.country_code)!;
    const payload = {
      event_type: f.event_type,
      title: f.title.trim(),
      subtitle: f.subtitle.trim(),
      event_date: f.event_date,
      venue: f.venue.trim(),
      city: f.city.trim(),
      country_code: countryMeta.code,
      country_name: countryMeta.name,
      rating: f.rating,
      review: f.review.trim(),
      highlight: f.highlight.trim(),
      notes: f.notes.trim(),
      is_public: f.is_public,
      is_favourite: f.is_favourite,
      share_to_feed: f.share_to_feed,
      spotify_artist_id: f.spotify_artist_id,
      spotify_artist_name: f.spotify_artist_name,
      spotify_artist_image: f.spotify_artist_image,
      spotify_favourite_track_id: f.spotify_favourite_track_id,
    };

    if (event) {
      const { error: err } = await supabase.from("events").update(payload).eq("id", event.id);
      if (err) {
        setError("Could not save the event. Try again.");
        setBusy(false);
        return;
      }
      setSaved(true);
      setBusy(false);
      router.refresh();
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Your session expired. Please sign in again.");
        setBusy(false);
        return;
      }
      const { data, error: err } = await supabase
        .from("events")
        .insert({ ...payload, user_id: user.id })
        .select("id")
        .single();
      if (err || !data) {
        setError("Could not create the event. Try again.");
        setBusy(false);
        return;
      }
      router.push(`/events/${data.id}/edit?created=1`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <span className="mb-1.5 block text-sm font-medium">Type of event</span>
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map((t) => {
            const Icon = t.icon;
            const active = f.event_type === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => set("event_type", t.value)}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  active ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:border-accent hover:text-accent"
                )}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {meta.hasArtist && (
        <div>
          <span className="mb-1.5 block text-sm font-medium">Spotify artist</span>
          <p className="mb-1.5 text-xs text-muted">
            Found them? Their photo becomes the cover and fills in {meta.titleLabel.toLowerCase()} below — no
            need to type it twice. Not on Spotify? Just skip this and type it in yourself.
          </p>

          {!f.spotify_artist_id && recentArtists.length > 0 && (
            <div className="mb-2">
              <p className="mb-1.5 text-xs text-muted">Seen before</p>
              <div className="flex flex-wrap gap-1.5">
                {recentArtists.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => applyArtist(a)}
                    className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
                  >
                    {a.image ? (
                      <Image src={a.image} alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-full object-cover" />
                    ) : (
                      <User size={12} />
                    )}
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <ArtistPicker
            value={
              f.spotify_artist_id
                ? { id: f.spotify_artist_id, name: f.spotify_artist_name ?? "", image: f.spotify_artist_image }
                : null
            }
            onChange={applyArtist}
          />
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="e-title" className="mb-1.5 block text-sm font-medium">{meta.titleLabel} *</label>
          <input id="e-title" className="field" value={f.title} onChange={(e) => set("title", e.target.value)} required placeholder={meta.titlePlaceholder} />
        </div>
        <div>
          <label htmlFor="e-subtitle" className="mb-1.5 block text-sm font-medium">Subtitle</label>
          <input id="e-subtitle" className="field" value={f.subtitle} onChange={(e) => set("subtitle", e.target.value)} placeholder="Tour, edition or extra detail" />
        </div>
        <div>
          <label htmlFor="e-date" className="mb-1.5 block text-sm font-medium">Date *</label>
          <input id="e-date" type="date" className="field" value={f.event_date} onChange={(e) => set("event_date", e.target.value)} required />
        </div>
        <div>
          <label htmlFor="e-venue" className="mb-1.5 block text-sm font-medium">Venue</label>
          <input id="e-venue" className="field" value={f.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Saku Suurhall" />
        </div>
        <div>
          <label htmlFor="e-city" className="mb-1.5 block text-sm font-medium">City</label>
          <input id="e-city" className="field" value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Tallinn" />
        </div>
        <div>
          <label htmlFor="e-country" className="mb-1.5 block text-sm font-medium">Country *</label>
          <select id="e-country" className="field" value={f.country_code} onChange={(e) => set("country_code", e.target.value)} required>
            <option value="">Choose a country</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium">Your rating</span>
        <RatingInput value={f.rating} onChange={(v) => set("rating", v)} />
      </div>

      <div>
        <label htmlFor="e-review" className="mb-1.5 block text-sm font-medium">The memory</label>
        <textarea id="e-review" className="field min-h-28" value={f.review} onChange={(e) => set("review", e.target.value)} maxLength={2000} placeholder="What made it worth remembering…" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="e-highlight" className="mb-1.5 block text-sm font-medium">{meta.highlightLabel}</label>
          <input
            id="e-highlight"
            className="field"
            value={f.highlight}
            onChange={(e) => set("highlight", e.target.value)}
          />
          {meta.songPicker && (
            <div className="mt-2">
              {f.spotify_favourite_track_id ? (
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <Music2 size={12} className="text-accent" aria-hidden /> Connected to Spotify — plays back on the event page.
                  <button type="button" className="text-red-700 hover:underline" onClick={() => set("spotify_favourite_track_id", null)}>
                    Disconnect
                  </button>
                </p>
              ) : (
                <TrackPicker
                  value={null}
                  onChange={(track: SpotifyTrackChoice | null) => {
                    if (!track) return;
                    setF((cur) => ({ ...cur, spotify_favourite_track_id: track.id, highlight: track.name }));
                  }}
                  placeholder="Or connect it to Spotify so it plays back…"
                />
              )}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="e-notes" className="mb-1.5 block text-sm font-medium">{meta.notesLabel}</label>
          <input id="e-notes" className="field" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-line bg-surface px-4 py-3">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={f.is_public} onChange={(e) => set("is_public", e.target.checked)} />
          Visible on my public profile
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={f.is_favourite} onChange={(e) => set("is_favourite", e.target.checked)} />
          My favourite event
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={f.share_to_feed} onChange={(e) => set("share_to_feed", e.target.checked)} />
          Show in followers&rsquo; feeds
        </label>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-800/20 bg-red-800/5 px-3 py-2 text-sm text-red-800 dark:text-red-400">{error}</p>}
      {saved && <p role="status" className="rounded-lg border border-accent/40 bg-accent-soft/50 px-3 py-2 text-sm">Event saved.</p>}

      <button type="submit" className="btn-accent" disabled={busy}>
        {busy ? "Saving…" : event ? "Save changes" : "Add event"}
      </button>
    </form>
  );
}

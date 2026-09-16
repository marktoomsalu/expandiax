"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CountrySearch } from "./CountrySearch";
import { countryByCode } from "@/lib/countries";
import { uploadSingleMedia } from "@/lib/media";
import { EVENT_TYPES, eventTypeMeta, type RecentArtist } from "@/lib/events";
import { ArtistPicker, type SpotifyArtist } from "./ArtistPicker";
import { EventSuggestions } from "./EventSuggestions";
import { cn } from "@/lib/utils";
import { tapSuccess } from "@/lib/haptics";
import type { EventType } from "@/lib/types";

const TODAY = new Date().toISOString().slice(0, 10);

// The minimal, onboarding-style first contact for a new event — photo,
// title, country, date, an optional artist tag and AI suggestions. Venue
// and city aren't shown here (kept off-screen to stay this short), but a
// "Suggest details" accept still writes them straight into the created
// row — they just show up already filled when the user reaches the full
// EventForm on /events/[id]/edit, which remains the place for everything
// else (subtitle, rating, review, notes, visibility).
export function QuickAddEventForm({ recentArtists = [] }: { recentArtists?: RecentArtist[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [eventType, setEventType] = useState<EventType>("concert");
  const [title, setTitle] = useState("");
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [eventDate, setEventDate] = useState(TODAY);
  const [artist, setArtist] = useState<SpotifyArtist | null>(null);
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const meta = eventTypeMeta(eventType);
  const country = countryCode ? countryByCode(countryCode) : null;
  const canContinue = title.trim().length > 0 && !!countryCode && !!eventDate;

  function applyArtist(a: SpotifyArtist | null) {
    setArtist(a);
    if (a) setTitle(a.name);
  }

  async function handlePhoto(file: File) {
    setPhoto(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    // Best-effort date prefill — a photo with no EXIF just leaves the date field as-is.
    try {
      const exifr = await import("exifr");
      const tags = await exifr.parse(file);
      const date = tags?.DateTimeOriginal;
      if (date instanceof Date && !Number.isNaN(date.getTime())) {
        setEventDate(date.toISOString().slice(0, 10));
      }
    } catch {
      // Not a real image, corrupt EXIF, etc. — manual date field still works.
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canContinue) {
      setError(`${meta.titleLabel}, date and country are required.`);
      return;
    }
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Your session expired. Please sign in again.");
      setBusy(false);
      return;
    }
    const countryMeta = countryByCode(countryCode!)!;
    const { data, error: err } = await supabase
      .from("events")
      .insert({
        user_id: user.id,
        event_type: eventType,
        title: title.trim(),
        event_date: eventDate,
        venue: venue.trim(),
        city: city.trim(),
        country_code: countryMeta.code,
        country_name: countryMeta.name,
        spotify_artist_id: artist?.id ?? null,
        spotify_artist_name: artist?.name ?? null,
        spotify_artist_image: artist?.image ?? null,
      })
      .select("id")
      .single();
    if (err || !data) {
      setError(err?.message.includes("capped at") ? err.message : "Could not create the event. Try again.");
      setBusy(false);
      return;
    }
    if (photo) {
      await uploadSingleMedia(supabase, {
        userId: user.id,
        scope: "events",
        parentId: data.id,
        file: photo,
        table: "event_media",
        extraFields: { event_id: data.id },
      }).catch(() => {
        // Best-effort — the event itself is already saved either way.
      });
    }
    tapSuccess();
    router.push(`/events/${data.id}/edit?created=1`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <span className="mb-1.5 block text-sm font-medium">Type of event</span>
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map((t) => {
            const Icon = t.icon;
            const active = eventType === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setEventType(t.value)}
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
            Found them? Their photo becomes the cover and fills in {meta.titleLabel.toLowerCase()} below - not on
            Spotify? Skip this and type it in, or add your own photo below.
          </p>
          {!artist && recentArtists.length > 0 && (
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
          <ArtistPicker value={artist} onChange={applyArtist} />
        </div>
      )}

      <div>
        <span className="mb-1.5 block text-sm font-medium">Photo</span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-card border border-dashed border-line bg-surface"
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm text-muted">Add a photo (optional)</span>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handlePhoto(file);
          }}
        />
      </div>

      <div>
        <label htmlFor="qe-title" className="mb-1.5 block text-sm font-medium">{meta.titleLabel} *</label>
        <input id="qe-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder={meta.titlePlaceholder} />
      </div>

      <div>
        <p className="mb-1.5 block text-sm font-medium">Country *</p>
        {country ? (
          <button type="button" onClick={() => setCountryCode(null)} className="field flex w-full items-center justify-between text-left">
            <span>{country.flag} {country.name}</span>
            <span className="text-xs text-accent">Change</span>
          </button>
        ) : (
          <CountrySearch onSelect={setCountryCode} placeholder="Search for the country…" />
        )}
      </div>

      <div>
        <label htmlFor="qe-date" className="mb-1.5 block text-sm font-medium">Date *</label>
        <input id="qe-date" type="date" className="field" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
      </div>

      <EventSuggestions
        title={title}
        onApplyVenue={setVenue}
        onApplyCity={setCity}
        onApplyCountry={(code) => setCountryCode(code)}
      />

      {error && (
        <p role="alert" className="rounded-lg border border-red-800/20 bg-red-800/5 px-3 py-2 text-sm text-red-800 dark:text-red-400">
          {error}
          {error.includes("capped at") && (
            <>
              {" "}
              <Link href="/settings/billing" className="text-accent underline-offset-4 hover:underline">
                Upgrade to Premium
              </Link>
              .
            </>
          )}
        </p>
      )}

      <button type="submit" className="btn-accent w-full" disabled={busy || !canContinue}>
        {busy ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}

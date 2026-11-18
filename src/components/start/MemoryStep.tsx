"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ImagePlus, Loader2, MapPin, Music2, Sparkles } from "lucide-react";
import { CountrySearch } from "@/components/CountrySearch";
import { countryByCode } from "@/lib/countries";
import type { OnboardingMemory } from "@/lib/onboardingDraft";
import { localDay, photoDay, photoSpot } from "@/lib/photoDates";
import { convertHeic } from "@/lib/heic";
import { hasNativePhotoPicker, pickNativePhotos } from "@/lib/nativePhotoPicker";
import { DateField } from "@/components/DateField";
import { tapLight, tapSuccess } from "@/lib/haptics";
import { cn, formatDate } from "@/lib/utils";

const TODAY = localDay(new Date());
const never = () => () => {};

type Kind = NonNullable<OnboardingMemory["eventType"]>;
const KINDS: { value: Kind; label: string; placeholder: string }[] = [
  { value: "concert", label: "Concert", placeholder: "Coldplay" },
  { value: "festival", label: "Festival", placeholder: "Glastonbury 2025" },
  { value: "sport", label: "Sport", placeholder: "Estonia vs Latvia" },
  { value: "personal", label: "Special occasion", placeholder: "Karla’s wedding" },
  { value: "other", label: "Other", placeholder: "Northern lights tour" },
];

type Show = { artist: string; venue: string | null; city: string | null; countryCode: string | null };

/**
 * One event to start with. A photo from it does most of the work: its day,
 * where it was taken (the country and city) and, for a night out, the
 * concerts that played there that night ("Were you at…?"). The rest is a
 * name, and everything can be changed.
 */
export function MemoryStep({
  initial,
  initialPhoto = null,
  onDone,
}: {
  initial?: OnboardingMemory | null;
  initialPhoto?: File | null;
  onDone: (memory: OnboardingMemory, photo: File | null) => void;
}) {
  const [kind, setKind] = useState<Kind>(initial?.eventType ?? "concert");
  const [countryCode, setCountryCode] = useState<string | null>(initial?.countryCode ?? null);
  const [city, setCity] = useState(initial?.city ?? "");
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const [artist, setArtist] = useState(initial?.artist ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [eventDate, setEventDate] = useState(initial?.eventDate ?? TODAY);
  const [photo, setPhoto] = useState<File | null>(initialPhoto);
  const [previewUrl, setPreviewUrl] = useState<string | null>(() => (initialPhoto ? URL.createObjectURL(initialPhoto) : null));
  const [reading, setReading] = useState(false);
  const [found, setFound] = useState<{ day: string | null; place: string | null } | null>(null);
  const [shows, setShows] = useState<Show[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  // In the app: its own picker, which keeps where a photo was taken (the browser's drops it on iPhone).
  const nativePicker = useSyncExternalStore(never, hasNativePhotoPicker, () => false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handlePhoto(picked: File) {
    setReading(true);
    setShows([]);
    // Read from the original first: converting an iPhone photo can lose its details.
    const [day, spot] = await Promise.all([photoDay(picked).catch(() => null), photoSpot(picked).catch(() => null)]);
    const {
      files: [file],
    } = await convertHeic([picked]);
    if (file) {
      setPhoto(file);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
    }
    if (day) setEventDate(day);
    let place: string | null = null;
    if (spot) {
      try {
        const res = await fetch(`/api/onboarding/photo-event?lat=${spot.lat}&lng=${spot.lng}&date=${day ?? eventDate}`);
        const data = (await res.json()) as { countryCode: string | null; city: string | null; events: Show[] };
        if (data.countryCode) setCountryCode(data.countryCode);
        if (data.city) setCity(data.city);
        place = [data.city, countryByCode(data.countryCode)?.name].filter(Boolean).join(", ") || null;
        setShows(data.events ?? []);
      } catch {
        // No place found: picked by hand below.
      }
    }
    setFound(day || place ? { day, place } : null);
    if (day || place) tapSuccess();
    setReading(false);
  }

  async function pickPhoto() {
    if (!nativePicker) return inputRef.current?.click();
    try {
      const { files } = await pickNativePhotos(1, () => setReading(true), () => {});
      if (files[0]) await handlePhoto(files[0]);
      else setReading(false);
    } catch {
      setReading(false);
    }
  }

  function wasAt(show: Show) {
    tapLight();
    setKind("concert");
    setTitle(show.artist);
    setArtist(show.artist);
    setVenue(show.venue ?? "");
    if (show.city) setCity(show.city);
    if (show.countryCode && countryByCode(show.countryCode)) setCountryCode(show.countryCode);
  }

  const country = countryCode ? countryByCode(countryCode) : null;
  const canContinue = title.trim().length > 0 && !!countryCode && !!eventDate;
  const placeholder = KINDS.find((k) => k.value === kind)?.placeholder ?? "";

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 pb-16 pt-[calc(4rem+env(safe-area-inset-top))]">
      <p className="eyebrow text-center">Step 2</p>
      <h1 className="mt-2 text-center text-3xl md:text-4xl">One event you&rsquo;d want to remember forever.</h1>
      <p className="mt-2 text-center text-sm text-muted">Add a photo from it and we&rsquo;ll fill in when and where.</p>

      <div className="mt-7">
        <button
          type="button"
          onClick={() => void pickPhoto()}
          className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-card border border-dashed border-accent/50 bg-accent-soft/40"
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-2 text-sm font-medium text-accent">
              <ImagePlus size={26} aria-hidden /> Add a photo from it
            </span>
          )}
          {reading && (
            <span className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 text-sm font-medium text-white">
              <Loader2 size={16} className="animate-spin" aria-hidden /> Reading your photo…
            </span>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handlePhoto(file);
          }}
        />
        {found && !reading && (
          <p role="status" className="mt-2 flex items-center gap-1.5 text-xs text-accent">
            <Sparkles size={13} aria-hidden /> From your photo: {[found.day ? formatDate(found.day) : null, found.place].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      {/* The concerts that played there that night. */}
      {shows.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-medium">Were you at one of these?</p>
          <ul className="mt-2 space-y-1.5">
            {shows.map((s) => {
              const on = artist === s.artist;
              return (
                <li key={s.artist}>
                  <button
                    type="button"
                    onClick={() => wasAt(s)}
                    aria-pressed={on}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                      on ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-accent"
                    )}
                  >
                    <Music2 size={16} className="shrink-0 text-accent" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.artist}</span>
                      {s.venue && <span className="block truncate text-xs text-muted">{s.venue}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-5 space-y-4">
        <div>
          <p className="mb-1.5 block text-sm font-medium">What kind of event?</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="What kind of event">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                aria-pressed={kind === k.value}
                onClick={() => {
                  tapLight();
                  setKind(k.value);
                }}
                className={cn(
                  "rounded-full border px-3.5 py-2 text-sm transition-colors",
                  kind === k.value ? "border-accent bg-accent text-white" : "border-line bg-surface hover:border-accent"
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="memory-title" className="mb-1.5 block text-sm font-medium">What was it?</label>
          <input
            id="memory-title"
            className="field"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (artist && e.target.value !== artist) setArtist("");
            }}
            placeholder={placeholder}
          />
        </div>

        <div>
          <p className="mb-1.5 block text-sm font-medium">Where</p>
          {country ? (
            <button type="button" onClick={() => setCountryCode(null)} className="field flex w-full items-center justify-between text-left">
              <span>
                {country.flag} {country.name}
              </span>
              <span className="text-xs text-accent">Change</span>
            </button>
          ) : (
            <CountrySearch onSelect={setCountryCode} placeholder="Search for the country…" />
          )}
          <label htmlFor="memory-city" className="sr-only">City</label>
          <div className="relative mt-2">
            <MapPin size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input id="memory-city" className="field !pl-10" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City (optional)" />
          </div>
        </div>

        <div>
          <label htmlFor="memory-date" className="mb-1.5 block text-sm font-medium">When</label>
          <DateField id="memory-date" label="When" value={eventDate} max={TODAY} onChange={setEventDate} />
        </div>
      </div>

      <button
        type="button"
        disabled={!canContinue}
        onClick={() =>
          onDone(
            { title: title.trim(), eventDate, countryCode: countryCode!, eventType: kind, city: city.trim() || null, venue: venue.trim() || null, artist: artist || null },
            photo
          )
        }
        className="btn-accent mt-8 w-full"
      >
        Continue
      </button>
    </div>
  );
}

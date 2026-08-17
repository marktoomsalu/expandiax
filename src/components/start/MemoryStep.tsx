"use client";

import { useEffect, useRef, useState } from "react";
import { CountrySearch } from "@/components/CountrySearch";
import { countryByCode } from "@/lib/countries";
import type { OnboardingMemory } from "@/lib/onboardingDraft";

const TODAY = new Date().toISOString().slice(0, 10);

export function MemoryStep({ onDone }: { onDone: (memory: OnboardingMemory, photo: File | null) => void }) {
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(TODAY);
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handlePhoto(file: File) {
    setPhoto(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    // Best-effort date prefill — a photo with no EXIF (screenshot, edited,
    // stripped metadata) just keeps whatever date is already in the field.
    try {
      const exifr = await import("exifr");
      const tags = await exifr.parse(file);
      const date = tags?.DateTimeOriginal;
      if (date instanceof Date && !Number.isNaN(date.getTime())) {
        setEventDate(date.toISOString().slice(0, 10));
      }
    } catch {
      // Not a real image, corrupt EXIF, etc. — the manual date field still works.
    }
  }

  const country = countryCode ? countryByCode(countryCode) : null;
  const canContinue = title.trim().length > 0 && !!countryCode && !!eventDate;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 py-16">
      <p className="eyebrow text-center">Step 2</p>
      <h1 className="mt-2 text-center text-3xl md:text-4xl">One night you&rsquo;d want to keep forever.</h1>
      <p className="mt-2 text-center text-sm text-muted">
        A concert, a match, a wedding, a festival — the one that still plays in your head.
      </p>

      <div className="mt-8">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-card border border-dashed border-line bg-surface"
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm text-muted">Add a photo</span>
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

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="memory-title" className="mb-1.5 block text-sm font-medium">What was it?</label>
          <input
            id="memory-title"
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tame Impala at Alexandra Palace"
          />
        </div>

        <div>
          <p className="mb-1.5 block text-sm font-medium">Where</p>
          {country ? (
            <button
              type="button"
              onClick={() => setCountryCode(null)}
              className="field flex w-full items-center justify-between text-left"
            >
              <span>{country.flag} {country.name}</span>
              <span className="text-xs text-accent">Change</span>
            </button>
          ) : (
            <CountrySearch onSelect={setCountryCode} placeholder="Search for the country…" />
          )}
        </div>

        <div>
          <label htmlFor="memory-date" className="mb-1.5 block text-sm font-medium">When</label>
          <input
            id="memory-date"
            type="date"
            className="field"
            value={eventDate}
            max={TODAY}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </div>
      </div>

      <button
        type="button"
        disabled={!canContinue}
        onClick={() => onDone({ title: title.trim(), eventDate, countryCode: countryCode! }, photo)}
        className="btn-accent mt-8 w-full"
      >
        Continue
      </button>
    </div>
  );
}

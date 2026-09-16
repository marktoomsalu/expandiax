"use client";

import { useState } from "react";
import { Check, MapPin } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import { cn } from "@/lib/utils";

type Suggestion = { venue: string | null; city: string | null; countryCode: string | null };
type ChipKey = "venue" | "city" | "country";
type ChipStatus = "pending" | "applied" | "dismissed";

// Free lookup (OpenStreetMap/Nominatim, no API key) — resolves the typed
// title to a real named place when one matches. Nothing is written into the
// form until the user explicitly accepts that one field; venue/city/country
// are each independent.
export function EventSuggestions({
  title,
  onApplyVenue,
  onApplyCity,
  onApplyCountry,
}: {
  title: string;
  onApplyVenue: (venue: string) => void;
  onApplyCity: (city: string) => void;
  onApplyCountry: (code: string, name: string) => void;
}) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [status, setStatus] = useState<Record<string, ChipStatus>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup() {
    setBusy(true);
    setError(null);
    setSuggestion(null);
    setStatus({});
    try {
      const res = await fetch(`/api/events/suggest?title=${encodeURIComponent(title)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not look that up.");
      setSuggestion(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not look that up.");
    } finally {
      setBusy(false);
    }
  }

  if (!suggestion && !busy && !error) {
    return (
      <button
        type="button"
        onClick={lookup}
        disabled={!title.trim()}
        className="flex items-center gap-1.5 text-sm text-accent hover:underline disabled:opacity-50 disabled:no-underline"
      >
        <MapPin size={14} /> Look up place
      </button>
    );
  }

  const country = suggestion?.countryCode ? countryByCode(suggestion.countryCode) : null;
  const chips: { key: ChipKey; label: string; onAccept: () => void }[] = [];
  if (suggestion?.venue) chips.push({ key: "venue", label: `Venue: ${suggestion.venue}`, onAccept: () => onApplyVenue(suggestion.venue!) });
  if (suggestion?.city) chips.push({ key: "city", label: `City: ${suggestion.city}`, onAccept: () => onApplyCity(suggestion.city!) });
  if (country) chips.push({ key: "country", label: `Country: ${country.flag} ${country.name}`, onAccept: () => onApplyCountry(country.code, country.name) });

  return (
    <div>
      <p className="flex items-center gap-1.5 text-sm text-muted">
        <MapPin size={14} className="text-accent" aria-hidden />
        {busy ? "Looking up…" : "Match found"}
      </p>
      {error && <p role="alert" className="mt-1.5 text-xs text-red-800 dark:text-red-400">{error}</p>}
      {chips.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {chips.map((c) => {
            const s = status[c.key] ?? "pending";
            if (s === "dismissed") return null;
            return (
              <li
                key={c.key}
                className={cn("flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-1.5 text-sm", s === "applied" && "text-muted")}
              >
                <span>{c.label}</span>
                {s === "applied" ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-accent">
                    <Check size={13} /> Added
                  </span>
                ) : (
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="text-xs text-accent hover:underline"
                      onClick={() => {
                        c.onAccept();
                        setStatus((s) => ({ ...s, [c.key]: "applied" }));
                      }}
                    >
                      Use this
                    </button>
                    <button
                      type="button"
                      className="text-xs text-muted hover:text-ink"
                      onClick={() => setStatus((s) => ({ ...s, [c.key]: "dismissed" }))}
                    >
                      Skip
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {suggestion && chips.length === 0 && !busy && (
        <p className="mt-1.5 text-xs text-muted">No matching place found for that title.</p>
      )}
    </div>
  );
}

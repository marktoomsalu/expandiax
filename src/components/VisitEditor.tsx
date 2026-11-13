"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check, Lock, MapPin, MessageSquareText, Music2, PenLine } from "lucide-react";
import { AudiencePicker } from "./AudiencePicker";
import { audienceOf, type Audience } from "@/lib/audience";
import { createClient } from "@/lib/supabase/client";
import { VisitDateFields } from "./VisitDateFields";
import { SoundtrackPicker } from "./SoundtrackPicker";
import type { CountryCity, CountryVisit, DatePrecision, TripKind } from "@/lib/types";
import { suggestTripName } from "@/lib/tripPlaces";
import { SuggestedNameNote } from "./PhotoPlaceSuggestion";
import { TripKindToggle } from "./TripKindToggle";
import { TripPlacesEditor } from "./TripPlacesEditor";
import { Basket } from "./Basket";
import { SuggestedDatesNote, useSuggestedDates, type DateRange } from "./PhotoDateSuggestion";
import { photoDateRange } from "@/lib/photoDates";

export type TripCountry = { id: string; code: string; name: string; is_public: boolean; share_to_feed: boolean };

function savedAgoLabel(savedAt: number, now: number): string {
  const secs = Math.max(0, Math.round((now - savedAt) / 1000));
  if (secs < 5) return "Saved just now";
  if (secs < 60) return `Saved ${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `Saved ${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `Saved ${hrs}h ago`;
}

/** Ticks every second while a save timestamp is set, so "Saved Xs ago" stays live. */
function useSavedAgo(savedAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (savedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [savedAt]);
  return savedAt === null ? null : savedAgoLabel(savedAt, now);
}

export function VisitEditor({ visit, cities, country }: { visit: CountryVisit; cities: CountryCity[]; country: TripCountry }) {
  const router = useRouter();
  const supabase = createClient();
  const [title, setTitle] = useState(visit.title ?? "");
  // With no name of its own, a trip is named after its places (and keeps
  // following them) until a name is typed.
  const [titleTouched, setTitleTouched] = useState(!!visit.title?.trim());
  const [kind, setKind] = useState<TripKind>(visit.kind ?? "trip");
  const [precision, setPrecision] = useState<DatePrecision>(visit.date_precision);
  const [year, setYear] = useState(String(visit.year));
  const [month, setMonth] = useState(visit.date_precision === "month" && visit.visited_from ? visit.visited_from.slice(5, 7) : "");
  const [visitedFrom, setVisitedFrom] = useState(visit.date_precision === "day" ? visit.visited_from ?? "" : "");
  const [visitedTo, setVisitedTo] = useState(visit.date_precision === "day" ? visit.visited_to ?? "" : "");
  const [datesSavedAt, setDatesSavedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const datesSavedAgo = useSavedAgo(datesSavedAt);

  const [memory, setMemory] = useState(visit.highlight);
  const lastSavedMemory = useRef(visit.highlight);
  const [memorySaving, setMemorySaving] = useState(false);
  const [memorySavedAt, setMemorySavedAt] = useState<number | null>(null);
  const memoryDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memorySavedAgo = useSavedAgo(memorySavedAt);

  useEffect(() => {
    return () => {
      if (memoryDebounce.current) clearTimeout(memoryDebounce.current);
    };
  }, []);


  // Photos just added on this page: offer their dates when they differ from the trip's.
  const [photoRange, setPhotoRange] = useState<DateRange | null>(null);
  useEffect(() => {
    const onPicked = (e: Event) => {
      photoDateRange((e as CustomEvent<File[]>).detail).then((r) => r && setPhotoRange({ from: r.from, to: r.to }));
    };
    window.addEventListener("expandiax:photos-picked", onPicked);
    return () => window.removeEventListener("expandiax:photos-picked", onPicked);
  }, []);
  // Fills them in by itself only when the trip has no exact dates yet — never
  // replaces dates the person set.
  const dates = useSuggestedDates(
    photoRange,
    { precision, year, visitedFrom, visitedTo, setPrecision, setYear, setVisitedFrom, setVisitedTo },
    visit.date_precision !== "day"
  );

  // Saves the dates; false (with a message) when they don't make sense.
  async function persistDates(): Promise<boolean> {
    const y = parseInt(precision === "day" && visitedFrom ? visitedFrom.slice(0, 4) : year, 10);
    if (Number.isNaN(y) || y < 1900 || y > 2100) {
      setError(precision === "day" ? "Choose the date you arrived." : "Enter a year between 1900 and 2100.");
      return false;
    }
    if (precision === "day" && visitedFrom && visitedTo && visitedTo < visitedFrom) {
      setError("The \"to\" date can't be before the \"from\" date.");
      return false;
    }
    if (precision === "month" && !month) {
      setError("Choose a month.");
      return false;
    }
    setError(null);
    setBusy(true);

    let from: string | null = null;
    let to: string | null = null;
    if (precision === "day" && visitedFrom) {
      from = visitedFrom;
      to = visitedTo || visitedFrom;
    } else if (precision === "month" && month) {
      const lastDay = new Date(y, Number(month), 0).getDate();
      from = `${year}-${month}-01`;
      to = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
    }

    const { error: err } = await supabase
      .from("country_visits")
      .update({ year: y, visited_from: from, visited_to: to, date_precision: precision })
      .eq("id", visit.id);
    setBusy(false);
    if (err) {
      setError("Could not save the dates. Try again.");
      return false;
    }
    setDatesSavedAt(Date.now());
    return true;
  }

  // Saved straight away, like a switch.
  const [audience, setAudience] = useState<Audience>(audienceOf(visit.audience ?? (visit.is_public === false ? "only_me" : "everyone")));
  async function setVisibility(next: Audience) {
    if (next === audience) return;
    const before = audience;
    setAudience(next);
    const { error: err } = await supabase.from("country_visits").update({ audience: next }).eq("id", visit.id);
    if (err) {
      setAudience(before);
      setError("Could not change who can see it. Try again.");
    } else router.refresh();
  }

  async function saveTrip() {
    if (memoryDebounce.current) clearTimeout(memoryDebounce.current);
    if (!(await persistDates())) return;
    await commitMemory(memory);
    const { error: err } = await supabase.from("country_visits").update({ title: titleTouched ? title.trim().slice(0, 80) : "", kind }).eq("id", visit.id);
    if (err) {
      setError("Could not save the name. Try again.");
      return;
    }
    router.push(`/my-world/${country.code.toLowerCase()}/visits/${visit.id}`);
    router.refresh();
  }

  async function commitMemory(value: string) {
    const trimmed = value.trim();
    if (trimmed === lastSavedMemory.current.trim()) return;
    setMemorySaving(true);
    const { error: err } = await supabase.from("country_visits").update({ highlight: trimmed }).eq("id", visit.id);
    setMemorySaving(false);
    if (!err) {
      lastSavedMemory.current = trimmed;
      setMemorySavedAt(Date.now());
      router.refresh();
    }
  }

  function onMemoryChange(value: string) {
    setMemory(value);
    if (memoryDebounce.current) clearTimeout(memoryDebounce.current);
    memoryDebounce.current = setTimeout(() => commitMemory(value), 1500);
  }

  function onMemoryBlur() {
    if (memoryDebounce.current) clearTimeout(memoryDebounce.current);
    commitMemory(memory);
  }



  return (
    <div className="space-y-3">
      <Basket icon={PenLine} title="Name & type" hint="Give it a name, and say whether it was a trip or somewhere you lived.">
        <label htmlFor="trip-title" className="sr-only">Name</label>
        <input
          id="trip-title"
          className="field"
          maxLength={80}
          placeholder={kind === "lived" ? `Lived in ${cities[0]?.city_name ?? country.name}` : `e.g. ${country.name} Road Trip`}
          value={titleTouched ? title : suggestTripName(kind, cities.map((c) => c.city_name), country.name)}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleTouched(true);
          }}
        />
        {!titleTouched && cities.length > 0 && <SuggestedNameNote />}
        <TripKindToggle value={kind} onChange={setKind} className="mt-2" />
      </Basket>

      <Basket icon={Lock} title="Who can see it" hint="Your country stays on your map either way.">
        <AudiencePicker value={audience} onChange={(next) => void setVisibility(next)} />
      </Basket>

      <Basket icon={Calendar} title="When" hint="Set the dates for your trip.">
        <VisitDateFields
          precision={precision}
          onPrecisionChange={dates.setPrecision}
          year={year}
          onYearChange={dates.setYear}
          month={month}
          onMonthChange={setMonth}
          visitedFrom={visitedFrom}
          onVisitedFromChange={dates.setVisitedFrom}
          visitedTo={visitedTo}
          onVisitedToChange={dates.setVisitedTo}
        />
        {dates.suggested && <SuggestedDatesNote hint="tap Save trip to keep them." />}
        {!busy && datesSavedAgo && <p role="status" className="mt-2 text-xs text-accent">{datesSavedAgo}</p>}
      </Basket>

      <Basket icon={MessageSquareText} title="Quick memory" hint="What made this trip special?">
        <label htmlFor="visit-memory" className="sr-only">Memory</label>
        <textarea
          id="visit-memory"
          className="field min-h-24"
          placeholder="Write a few words about your experience…"
          value={memory}
          maxLength={1000}
          onChange={(e) => onMemoryChange(e.target.value)}
          onBlur={onMemoryBlur}
        />
        <p className="mt-1.5 text-xs">
          {memorySaving ? (
            <span role="status" className="text-muted">Saving…</span>
          ) : memorySavedAgo ? (
            <span role="status" className="text-accent">{memorySavedAgo}</span>
          ) : (
            <span className="text-muted">Saved automatically as you type.</span>
          )}
        </p>
      </Basket>

      <Basket icon={Music2} title="Soundtrack" hint="The song this trip sounded like.">
        <SoundtrackPicker table="country_visits" recordId={visit.id} initialTrackId={visit.spotify_track_id} />
      </Basket>

      <Basket id="places" icon={MapPin} title="Cities & regions visited" hint="The cities, towns and regions you went to, in order - each with its own dates.">
        <TripPlacesEditor visitId={visit.id} visitedCountryId={visit.visited_country_id} countryCode={country.code} initial={cities} />
      </Basket>


      {error && <p role="alert" className="text-sm text-red-800 dark:text-red-400">{error}</p>}

      {/* Save stays at hand at the bottom while editing (the tab bar steps aside here). */}
      <div className="sticky bottom-0 z-30 -mx-5 bg-gradient-to-t from-canvas via-canvas/95 to-canvas/0 px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-4">
        <button type="button" onClick={saveTrip} disabled={busy || memorySaving} className="btn-accent w-full justify-center !py-3.5 text-base font-semibold shadow-lg shadow-accent/25">
          <Check size={18} /> {busy ? "Saving…" : "Save trip"}
        </button>
      </div>
    </div>
  );
}

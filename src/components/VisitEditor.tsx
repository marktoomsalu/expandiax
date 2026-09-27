"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check, MapPin, MessageSquareText, Music2, Plus, Share2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { VisitDateFields } from "./VisitDateFields";
import { SoundtrackPicker } from "./SoundtrackPicker";
import type { CountryCity, CountryVisit, DatePrecision } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Basket } from "./Basket";

type Sharing = "feed" | "profile" | "private";
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
  const [cityList, setCityList] = useState(cities);
  const [cityInput, setCityInput] = useState("");
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

  const [sharing, setSharing] = useState<Sharing>(!country.is_public ? "private" : country.share_to_feed ? "feed" : "profile");

  async function changeSharing(next: Sharing) {
    const before = sharing;
    setSharing(next);
    const update = next === "private" ? { is_public: false } : { is_public: true, share_to_feed: next === "feed" };
    const { error: err } = await supabase.from("visited_countries").update(update).eq("id", country.id);
    if (err) setSharing(before);
    else router.refresh();
  }

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

  async function saveTrip() {
    if (memoryDebounce.current) clearTimeout(memoryDebounce.current);
    if (!(await persistDates())) return;
    await commitMemory(memory);
    router.push(`/my-world/${country.code.toLowerCase()}`);
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

  async function addCity(e: React.FormEvent) {
    e.preventDefault();
    const name = cityInput.trim();
    if (!name) return;
    const { data: inserted, error: err } = await supabase
      .from("country_cities")
      .insert({ visited_country_id: visit.visited_country_id, country_visit_id: visit.id, city_name: name })
      .select("*")
      .single();
    if (!err && inserted) {
      setCityList((c) => [...c, inserted as CountryCity]);
      setCityInput("");
      router.refresh();
    }
  }

  async function removeCity(id: string) {
    setCityList((c) => c.filter((x) => x.id !== id));
    await supabase.from("country_cities").delete().eq("id", id);
    router.refresh();
  }

  const segment = (value: Sharing, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => changeSharing(value)}
      aria-pressed={sharing === value}
      className={cn(
        "flex-1 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-colors",
        sharing === value ? "bg-accent-soft text-accent ring-1 ring-accent" : "text-muted hover:text-ink"
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <Basket icon={Calendar} title="When" hint="Set the dates for your trip.">
        <VisitDateFields
          precision={precision}
          onPrecisionChange={setPrecision}
          year={year}
          onYearChange={setYear}
          month={month}
          onMonthChange={setMonth}
          visitedFrom={visitedFrom}
          onVisitedFromChange={setVisitedFrom}
          visitedTo={visitedTo}
          onVisitedToChange={setVisitedTo}
        />
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

      <Basket icon={MapPin} title="Places" hint="Add the places you visited.">
        <div className="flex flex-wrap items-center gap-2">
          {cityList.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-raised px-3 py-1.5 text-sm">
              {c.city_name}
              <button type="button" aria-label={`Remove ${c.city_name}`} className="text-muted hover:text-red-700" onClick={() => removeCity(c.id)}>
                <X size={14} />
              </button>
            </span>
          ))}
          <form onSubmit={addCity} className="flex min-w-[12rem] flex-1 items-center gap-2">
            <label htmlFor="visit-city-input" className="sr-only">Add a city</label>
            <input
              id="visit-city-input"
              type="text"
              placeholder="Add a city…"
              className="field min-w-0 flex-1 !py-2 text-sm"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
            />
            <button
              type="submit"
              aria-label="Add city"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line hover:border-accent hover:text-accent"
            >
              <Plus size={16} />
            </button>
          </form>
        </div>
      </Basket>

      <Basket icon={Share2} title="Sharing" hint={`Who can see ${country.name} - for all your trips there.`}>
        <div className="flex rounded-full border border-line p-1" role="group" aria-label="Who can see it">
          {segment("feed", "In feed")}
          {segment("profile", "Profile only")}
          {segment("private", "Only me")}
        </div>
      </Basket>

      {error && <p role="alert" className="text-sm text-red-800 dark:text-red-400">{error}</p>}

      <button type="button" onClick={saveTrip} disabled={busy || memorySaving} className="btn-accent w-full justify-center !py-3.5 text-base font-semibold">
        <Check size={18} /> {busy ? "Saving…" : "Save trip"}
      </button>
    </div>
  );
}

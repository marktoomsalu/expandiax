"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { VisitDateFields } from "./VisitDateFields";
import { SoundtrackPicker } from "./SoundtrackPicker";
import type { CountryCity, CountryVisit, DatePrecision } from "@/lib/types";

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

export function VisitEditor({ visit, cities }: { visit: CountryVisit; cities: CountryCity[] }) {
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

  async function saveDates(e: React.FormEvent) {
    e.preventDefault();
    const y = parseInt(year, 10);
    if (Number.isNaN(y) || y < 1900 || y > 2100) {
      setError("Enter a year between 1900 and 2100.");
      return;
    }
    if (precision === "day" && visitedFrom && visitedTo && visitedTo < visitedFrom) {
      setError("The \"to\" date can't be before the \"from\" date.");
      return;
    }
    if (precision === "month" && !month) {
      setError("Choose a month.");
      return;
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
      return;
    }
    setDatesSavedAt(Date.now());
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

  return (
    <div className="space-y-8">
      <form onSubmit={saveDates} className="space-y-3">
        <span className="mb-1.5 block text-sm font-medium">When</span>
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
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-ghost !py-1.5 text-sm" disabled={busy}>
            {busy ? "Saving…" : "Save dates"}
          </button>
          {!busy && datesSavedAgo && <span role="status" className="text-xs text-accent">{datesSavedAgo}</span>}
        </div>
        {error && <p role="alert" className="text-sm text-red-800 dark:text-red-400">{error}</p>}
      </form>

      <div>
        <label htmlFor="visit-memory" className="mb-1.5 block text-sm font-medium">Memory</label>
        <textarea
          id="visit-memory"
          className="field min-h-28"
          placeholder="What made this trip its own thing?"
          value={memory}
          maxLength={1000}
          onChange={(e) => onMemoryChange(e.target.value)}
          onBlur={onMemoryBlur}
        />
        <div className="mt-1.5 text-xs">
          {memorySaving ? (
            <span role="status" className="text-muted">Saving…</span>
          ) : memorySavedAgo ? (
            <span role="status" className="text-accent">{memorySavedAgo}</span>
          ) : (
            <span className="text-muted">Saves automatically as you type.</span>
          )}
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium">Soundtrack</span>
        <p className="mb-1.5 text-xs text-muted">The song this trip sounded like.</p>
        <SoundtrackPicker table="country_visits" recordId={visit.id} initialTrackId={visit.spotify_track_id} />
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium">Cities</span>
        <div className="flex flex-wrap items-center gap-2">
          {cityList.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-sm">
              {c.city_name}
              <button type="button" aria-label={`Remove ${c.city_name}`} className="text-muted hover:text-red-700" onClick={() => removeCity(c.id)}>
                <X size={13} />
              </button>
            </span>
          ))}
          <form onSubmit={addCity} className="flex items-center gap-1.5">
            <label htmlFor="visit-city-input" className="sr-only">Add a city</label>
            <input
              id="visit-city-input"
              type="text"
              placeholder="Add a city"
              className="field !w-32 !py-1.5 text-sm"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
            />
            <button type="submit" className="btn-ghost !px-2.5 !py-1.5 text-sm" aria-label="Add city"><Plus size={15} /></button>
          </form>
        </div>
      </div>
    </div>
  );
}

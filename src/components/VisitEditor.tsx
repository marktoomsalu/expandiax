"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { VisitDateFields } from "./VisitDateFields";
import { SoundtrackPicker } from "./SoundtrackPicker";
import type { CountryVisit, DatePrecision } from "@/lib/types";

export function VisitEditor({ visit }: { visit: CountryVisit }) {
  const router = useRouter();
  const supabase = createClient();
  const [precision, setPrecision] = useState<DatePrecision>(visit.date_precision);
  const [year, setYear] = useState(String(visit.year));
  const [month, setMonth] = useState(visit.date_precision === "month" && visit.visited_from ? visit.visited_from.slice(5, 7) : "");
  const [visitedFrom, setVisitedFrom] = useState(visit.date_precision === "day" ? visit.visited_from ?? "" : "");
  const [visitedTo, setVisitedTo] = useState(visit.date_precision === "day" ? visit.visited_to ?? "" : "");
  const [memory, setMemory] = useState(visit.highlight);
  const [memorySaved, setMemorySaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    router.refresh();
  }

  async function saveMemoryIfChanged() {
    const trimmed = memory.trim();
    if (trimmed === visit.highlight.trim()) return;
    await supabase.from("country_visits").update({ highlight: trimmed }).eq("id", visit.id);
    setMemorySaved(true);
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
        <button type="submit" className="btn-ghost !py-1.5 text-sm" disabled={busy}>
          {busy ? "Saving…" : "Save dates"}
        </button>
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
          onChange={(e) => {
            setMemory(e.target.value);
            setMemorySaved(false);
          }}
          onBlur={saveMemoryIfChanged}
        />
        {memorySaved && <span role="status" className="mt-1.5 block text-xs text-accent">Saved.</span>}
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium">Soundtrack</span>
        <p className="mb-1.5 text-xs text-muted">The song this trip sounded like.</p>
        <SoundtrackPicker table="country_visits" recordId={visit.id} initialTrackId={visit.spotify_track_id} />
      </div>
    </div>
  );
}

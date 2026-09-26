"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown, ListMusic } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import { cn, formatDate } from "@/lib/utils";
import type { PastShow } from "@/lib/concerts";

type Result = { shows: PastShow[]; total?: number; page?: number; perPage?: number; configured?: boolean; error?: string };

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 40 }, (_, i) => THIS_YEAR - i);

// Logging a concert: pick the artist, see their real past shows (setlist.fm),
// tap the one you were at — date, venue, city and country fill in, and the
// songs they played become one-tap choices for your favourite.
export function PastShowPicker({
  artist,
  selectedId,
  onPick,
}: {
  artist: string;
  selectedId: string | null;
  onPick: (show: PastShow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState<number | "">("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef(0);

  // A new artist or year starts from the first page.
  useEffect(() => {
    setPage(1);
    setResult(null);
  }, [artist, year]);

  useEffect(() => {
    if (!open || artist.trim().length < 2) return;
    const id = ++request.current;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const qs = new URLSearchParams({ artist: artist.trim(), page: String(page) });
        if (year) qs.set("year", String(year));
        const res = await fetch(`/api/concerts/past?${qs}`);
        const data = (await res.json()) as Result;
        if (id !== request.current) return;
        setResult((prev) => (page > 1 && prev ? { ...data, shows: [...prev.shows, ...data.shows] } : data));
      } catch {
        if (id === request.current) setResult({ shows: [], error: "Couldn't load past shows right now." });
      } finally {
        if (id === request.current) setBusy(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [open, artist, year, page]);

  if (artist.trim().length < 2 || result?.configured === false) return null;

  const hasMore = !!result && !!result.total && !!result.perPage && (result.page ?? 1) * result.perPage < result.total;

  return (
    <div className="rounded-lg border border-line bg-raised">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm"
      >
        <span className="flex items-center gap-2 font-medium">
          <CalendarDays size={15} className="text-accent" aria-hidden />
          Find the show you were at
        </span>
        <ChevronDown size={16} className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="border-t border-line px-4 pb-4 pt-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted">
              {artist.trim()}&rsquo;s past shows{year ? ` in ${year}` : ""}
            </p>
            <label className="sr-only" htmlFor="past-show-year">Year</label>
            <select
              id="past-show-year"
              className="rounded-md border border-line bg-surface px-2 py-1 text-xs"
              value={year}
              onChange={(e) => setYear(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Any year</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <ul className="mt-3 max-h-80 space-y-1.5 overflow-y-auto">
            {(result?.shows ?? []).map((s) => {
              const country = countryByCode(s.countryCode);
              const picked = s.id === selectedId;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onPick(s)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                      picked ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-accent"
                    )}
                  >
                    <span className="w-24 shrink-0 text-xs font-medium text-muted">{formatDate(s.date)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.venue || "Venue unknown"}</span>
                      <span className="block truncate text-xs text-muted">
                        {country?.flag} {[s.city, country?.name ?? s.countryName].filter(Boolean).join(", ")}
                        {s.songs.length > 0 && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5">
                            · <ListMusic size={11} aria-hidden /> {s.songs.length} songs
                          </span>
                        )}
                      </span>
                    </span>
                    {picked && <Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>

          {busy && <p className="mt-3 text-xs text-muted">Loading shows…</p>}
          {!busy && result?.error && <p role="alert" className="mt-3 text-xs text-red-800 dark:text-red-400">{result.error}</p>}
          {!busy && result && !result.error && result.shows.length === 0 && (
            <p className="mt-3 text-xs text-muted">No shows found{year ? ` in ${year}` : ""}. You can still fill in the details yourself.</p>
          )}
          {!busy && hasMore && (
            <button type="button" onClick={() => setPage((p) => p + 1)} className="mt-3 text-xs font-medium text-accent hover:underline">
              Show older shows
            </button>
          )}

          <p className="mt-3 text-[11px] text-muted">
            Show data from{" "}
            <a href="https://www.setlist.fm" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              setlist.fm
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

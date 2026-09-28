"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { photoDateRange } from "@/lib/photoDates";
import type { DatePrecision } from "@/lib/types";

export type DateRange = { from: string; to: string };

/** The date range the chosen photos were taken over (read on the device), or null. */
export function usePhotoDateRange(files: File[]): DateRange | null {
  const [range, setRange] = useState<DateRange | null>(null);
  const key = files.map((f) => `${f.name}:${f.size}:${f.lastModified}`).join("|");
  useEffect(() => {
    let live = true;
    if (!files.length) {
      setRange(null);
      return;
    }
    photoDateRange(files).then((r) => live && setRange(r ? { from: r.from, to: r.to } : null));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return range;
}

type Fields = {
  precision: DatePrecision;
  year: string;
  visitedFrom: string;
  visitedTo: string;
  setPrecision: (p: DatePrecision) => void;
  setYear: (y: string) => void;
  setVisitedFrom: (v: string) => void;
  setVisitedTo: (v: string) => void;
};

/**
 * Fills a trip's dates from its photos by itself — until the person edits
 * a date, after which it never touches them again. If the photos go away
 * again, the fields go back to what they were. `canFill` is false when the
 * trip already has dates of its own.
 *
 * Returns whether the current dates are a suggestion, and wrapped setters
 * to hand to VisitDateFields (so an edit counts as the person's own).
 */
export function useSuggestedDates(range: DateRange | null, f: Fields, canFill = true) {
  const [touched, setTouched] = useState(false);
  const [suggested, setSuggested] = useState(false);
  const before = useRef<Pick<Fields, "precision" | "year" | "visitedFrom" | "visitedTo"> | null>(null);

  useEffect(() => {
    if (touched || !canFill) return;
    if (range) {
      before.current ??= { precision: f.precision, year: f.year, visitedFrom: f.visitedFrom, visitedTo: f.visitedTo };
      f.setPrecision("day");
      f.setVisitedFrom(range.from);
      f.setVisitedTo(range.to);
      f.setYear(range.from.slice(0, 4));
      setSuggested(true);
    } else if (suggested && before.current) {
      f.setPrecision(before.current.precision);
      f.setYear(before.current.year);
      f.setVisitedFrom(before.current.visitedFrom);
      f.setVisitedTo(before.current.visitedTo);
      before.current = null;
      setSuggested(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from, range?.to, touched, canFill]);

  function mine<T>(set: (v: T) => void) {
    return (v: T) => {
      setTouched(true);
      setSuggested(false);
      set(v);
    };
  }

  return {
    suggested,
    setPrecision: mine(f.setPrecision),
    setYear: mine(f.setYear),
    setVisitedFrom: mine(f.setVisitedFrom),
    setVisitedTo: mine(f.setVisitedTo),
  };
}

/** The small line under dates that came from the photos. */
export function SuggestedDatesNote({ hint }: { hint?: string }) {
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
      <Camera size={13} className="shrink-0 text-accent" aria-hidden />
      Suggested from your photos{hint ? ` - ${hint}` : " - change them anytime."}
    </p>
  );
}

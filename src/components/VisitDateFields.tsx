"use client";

import { MONTH_NAMES, cn } from "@/lib/utils";
import type { DatePrecision } from "@/lib/types";

type Props = {
  precision: DatePrecision;
  onPrecisionChange: (p: DatePrecision) => void;
  year: string;
  onYearChange: (y: string) => void;
  month: string;
  onMonthChange: (m: string) => void;
  visitedFrom: string;
  onVisitedFromChange: (v: string) => void;
  visitedTo: string;
  onVisitedToChange: (v: string) => void;
};

/** The Year only / Month / Exact date toggle + matching inputs, shared by the quick "add a visit" form and the visit edit page. */
export function VisitDateFields({
  precision,
  onPrecisionChange,
  year,
  onYearChange,
  month,
  onMonthChange,
  visitedFrom,
  onVisitedFromChange,
  visitedTo,
  onVisitedToChange,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {(["year", "month", "day"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPrecisionChange(p)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              precision === p ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"
            )}
          >
            {p === "year" ? "Year only" : p === "month" ? "Month" : "Exact date"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <label htmlFor="year-input" className="sr-only">Year</label>
        <input
          id="year-input"
          type="number"
          inputMode="numeric"
          min={1900}
          max={2100}
          placeholder="2024"
          className="field !w-20 !py-1.5 text-sm"
          value={year}
          onChange={(e) => onYearChange(e.target.value)}
        />

        {precision === "month" && (
          <>
            <label htmlFor="month-input" className="sr-only">Month</label>
            <select id="month-input" className="field !w-32 !py-1.5 text-sm" value={month} onChange={(e) => onMonthChange(e.target.value)}>
              <option value="">Month</option>
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={String(i + 1).padStart(2, "0")}>{name}</option>
              ))}
            </select>
          </>
        )}

        {precision === "day" && (
          <>
            <label htmlFor="date-from-input" className="sr-only">From date</label>
            <input
              id="date-from-input"
              type="date"
              title="From date"
              className="field !w-[8.5rem] !py-1.5 text-sm"
              value={visitedFrom}
              onChange={(e) => {
                onVisitedFromChange(e.target.value);
                if (e.target.value) onYearChange(e.target.value.slice(0, 4));
              }}
            />
            <label htmlFor="date-to-input" className="sr-only">To date (optional)</label>
            <input
              id="date-to-input"
              type="date"
              title="To date (optional)"
              className="field !w-[8.5rem] !py-1.5 text-sm"
              value={visitedTo}
              onChange={(e) => onVisitedToChange(e.target.value)}
            />
          </>
        )}
      </div>
    </div>
  );
}

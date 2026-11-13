"use client";

import { MONTH_NAMES, cn } from "@/lib/utils";
import type { DatePrecision } from "@/lib/types";
import { DateField } from "./DateField";

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
  /** Somewhere you lived: "I still live here" (no end date). Only shown when onOngoingChange is given. */
  ongoing?: boolean;
  onOngoingChange?: (v: boolean) => void;
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
  ongoing = false,
  onOngoingChange,
}: Props) {
  return (
    <div className="space-y-2">
      {onOngoingChange && (
        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-raised/50 px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[rgb(var(--accent))]"
            checked={ongoing}
            onChange={(e) => {
              onOngoingChange(e.target.checked);
              if (e.target.checked) onVisitedToChange("");
            }}
          />
          <span>
            <span className="font-medium">I still live here</span>
            <span className="block text-xs text-muted">Just say when it started; there&rsquo;s no end date yet.</span>
          </span>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {(["year", "month", "day"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPrecisionChange(p)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              precision === p ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"
            )}
          >
            {p === "year" ? "Year only" : p === "month" ? "Month" : "Exact dates"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {/* With exact dates the year comes from the dates themselves. */}
        {precision !== "day" && (
          <>
            <label htmlFor="year-input" className="sr-only">Year</label>
            <input
              id="year-input"
              type="number"
              inputMode="numeric"
              min={1900}
              max={2100}
              placeholder="2024"
              className="field !w-24 !py-2"
              value={year}
              onChange={(e) => onYearChange(e.target.value)}
            />
          </>
        )}

        {precision === "month" && (
          <>
            <label htmlFor="month-input" className="sr-only">Month</label>
            <select id="month-input" className="field !w-36 !py-2" value={month} onChange={(e) => onMonthChange(e.target.value)}>
              <option value="">Month</option>
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={String(i + 1).padStart(2, "0")}>{name}</option>
              ))}
            </select>
          </>
        )}

        {precision === "day" && (
          <>
            <DateField
              id="date-from-input"
              label={ongoing ? "Moved here on" : "Start date"}
              placeholder={ongoing ? "Moved here on" : "Start date"}
              className="min-w-[9rem] flex-1 !py-2"
              value={visitedFrom}
              onChange={(v) => {
                onVisitedFromChange(v);
                if (v) onYearChange(v.slice(0, 4));
                // An end date before the new start no longer makes sense.
                if (v && visitedTo && visitedTo < v) onVisitedToChange("");
              }}
            />
            {/* Opens on the start date's month, not today's. No end while you still live there. */}
            {!ongoing && <DateField
              id="date-to-input"
              label="End date (optional)"
              placeholder="End date"
              className="min-w-[9rem] flex-1 !py-2"
              value={visitedTo}
              min={visitedFrom || undefined}
              openTo={visitedFrom || undefined}
              clearable
              onChange={onVisitedToChange}
            />}
          </>
        )}
      </div>
    </div>
  );
}

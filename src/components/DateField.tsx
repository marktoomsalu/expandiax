"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { canShift, monthGrid, shiftMonth, startMonth, ymOf, type YearMonth } from "@/lib/calendar";
import { localDay } from "@/lib/photoDates";
import { MONTH_NAMES, cn, formatDate } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const short = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * A date box that opens our own calendar instead of the phone's: month and
 * year can be changed without picking a day (the iPhone picker saves today's
 * day number when you jump months), a tap on a day selects it, and OK - grey
 * until a day is chosen - saves it, so a wrong tap is fixed with another tap.
 * An empty box opens on `openTo` (an end date on its start date's month).
 * Dates go at most a year ahead.
 */
export function DateField({
  id,
  label,
  value,
  onChange,
  placeholder = "Choose a date",
  min,
  max,
  openTo,
  clearable = false,
  required = false,
  className,
}: {
  id?: string;
  /** What the date is, for screen readers ("Start date"). */
  label: string;
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  openTo?: string;
  clearable?: boolean;
  required?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<YearMonth>({ y: 2026, m: 1 });
  const [draft, setDraft] = useState("");
  const today = localDay(new Date());
  const thisYear = Number(today.slice(0, 4));
  // A year from today at most (28 February when today is the 29th).
  const yearAhead = `${thisYear + 1}${today.slice(4) === "-02-29" ? "-02-28" : today.slice(4)}`;
  const latest = max && max < yearAhead ? max : yearAhead;

  function show() {
    setDraft(value);
    setView(startMonth(value, openTo, min, latest, today));
    setOpen(true);
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // Start on the chosen day (or today) so the keyboard lands somewhere useful.
      el.querySelector<HTMLButtonElement>("[data-start='true']")?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  function save(iso: string) {
    onChange(iso);
    setOpen(false);
  }

  const allowed = (iso: string) => (!min || iso >= min) && iso <= latest;
  const changed = !!draft && draft !== value;
  const firstYear = Math.min(min ? Number(min.slice(0, 4)) : 1940, view.y);
  const lastYear = Math.max(Number(latest.slice(0, 4)), view.y);
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => lastYear - i);
  const weeks = monthGrid(view);
  const startDay = draft && draft.slice(0, 7) === `${view.y}-${String(view.m).padStart(2, "0")}` ? draft : today;

  return (
    <>
      <button
        type="button"
        id={id}
        onClick={show}
        aria-haspopup="dialog"
        aria-label={`${label}: ${value ? formatDate(value) : "not chosen"}`}
        className={cn("field flex items-center justify-between gap-2 text-left", className)}
      >
        <span className={cn("truncate", !value && "text-muted/70")}>{value ? short(value) : placeholder}</span>
        <CalendarDays size={16} className="shrink-0 text-muted" aria-hidden />
      </button>
      {/* Lets a form's own "required" check see the date. */}
      {required && <input tabIndex={-1} aria-hidden className="pointer-events-none absolute h-px w-px opacity-0" required value={value} onChange={() => {}} />}

      <dialog
        ref={ref}
        aria-label={label}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        className="w-[min(92vw,380px)] rounded-[28px] border border-line bg-surface p-4 text-ink shadow-2xl backdrop:bg-black/45 backdrop:backdrop-blur-[2px]"
      >
        {open && (
          <>
            <div className="flex items-center gap-1">
              <label className="sr-only" htmlFor={`${id ?? label}-m`}>Month</label>
              <select
                id={`${id ?? label}-m`}
                value={view.m}
                onChange={(e) => setView({ ...view, m: Number(e.target.value) })}
                className="cursor-pointer rounded-lg bg-transparent py-1.5 pl-2 pr-1 font-serif text-lg hover:bg-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>{name}</option>
                ))}
              </select>
              <label className="sr-only" htmlFor={`${id ?? label}-y`}>Year</label>
              <select
                id={`${id ?? label}-y`}
                value={view.y}
                onChange={(e) => setView({ ...view, y: Number(e.target.value) })}
                className="cursor-pointer rounded-lg bg-transparent py-1.5 pl-1 pr-1 font-serif text-lg tabular-nums hover:bg-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <span className="flex-1" />
              <button
                type="button"
                aria-label="Previous month"
                disabled={!canShift(view, -1, min, latest)}
                onClick={() => setView(shiftMonth(view, -1))}
                className="flex h-10 w-10 items-center justify-center rounded-full text-accent hover:bg-raised disabled:text-muted disabled:opacity-30"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                aria-label="Next month"
                disabled={!canShift(view, 1, min, latest)}
                onClick={() => setView(shiftMonth(view, 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full text-accent hover:bg-raised disabled:text-muted disabled:opacity-30"
              >
                <ChevronRight size={22} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wider text-muted" aria-hidden>
              {WEEKDAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="mt-1.5 space-y-0.5">
              {weeks.map((week, w) => (
                <div key={w} className="grid grid-cols-7">
                  {week.map((iso, i) =>
                    iso ? (
                      <button
                        key={iso}
                        type="button"
                        disabled={!allowed(iso)}
                        onClick={() => setDraft(iso)}
                        aria-label={formatDate(iso)}
                        aria-pressed={iso === draft}
                        data-start={iso === startDay}
                        className={cn(
                          "mx-auto flex h-11 w-11 items-center justify-center rounded-full text-base tabular-nums transition-colors disabled:opacity-25",
                          iso === draft
                            ? "gradient-travel font-semibold text-white"
                            : iso === today
                              ? "font-semibold text-accent ring-1 ring-inset ring-accent/50 hover:bg-accent-soft"
                              : "hover:bg-raised"
                        )}
                      >
                        {Number(iso.slice(8))}
                      </button>
                    ) : (
                      <span key={`${w}-${i}`} />
                    )
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
              {clearable && value ? (
                <button type="button" onClick={() => save("")} className="rounded-full px-3 py-2 text-sm text-muted hover:text-ink">
                  Clear
                </button>
              ) : allowed(today) ? (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(today);
                    setView(ymOf(today));
                  }}
                  className="rounded-full px-3 py-2 text-sm font-medium text-accent hover:bg-accent-soft"
                >
                  Today
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-2 text-sm text-muted hover:text-ink">
                  Cancel
                </button>
                {/* Grey until a day is chosen, then the brand colours: saving is one deliberate tap. */}
                <button
                  type="button"
                  disabled={!changed}
                  onClick={() => save(draft)}
                  aria-label={changed ? `OK, ${formatDate(draft)}` : "OK"}
                  className={cn(
                    "min-w-[4.5rem] rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300",
                    changed ? "gradient-travel text-white shadow-lg shadow-accent/30" : "bg-raised text-muted/70"
                  )}
                >
                  OK
                </button>
              </div>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}

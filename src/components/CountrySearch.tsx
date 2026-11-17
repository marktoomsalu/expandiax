"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type React from "react";
import { Search } from "lucide-react";
import { COUNTRIES } from "@/lib/countries";
import { TERRITORIES, territoryFlagFor } from "@/lib/territories";
import { cn } from "@/lib/utils";
import { searchPlaces } from "@/lib/countrySearch";

type Result = { code: string; name: string; flag: string; isTerritory: boolean };

const ALL_RESULTS: Result[] = [
  ...COUNTRIES.map((c) => ({ code: c.code, name: c.name, flag: c.flag, isTerritory: false })),
  ...TERRITORIES.map((t) => ({ code: t.code, name: t.name, flag: territoryFlagFor(t), isTerritory: true })),
];

type Props = {
  onSelect: (code: string) => void;
  visitedCodes?: string[];
  placeholder?: string;
  className?: string;
  /** Lets a parent focus the box (the "Add a country" sheet opens with the keyboard up). */
  inputRef?: React.MutableRefObject<HTMLInputElement | null>;
};

export function CountrySearch({ onSelect, visitedCodes = [], placeholder = "Search countries & territories…", className, inputRef: outerRef }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const ownRef = useRef<HTMLInputElement>(null);
  const inputRef = outerRef ?? ownRef;
  const visited = useMemo(() => new Set(visitedCodes), [visitedCodes]);

  // Accents don't matter ("Tur" finds Türkiye), nor do other names ("Turkey").
  const results = useMemo(() => searchPlaces(query, ALL_RESULTS), [query]);

  // Low on the screen (the first sign-up step) the phone's keyboard would
  // cover a list that opens downwards: then it opens upwards, the best match
  // nearest the box, no taller than the room there is.
  const [room, setRoom] = useState<{ above: boolean; max: number }>({ above: false, max: 320 });
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const box = inputRef.current?.getBoundingClientRect();
      if (!box) return;
      const vv = window.visualViewport;
      const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const top = vv ? vv.offsetTop : 0;
      const below = bottom - box.bottom - 12;
      const aboveSpace = box.top - top - 12;
      const above = below < 220 && aboveSpace > below;
      setRoom({ above, max: Math.max(140, Math.min(320, above ? aboveSpace : below)) });
    };
    measure();
    // The keyboard arriving (or leaving) changes the room: measure again.
    const vv = window.visualViewport;
    vv?.addEventListener("resize", measure);
    vv?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    const late = setTimeout(measure, 350);
    return () => {
      vv?.removeEventListener("resize", measure);
      vv?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      clearTimeout(late);
    };
  }, [open, inputRef]);

  function choose(code: string) {
    onSelect(code);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  return (
    <div className={cn("relative", className)}>
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-label="Search countries"
        aria-activedescendant={open && results[activeIndex] ? `${listId}-${results[activeIndex].code}` : undefined}
        className="field !pl-10"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!results.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(results[activeIndex].code);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          style={{ maxHeight: room.max }}
          className={cn(
            "absolute z-30 flex w-full overflow-y-auto overscroll-contain rounded-card border border-line bg-surface shadow-lg",
            room.above ? "bottom-full mb-2 flex-col-reverse" : "top-full mt-2 flex-col"
          )}
        >
          {results.map((c, i) => (
            <li
              key={c.code}
              id={`${listId}-${c.code}`}
              role="option"
              aria-selected={i === activeIndex}
              className={cn(
                "flex cursor-pointer items-center justify-between px-4 py-2.5 font-sans text-sm",
                i === activeIndex ? "bg-raised text-ink" : "text-ink"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(c.code);
              }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span className="flex items-center gap-2">
                <span aria-hidden>{c.flag}</span>
                {c.name}
                {c.isTerritory && (
                  <span className="rounded-full border border-line px-1.5 py-0.5 text-[0.625rem] font-medium text-muted">
                    Territory
                  </span>
                )}
              </span>
              {visited.has(c.code) && <span className="text-xs text-accent">Visited</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

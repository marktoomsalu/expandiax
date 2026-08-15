"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { COUNTRIES } from "@/lib/countries";
import { TERRITORIES, territoryFlag } from "@/lib/territories";
import { cn } from "@/lib/utils";

type Result = { code: string; name: string; flag: string; isTerritory: boolean };

const ALL_RESULTS: Result[] = [
  ...COUNTRIES.map((c) => ({ code: c.code, name: c.name, flag: c.flag, isTerritory: false })),
  ...TERRITORIES.map((t) => ({ code: t.code, name: t.name, flag: territoryFlag(t.code), isTerritory: true })),
];

type Props = {
  onSelect: (code: string) => void;
  visitedCodes?: string[];
  placeholder?: string;
  className?: string;
};

export function CountrySearch({ onSelect, visitedCodes = [], placeholder = "Search countries & territories…", className }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const visited = useMemo(() => new Set(visitedCodes), [visitedCodes]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ALL_RESULTS.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q
    ).slice(0, 8);
  }, [query]);

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
          className="absolute z-30 mt-2 w-full overflow-hidden rounded-card border border-line bg-surface shadow-lg"
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

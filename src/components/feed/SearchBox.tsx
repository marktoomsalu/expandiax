"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { PeopleSuggest } from "../PeopleSuggest";

/** A search field; as you type a name, matching people drop down under it. Enter searches everything. */
export function SearchBox({ action, placeholder, defaultValue, hidden, flush = false }: { action: string; placeholder: string; defaultValue?: string; hidden?: Record<string, string>; flush?: boolean }) {
  const [q, setQ] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  return (
    <form action={action} role="search" className={flush ? "relative" : "relative mt-3"} onSubmit={() => setOpen(false)}>
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Search size={17} className="pointer-events-none absolute left-4 top-[1.35rem] -translate-y-1/2 text-muted" aria-hidden />
      <label htmlFor={`search-${action}`} className="sr-only">
        {placeholder}
      </label>
      <input
        id={`search-${action}`}
        name="q"
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        autoComplete="off"
        placeholder={placeholder}
        className="field !rounded-full !py-2.5 !pl-11"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-full z-30 mt-2">
          <PeopleSuggest
            query={q}
            onPick={() => setOpen(false)}
            footer={
              <button type="submit" onMouseDown={(e) => e.preventDefault()} className="w-full border-t border-line px-4 py-2.5 text-left text-sm font-medium text-accent hover:bg-raised">
                See all results for &ldquo;{q.trim()}&rdquo;
              </button>
            }
          />
        </div>
      )}
    </form>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { COUNTRIES, countryByCode } from "@/lib/countries";
import type { Place } from "@/lib/places";

type Hit = { key: string; countryCode: string; name: string; sub: string; place?: Place };

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** Search a town or a country to dream of — Kyoto, Patagonia's towns, all of Japan. */
export function AddDream() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [towns, setTowns] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setTowns([]);
      return;
    }
    const id = ++request.current;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { places?: Place[] };
        if (id === request.current) setTowns(data.places ?? []);
      } catch {
        if (id === request.current) setTowns([]);
      } finally {
        if (id === request.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const q = norm(query.trim());
  const countryHits: Hit[] =
    q.length >= 2
      ? COUNTRIES.filter((c) => norm(c.name).includes(q))
          .slice(0, 3)
          .map((c) => ({ key: `c:${c.code}`, countryCode: c.code, name: c.name, sub: `${c.flag} The whole country` }))
      : [];
  const townHits: Hit[] = towns
    .filter((p) => countryByCode(p.countryCode))
    .slice(0, 6)
    .map((p) => {
      const c = countryByCode(p.countryCode)!;
      return { key: `t:${p.id}`, countryCode: c.code, name: p.name, sub: `${c.flag} ${[p.region, c.name].filter(Boolean).join(", ")}`, place: p };
    });
  const hits = [...countryHits, ...townHits];

  async function add(h: Hit) {
    setError(null);
    const { error: err } = await createClient()
      .from("want_to_go")
      .insert({ country_code: h.countryCode, place_name: h.place ? h.place.name.slice(0, 80) : "", lat: h.place?.lat ?? null, lng: h.place?.lng ?? null });
    if (err && err.code !== "23505") {
      setError("Couldn't add that dream. Try again.");
      return;
    }
    setQuery("");
    setTowns([]);
    router.refresh();
  }

  return (
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
      <label htmlFor="dream-search" className="sr-only">Add a dream place</label>
      <input
        id="dream-search"
        className="field !rounded-full !py-2.5 !pl-10 !pr-10"
        placeholder="Add a dream - a town or a country"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      {searching && <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-muted" aria-hidden />}
      {hits.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          {hits.map((h) => (
            <li key={h.key}>
              <button type="button" onClick={() => add(h)} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm hover:bg-raised">
                <Sparkles size={14} className="shrink-0 text-violet-500" aria-hidden />
                <span className="font-medium">{h.name}</span>
                <span className="truncate text-xs text-muted">{h.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-800 dark:text-red-400">{error}</p>}
    </div>
  );
}

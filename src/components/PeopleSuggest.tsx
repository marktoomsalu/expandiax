"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { searchPeople, type PersonHit } from "@/lib/peopleSearch";
import { matchCountries } from "@/lib/countrySuggest";

/**
 * People matching what's being typed, live, as a list under a search box:
 * the same ranking as the full search (exact name, then names starting
 * with it, people you follow, the most travelled). Tapping one opens them.
 * With `countries`, matching countries too (by name, another name or
 * capital), the better match of the two on top.
 */
export function PeopleSuggest({ query, onPick, footer, countries = false }: { query: string; onPick?: () => void; footer?: React.ReactNode; countries?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [me, setMe] = useState<string | null>(null);
  const [hits, setHits] = useState<PersonHit[]>([]);
  const [loading, setLoading] = useState(false);
  const term = query.trim();

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, [supabase]);

  useEffect(() => {
    if (!me || term.length < 2) {
      setHits([]);
      return;
    }
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const found = await searchPeople(supabase, term, me, 6).catch(() => []);
      if (alive) {
        setHits(found);
        setLoading(false);
      }
    }, 180);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [term, me, supabase]);

  if (term.length < 2) return null;
  const places = countries ? matchCountries(term, 3) : [];
  // Countries first when one plainly matches and no person's name starts with it.
  const lower = term.toLowerCase();
  const personStarts = hits.some((p) => p.display_name.toLowerCase().startsWith(lower) || p.username.startsWith(lower));
  const placesFirst = places.length > 0 && places[0].score >= 3 && !personStarts;
  const placeList = places.length > 0 && (
    <ul className={placesFirst ? "" : "border-t border-line"} aria-label="Countries">
      {places.map(({ country: c, via }) => (
        <li key={c.code}>
          <Link
            href={`/explore/country/${c.code.toLowerCase()}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onPick}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-raised"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-raised text-xl" aria-hidden>
              {c.flag}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{c.name}</span>
              <span className="block truncate text-xs text-muted">{via ? `${via} · ${c.continent}` : `Country · ${c.continent}`}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
      {placesFirst && placeList}
      {hits.length === 0 ? (
        places.length === 0 || loading ? (
          <p className={`px-4 py-3 text-sm text-muted ${placesFirst ? "border-t border-line" : ""}`}>{loading ? "Looking…" : `Nobody called “${term}” yet.`}</p>
        ) : null
      ) : (
        <ul className={placesFirst ? "border-t border-line" : ""}>
          {hits.map((p) => (
            <li key={p.id}>
              <Link
                href={`/u/${p.username}`}
                // Before the field loses focus and the list closes.
                onMouseDown={(e) => e.preventDefault()}
                onClick={onPick}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-raised"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-raised font-serif text-sm text-muted">
                  {p.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    p.display_name.charAt(0)
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {p.display_name}
                    {p.visibility === "private" && <Lock size={11} className="shrink-0 text-muted" aria-label="Private account" />}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    @{p.username} · {p.countries} {p.countries === 1 ? "country" : "countries"}
                    {p.following ? " · Following" : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!placesFirst && placeList}
      {footer}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import worldTopo from "world-atlas/countries-50m.json";
import { createClient } from "@/lib/supabase/client";
import { TERRITORIES, territoryByCode, territoryByNumeric } from "@/lib/territories";
import { cn } from "@/lib/utils";

export function TerritoriesMap({ userId, visitedCodes }: { userId: string; visitedCodes: string[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const visited = new Set(visitedCodes);

  async function toggleCode(code: string) {
    const meta = territoryByCode(code);
    if (!meta || busy) return;
    setBusy(true);
    if (visited.has(meta.code)) {
      await supabase.from("visited_territories").delete().eq("user_id", userId).eq("territory_code", meta.code);
    } else {
      await supabase.from("visited_territories").insert({ user_id: userId, territory_code: meta.code, territory_name: meta.name });
    }
    setBusy(false);
    router.refresh();
  }

  async function toggle(numeric: string) {
    const meta = territoryByNumeric(numeric);
    if (meta) await toggleCode(meta.code);
  }

  return (
    <div className="space-y-8">
    <ComposableMap projection="geoEqualEarth" className="w-full">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Geographies geography={worldTopo as any}>
        {({ geographies }) =>
          geographies.map((geo) => {
            const meta = territoryByNumeric(geo.id as string);
            const isVisited = meta ? visited.has(meta.code) : false;
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                onClick={() => meta && toggle(geo.id as string)}
                tabIndex={meta ? 0 : -1}
                aria-label={meta?.name ?? undefined}
                style={{
                  default: {
                    fill: isVisited ? "rgb(var(--accent))" : "rgb(var(--unvisited))",
                    stroke: "rgb(var(--canvas))",
                    strokeWidth: 0.5,
                    outline: "none",
                    cursor: meta ? "pointer" : "default",
                  },
                  hover: {
                    fill: meta ? "rgb(var(--accent) / 0.7)" : "rgb(var(--unvisited))",
                    stroke: "rgb(var(--canvas))",
                    strokeWidth: 0.5,
                    outline: "none",
                  },
                  pressed: {
                    fill: "rgb(var(--accent))",
                    stroke: "rgb(var(--canvas))",
                    strokeWidth: 0.5,
                    outline: "none",
                  },
                }}
              />
            );
          })
        }
      </Geographies>
    </ComposableMap>

      {/* Full checklist below the map — a handful of the smaller
          territories (Gibraltar, Guadeloupe, French Guiana, etc.) don't
          have their own distinct shape at this map resolution, so this is
          the only way to mark those specifically; shown for all of them
          for one consistent, always-complete way to toggle. */}
      <div>
        <p className="mb-3 text-sm font-medium text-muted">All territories</p>
        <ul className="flex flex-wrap gap-2">
          {[...TERRITORIES]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((t) => {
              const isVisited = visited.has(t.code);
              return (
                <li key={t.code}>
                  <button
                    type="button"
                    onClick={() => toggleCode(t.code)}
                    disabled={busy}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                      isVisited
                        ? "border-accent bg-accent text-white"
                        : "border-line bg-surface text-ink hover:border-accent hover:text-accent"
                    )}
                  >
                    {t.name}
                  </button>
                </li>
              );
            })}
        </ul>
      </div>
    </div>
  );
}

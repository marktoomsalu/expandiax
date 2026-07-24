"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import statesTopo from "us-atlas/states-10m.json";
import { createClient } from "@/lib/supabase/client";
import { usStateByFips } from "@/lib/usStates";

export function USStatesMap({ userId, visitedCodes }: { userId: string; visitedCodes: string[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const visited = new Set(visitedCodes);

  async function toggle(fips: string) {
    const meta = usStateByFips(fips);
    if (!meta || busy) return;
    setBusy(true);
    if (visited.has(meta.code)) {
      await supabase.from("visited_us_states").delete().eq("user_id", userId).eq("state_code", meta.code);
    } else {
      await supabase.from("visited_us_states").insert({ user_id: userId, state_code: meta.code, state_name: meta.name });
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <ComposableMap projection="geoAlbersUsa" className="w-full">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Geographies geography={statesTopo as any}>
        {({ geographies }) =>
          geographies.map((geo) => {
            const meta = usStateByFips(geo.id as string);
            const isVisited = meta ? visited.has(meta.code) : false;
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                onClick={() => toggle(geo.id as string)}
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
  );
}

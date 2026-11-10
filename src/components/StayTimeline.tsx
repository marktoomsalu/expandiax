"use client";

import { useEffect, useState } from "react";
import { tapLight } from "@/lib/haptics";
import { StayRow, type StayView } from "./StayRow";

/**
 * Someone's stays and trips in a country, newest first, each opening in
 * place to show its memories (photos, notes, song). All start closed; a
 * link to #trip-<id> (from a place card) opens and shows that one.
 */
export function StayTimeline({ stays, memories }: { stays: StayView[]; memories: Record<string, React.ReactNode> }) {
  // All closed to begin with: tap one to open it.
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const fromHash = () => {
      const id = decodeURIComponent(location.hash).replace(/^#trip-/, "");
      if (!id || !stays.some((s) => s.id === id)) return;
      setOpen((o) => new Set(o).add(id));
      requestAnimationFrame(() => document.getElementById(`trip-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [stays]);

  return (
    <ol>
      {stays.map((t, i) => (
        <li key={t.id} id={`trip-${t.id}`} className="scroll-mt-24">
          <StayRow
            stay={t}
            href={`#trip-${t.id}`}
            first={i === 0}
            last={i === stays.length - 1}
            readOnly
            expand={{
              open: open.has(t.id),
              onToggle: () => {
                tapLight();
                setOpen((o) => {
                  const next = new Set(o);
                  if (next.has(t.id)) next.delete(t.id);
                  else next.add(t.id);
                  return next;
                });
              },
            }}
          >
            {memories[t.id]}
          </StayRow>
        </li>
      ))}
    </ol>
  );
}

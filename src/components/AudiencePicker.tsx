"use client";

import { AUDIENCES, type Audience } from "@/lib/audience";
import { tapLight } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/** Feed / Friends / Only me, side by side. */
export function AudiencePicker({ value, onChange, label = "Who can see it" }: { value: Audience; onChange: (next: Audience) => void; label?: string }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={label}>
      {AUDIENCES.map(({ value: v, label: name, note, icon: Icon }) => {
        const picked = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={picked}
            onClick={() => {
              tapLight();
              onChange(v);
            }}
            className={cn(
              "flex flex-col items-start rounded-2xl border px-3 py-2.5 text-left transition-colors",
              picked ? "border-accent bg-accent-soft" : "border-line hover:border-accent/50"
            )}
          >
            <span className={cn("flex items-center gap-1.5 text-sm font-medium", picked && "text-accent")}>
              <Icon size={14} aria-hidden /> {name}
            </span>
            <span className="mt-0.5 text-[11px] leading-snug text-muted">{note}</span>
          </button>
        );
      })}
    </div>
  );
}

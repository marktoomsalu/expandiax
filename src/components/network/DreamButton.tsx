"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { EventType } from "@/lib/types";
import { cn } from "@/lib/utils";

export type DreamTarget =
  | { kind: "place"; countryCode: string; placeName?: string; lat?: number | null; lng?: number | null }
  | { kind: "event"; name: string; eventType: EventType; image?: string | null };

/**
 * Dream: a place (a town, or a whole country) or an event you'd love to go
 * to — kept in your own private lists, under My World and Events. Dreams
 * lift those places and the people who've been there in your feed.
 */
export function DreamButton({
  target,
  initial,
  variant = "pill",
  label,
}: {
  target: DreamTarget;
  initial: boolean;
  variant?: "pill" | "icon" | "small";
  label: string;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    // Also used inside cards that are links themselves.
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    const next = !on;
    setOn(next);
    const supabase = createClient();
    let error: { code?: string } | null = null;
    if (target.kind === "place") {
      const place = target.placeName ?? "";
      ({ error } = next
        ? await supabase.from("want_to_go").insert({ country_code: target.countryCode, place_name: place, lat: target.lat ?? null, lng: target.lng ?? null })
        : await supabase.from("want_to_go").delete().eq("country_code", target.countryCode).eq("place_name", place));
    } else {
      ({ error } = next
        ? await supabase.from("dream_events").insert({ name: target.name.trim().slice(0, 120), event_type: target.eventType, image: target.image?.startsWith("https://") ? target.image : null })
        : await supabase.from("dream_events").delete().ilike("name", target.name.trim()));
    }
    // Already on the list (another tab, a double tap): that's still "dreaming".
    if (error && error.code !== "23505") setOn(!next);
    setBusy(false);
    router.refresh();
  }

  const aria = on ? `Stop dreaming of ${label}` : `Dream of ${label}`;
  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={on}
        aria-label={aria}
        title={on ? "Dreaming" : "Dream"}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full ring-1 backdrop-blur transition-colors",
          on ? "bg-violet-500 text-white ring-white/40" : "bg-black/35 text-white ring-white/25 hover:bg-black/55"
        )}
      >
        <Sparkles size={15} className={cn(on && "fill-white")} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={on}
      aria-label={aria}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold transition-colors",
        variant === "small" ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm",
        on ? "border-violet-500 bg-violet-500 text-white" : "border-violet-500/60 text-violet-600 hover:bg-violet-500/10 dark:text-violet-300"
      )}
    >
      <Sparkles size={variant === "small" ? 13 : 15} className={cn(on && "fill-white")} /> {on ? "Dreaming" : variant === "small" ? "Dream it" : "Dream"}
    </button>
  );
}

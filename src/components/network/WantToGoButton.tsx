"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Want to go: your own list of places (a town, or a whole country) — only
 * you see it. It lifts those places, and the people who've been, in your feed.
 */
export function WantToGoButton({
  countryCode,
  placeName = "",
  lat = null,
  lng = null,
  initial,
  variant = "pill",
  label,
}: {
  countryCode: string;
  placeName?: string;
  lat?: number | null;
  lng?: number | null;
  initial: boolean;
  variant?: "pill" | "icon";
  label?: string;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const name = label ?? (placeName || countryCode);

  async function toggle(e: React.MouseEvent) {
    // Lives inside cards that are links themselves.
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    const next = !on;
    setOn(next);
    const supabase = createClient();
    const { error } = next
      ? await supabase.from("want_to_go").insert({ country_code: countryCode, place_name: placeName, lat, lng })
      : await supabase.from("want_to_go").delete().eq("country_code", countryCode).eq("place_name", placeName);
    if (error && error.code !== "23505") setOn(!next);
    setBusy(false);
    router.refresh();
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={on}
        aria-label={on ? `Remove ${name} from Want to go` : `Add ${name} to Want to go`}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white ring-1 ring-white/25 backdrop-blur transition-colors hover:bg-black/55"
      >
        <Bookmark size={15} className={cn(on && "fill-white")} />
      </button>
    );
  }
  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={on} className={cn(on ? "btn-ghost" : "btn-accent", "!py-2 text-sm")}>
      <Bookmark size={15} className={cn(on && "fill-current")} /> {on ? "On your Want to go list" : "Want to go"}
    </button>
  );
}

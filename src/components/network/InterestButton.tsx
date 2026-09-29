"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { NetworkEvent } from "@/lib/networkEvents";
import { cn } from "@/lib/utils";

const https = (u: string | null) => (u && u.startsWith("https://") ? u.slice(0, 1000) : null);

/** ♥ — "I'm interested": people who can see your profile see it, and it lifts the event for them. */
export function InterestButton({ event }: { event: Omit<NetworkEvent, "friendIds"> }) {
  const router = useRouter();
  const [on, setOn] = useState(event.mine);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    const next = !on;
    setOn(next);
    const supabase = createClient();
    const { error } = next
      ? await supabase.from("event_interest").insert({
          event_key: event.key.slice(0, 200),
          name: event.name.slice(0, 200),
          event_date: event.date,
          venue: event.venue.slice(0, 200),
          city: event.city.slice(0, 100),
          country_code: event.countryCode && /^[A-Z]{2}$/.test(event.countryCode) ? event.countryCode : null,
          category: event.category,
          url: https(event.url),
          image: https(event.image),
        })
      : await supabase.from("event_interest").delete().eq("event_key", event.key);
    if (error && error.code !== "23505") setOn(!next);
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={on}
      aria-label={on ? `Not interested in ${event.name}` : `Interested in ${event.name}`}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full ring-1 backdrop-blur transition-colors",
        on ? "bg-white text-accent ring-white" : "bg-black/35 text-white ring-white/30 hover:bg-black/55"
      )}
    >
      <Heart size={16} className={cn(on && "fill-accent")} />
    </button>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { savePrefill, type EventPrefill } from "@/lib/eventPrefill";
import { tapSuccess } from "@/lib/haptics";

// The key growth loop: seeing someone else's memory should make it
// effortless to create your own version of the same experience. Hands the
// shared facts (title, date, venue, artist — never their rating/review/
// photos) to a fresh /events/new draft via sessionStorage, then lets the
// normal EventForm take over exactly as if the viewer typed it themselves.
export function IWasThereButton({ prefill, label = "I was there" }: { prefill: EventPrefill; label?: string }) {
  const router = useRouter();

  function onClick() {
    tapSuccess();
    savePrefill(prefill);
    router.push("/events/new");
  }

  return (
    <button type="button" onClick={onClick} className="btn-accent !py-2 text-sm">
      <Sparkles size={15} /> {label}
    </button>
  );
}

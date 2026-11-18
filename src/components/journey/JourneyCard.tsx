import { createClient } from "@/lib/supabase/server";
import { loadJourney } from "@/lib/journeyData";
import { JourneyCardView } from "./JourneyCardView";

/** Chapter One on My World and the Feed, until it's finished. */
export async function JourneyCard({ className }: { className?: string }) {
  const journey = await loadJourney(createClient());
  if (!journey || journey.finished) return null;
  return <JourneyCardView journey={journey} className={className} />;
}

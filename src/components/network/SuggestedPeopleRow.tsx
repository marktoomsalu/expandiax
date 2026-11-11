import { createClient } from "@/lib/supabase/server";
import { loadSuggestions } from "@/lib/suggestPeople";
import { SuggestedPeople } from "./SuggestedPeople";

/** The "Suggested for you" carousel, loaded on the server (wrap it in Suspense). */
export async function SuggestedPeopleRow({ viewerId, title, limit = 15 }: { viewerId: string; title?: string; limit?: number }) {
  const people = await loadSuggestions(createClient(), viewerId, limit).catch(() => []);
  return <SuggestedPeople people={people} title={title} />;
}

import type { createClient } from "@/lib/supabase/server";
import { buildJourney, type ChapterFacts, type Journey } from "./journey";

type Supabase = ReturnType<typeof createClient>;

/** Their Chapter One, from the database (null before migration 083, or signed out). */
export async function loadJourney(supabase: Supabase): Promise<Journey | null> {
  const { data, error } = await supabase.rpc("first_chapter");
  if (error || !data) return null;
  return buildJourney(data as ChapterFacts);
}

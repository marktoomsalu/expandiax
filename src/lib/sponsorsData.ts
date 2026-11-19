import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "./supabase/admin";
import { fromRow, type PlacementRow, type Sponsor } from "./sponsors";

export const PLACEMENTS_TAG = "partner-placements";

/** The placements running now (cached for 5 minutes; saving one in admin refreshes it). */
export const loadSponsors = unstable_cache(
  async (): Promise<Sponsor[]> => {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await createAdminClient()
      .from("partner_placements")
      .select("id, kind, partner, country_code, url, image_url, name, event_date, venue, city, audience, title, body, cta, starts_on, until")
      .eq("active", true)
      .or(`until.is.null,until.gte.${today}`)
      .order("created_at", { ascending: false });
    if (error) return []; // before migration 084
    return ((data ?? []) as PlacementRow[]).map(fromRow);
  },
  ["partner-placements"],
  { revalidate: 300, tags: [PLACEMENTS_TAG] }
);

/** One more view or click for a partner's report. Never in the way of the page. */
export async function countPlacement(id: string, what: "view" | "click") {
  await createAdminClient()
    .rpc("count_partner_placement", { p_id: id, p_what: what })
    .then(() => undefined, () => undefined);
}

import type { NearbyCategory } from "@/lib/concerts";

/** What each kind of event is called in filters ("Concerts", "Sport"…) — safe to use in the browser. */
export const NEARBY_CATEGORY_LABEL: Record<NearbyCategory, string> = {
  music: "Concerts",
  festival: "Festivals",
  sport: "Sport",
  conference: "Conferences",
  arts: "Theatre & arts",
  other: "More",
};

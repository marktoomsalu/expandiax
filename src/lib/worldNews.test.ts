import { describe, expect, it } from "vitest";
import { chosenWorld, worldNews, type MemberWorld } from "./worldNews";
import type { KeptWorld } from "./worldScan";

const trip = (code: string, from: string, to = from) => ({ code, from, to, kind: "trip" as const, covers: [] });
const event = (code: string, date: string, title: string, venue: string | null = null) => ({ type: "concert" as const, title, artist: title, venue, city: null, code, date, covers: [] });

describe("back with an account already", () => {
  const found: KeptWorld = {
    homeCode: "EE",
    trips: [trip("IT", "2025-09-01", "2025-09-08"), trip("IT", "2023-05-02", "2023-05-06"), trip("JP", "2024-04-10", "2024-04-20")],
    countries: ["IS"],
    events: [event("GB", "2025-08-31", "Luna Vale", "City Stadium"), event("NO", "2025-04-26", "Summer Static", "Harbour Arena")],
  };
  const mine: MemberWorld = {
    codes: ["EE", "IT", "GB"],
    visits: { IT: [{ visited_country_id: "x", year: 2025, visited_from: "2025-09-03", visited_to: "2025-09-05" }] },
    events: [{ event_date: "2025-08-31", title: "Concert in London", venue: "City Stadium" }],
  };

  it("shows only what isn't in their world yet, by the same rules as saving", () => {
    const news = worldNews(found, mine);
    expect(news.countries.sort()).toEqual(["IS", "JP", "NO"]);
    expect(news.trips.map((t) => `${t.code} ${t.from}`)).toEqual(["IT 2023-05-02", "JP 2024-04-10"]);
    expect(news.events.map((e) => e.title)).toEqual(["Summer Static"]);
    expect(news.known).toEqual({ countries: 3, trips: 1, events: 1 });
  });

  it("saves just what they chose, and never their home", () => {
    const news = worldNews(found, mine);
    const kept = chosenWorld(news, { countries: new Set(["JP"]), trips: new Set([news.trips[1]]), events: new Set() });
    expect(kept).toEqual({ homeCode: null, trips: [news.trips[1]], countries: ["JP"], events: [] });
  });
});

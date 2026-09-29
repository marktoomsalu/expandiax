import { describe, expect, it } from "vitest";
import type { NearbyEvent } from "./concerts";
import { mergeNetworkEvents, type InterestRow } from "./networkEvents";

const row = (user_id: string, event_key: string, event_date = "2026-11-16"): InterestRow => ({
  user_id,
  event_key,
  name: event_key,
  event_date,
  venue: "",
  city: "",
  country_code: null,
  category: "music",
  url: null,
  image: null,
});
const near = (id: string, date = "2026-10-05"): NearbyEvent => ({ id, name: id, date, time: null, venue: "", city: "", countryCode: null, url: null, image: null, category: "music", genre: null, performers: [], priceFrom: null, moreDates: 0 });

describe("mergeNetworkEvents", () => {
  const following = new Set(["anna", "karl"]);
  it("puts events friends are into first, most friends first, then what's near", () => {
    const out = mergeNetworkEvents([row("anna", "coldplay"), row("karl", "coldplay"), row("anna", "derby", "2026-10-27"), row("stranger", "secret")], [near("jazz"), near("coldplay")], "me", following);
    expect(out.map((e) => [e.key, e.friendIds.length])).toEqual([
      ["coldplay", 2],
      ["derby", 1],
      ["jazz", 0],
    ]);
  });
  it("knows which ones you've hearted, and never lists someone you don't follow", () => {
    const out = mergeNetworkEvents([row("me", "jazz"), row("stranger", "jazz")], [near("jazz")], "me", following);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ key: "jazz", mine: true, friendIds: [] });
  });
  it("shows what's near even when nobody has hearted anything", () => {
    expect(mergeNetworkEvents([], [near("a"), near("b")], "me", following).map((e) => e.key)).toEqual(["a", "b"]);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { placeFromOpenMeteo, searchPlaces } from "./places";
import { nearbyCards } from "./nearbyCards";
import type { NearbyEvent } from "./concerts";

describe("city search", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps cities and towns, drops other kinds of places", () => {
    expect(placeFromOpenMeteo({ id: 1, name: "Bologna", latitude: 44.49, longitude: 11.34, country_code: "it", admin1: "Emilia-Romagna", feature_code: "PPLA" })).toEqual({
      id: 1, name: "Bologna", region: "Emilia-Romagna", countryCode: "IT", lat: 44.49, lng: 11.34,
    });
    expect(placeFromOpenMeteo({ id: 2, name: "Bologna Airport", latitude: 44.5, longitude: 11.3, feature_code: "AIRP" })).toBeNull();
  });

  it("only sends the typed text, and ignores one-letter searches", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ id: 1, name: "Bologna", latitude: 44.49, longitude: 11.34, feature_code: "PPLA" }] }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await searchPlaces("B")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await searchPlaces(" Bologna "))[0].name).toBe("Bologna");
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.host).toBe("geocoding-api.open-meteo.com");
    expect(url.searchParams.get("name")).toBe("Bologna");
  });
});

describe("nearbyCards", () => {
  const ev = (id: string, performers: string[]): NearbyEvent => ({
    id, name: id, date: "2026-10-01", time: null, venue: "V", city: "C", countryCode: "IT", url: null, image: null,
    category: "music", genre: null, performers, priceFrom: null, moreDates: 0,
  });
  it("puts artists you've seen live first and marks them", () => {
    const cards = nearbyCards([ev("a", ["Someone"]), ev("b", ["Beyoncé"])], [{ name: "Beyonce", image: null }]);
    expect(cards.map((c) => [c.id, c.badge])).toEqual([["b", "You’ve seen them live"], ["a", null]]);
  });
});

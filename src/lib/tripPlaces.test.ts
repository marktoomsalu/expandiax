import { describe, expect, it } from "vitest";
import { dayLabel, daysBetween, distanceKm, formatKm, shortDays, journeyLegs, mediaByPlace, orderStops, placesInCountry, stayLength, suggestTripName, stayMonth, stayWhen, countrySummary, tripName } from "./tripPlaces";

const city = (id: string, visit: string, name: string, over: Record<string, unknown> = {}) => ({
  id, country_visit_id: visit, city_name: name, arrived: null as string | null, departed: null as string | null, position: 0, lat: null as number | null, lng: null as number | null, ...over,
});
const visit = (id: string, over: Record<string, unknown> = {}) => ({
  id, year: 2026, visited_from: null as string | null, visited_to: null as string | null, date_precision: "year" as const, title: "", kind: "trip" as const, ...over,
});
const photo = (id: string, v: string, city_id: string | null = null, media_type: "image" | "video" = "image") => ({ id, country_visit_id: v, city_id, media_type, public_url: `https://x/${id}` });

describe("distances", () => {
  it("Bled to Ljubljana is about 45 km as the crow flies", () => {
    const km = distanceKm({ lat: 46.3683, lng: 14.1146 }, { lat: 46.0511, lng: 14.5051 });
    expect(Math.round(km)).toBeGreaterThan(40);
    expect(Math.round(km)).toBeLessThan(50);
    expect(formatKm(km)).toMatch(/^4\d km$/);
    expect(formatKm(1237)).toBe("1,235 km");
    expect(formatKm(3.44)).toBe("3.4 km");
  });
});

describe("stay length", () => {
  it("days, weeks, months, years — only with exact dates", () => {
    expect(daysBetween("2026-09-07", "2026-09-12")).toBe(6);
    expect(stayLength({ visited_from: "2026-09-07", visited_to: "2026-09-12", date_precision: "day" })).toBe("6 days");
    expect(stayLength({ visited_from: "2025-03-05", visited_to: "2025-03-12", date_precision: "day" })).toBe("1 week");
    expect(stayLength({ visited_from: "2025-09-01", visited_to: "2026-06-01", date_precision: "day" })).toBe("9 months");
    expect(stayLength({ visited_from: "2025-08-01", visited_to: "2025-08-31", date_precision: "month" })).toBeNull();
  });
});

describe("journey", () => {
  it("orders stops by arrival, then as arranged", () => {
    const stops = orderStops([city("k", "t", "Kranjska Gora", { arrived: "2026-09-11" }), city("b", "t", "Bled", { arrived: "2026-09-07" }), city("l", "t", "Ljubljana", { position: 1 })]);
    expect(stops.map((s) => s.city_name)).toEqual(["Bled", "Kranjska Gora", "Ljubljana"]);
  });
  it("legs have a distance only when both ends are on the map", () => {
    const legs = journeyLegs([city("b", "t", "Bled", { lat: 46.37, lng: 14.11 }), city("l", "t", "Ljubljana", { lat: 46.05, lng: 14.51 }), city("x", "t", "Somewhere")]);
    expect(legs[0].km).toBeGreaterThan(40);
    expect(legs[1].km).toBeNull();
  });
});

describe("photos by place", () => {
  it("marked photos go to their place; a one-place trip gets all its photos", () => {
    const two = mediaByPlace([city("b", "t", "Bled"), city("l", "t", "Ljubljana")], [photo("1", "t", "b"), photo("2", "t", null), photo("3", "t", "l")]);
    expect(two.get("b")!.map((m) => m.id)).toEqual(["1"]);
    expect(two.get("l")!.map((m) => m.id)).toEqual(["3"]);
    const one = mediaByPlace([city("b", "t", "Bled")], [photo("1", "t"), photo("2", "t")]);
    expect(one.get("b")).toHaveLength(2);
  });
});

describe("names", () => {
  it("uses the title, else a sensible default", () => {
    expect(tripName({ title: "Slovenia Road Trip", kind: "trip" }, "Slovenia")).toBe("Slovenia Road Trip");
    expect(tripName({ title: "", kind: "trip" }, "Slovenia")).toBe("Trip to Slovenia");
    expect(tripName({ title: "  ", kind: "lived" }, "Slovenia", ["Ljubljana"])).toBe("Lived in Ljubljana");
    expect(tripName({ title: "", kind: "lived" }, "Slovenia")).toBe("Lived in Slovenia");
    expect(tripName({ title: "", kind: "trip" }, "Slovenia", ["Bled", "Piran"])).toBe("Bled & Piran");
  });
});

describe("placesInCountry", () => {
  it("merges the same place across trips, counts trips and photos, marks where you lived", () => {
    const visits = [
      visit("lived", { kind: "lived", visited_from: "2025-09-01", visited_to: "2026-06-30", date_precision: "day" }),
      visit("t1", { visited_from: "2025-08-08", visited_to: "2025-08-10", date_precision: "day" }),
      visit("t2", { visited_from: "2024-06-20", visited_to: "2024-06-23", date_precision: "day" }),
    ];
    const cities = [
      city("c1", "lived", "Ljubljana", { lat: 46.05, lng: 14.51 }),
      city("c2", "t1", "Bled"),
      city("c3", "t2", "bled"),
      city("c4", "t2", "Ljubljana"),
    ];
    const media = [photo("p1", "lived"), photo("p2", "t1"), photo("p3", "t2", "c3"), photo("p4", "t2", "c4", "video")];
    const places = placesInCountry(visits, cities, media);
    expect(places.map((p) => [p.name, p.trips, p.photos, p.videos, p.lived])).toEqual([
      ["Ljubljana", 2, 1, 1, true],
      ["Bled", 2, 2, 0, false],
    ]);
    expect(places[0].from).toBe("2024-06-20");
    expect(places[0].to).toBe("2026-06-30");
    expect(places[0].lat).toBe(46.05);
    expect(places[1].cityIds).toEqual(["c2", "c3"]);
  });
});

describe("shortDays and dayLabel", () => {
  it("reads naturally", () => {
    const { shortDays: sd, dayLabel: dl } = { shortDays, dayLabel };
    expect(sd("2026-09-07", "2026-09-08")).toBe("7 – 8 Sep");
    expect(sd("2025-08-30", "2025-09-02")).toBe("30 Aug – 2 Sep");
    expect(sd("2026-09-07", null)).toBe("7 Sep");
    expect(sd(null, null)).toBeNull();
    expect(dl("2026-09-07", "2026-09-07", "2026-09-08")).toBe("Day 1 – 2");
    expect(dl("2026-09-07", "2026-09-11", "2026-09-11")).toBe("Day 5");
    expect(dl(null, "2026-09-07", null)).toBeNull();
  });
});

describe("stayWhen / stayMonth / countrySummary", () => {
  const v = (from: string | null, to: string | null, date_precision: "year" | "month" | "day" = "day", year = 2025) => ({ year, visited_from: from, visited_to: to, date_precision });
  it("formats a stay's dates by how long it was", () => {
    expect(stayWhen(v(null, null, "year", 2019))).toBe("2019");
    expect(stayWhen(v("2025-09-01", "2025-09-30", "month"))).toBe("Sep 2025");
    expect(stayWhen(v("2025-08-08", "2025-08-08"))).toBe("8 Aug 2025");
    expect(stayWhen(v("2025-08-08", "2025-08-10"))).toBe("8 – 10 Aug 2025");
    expect(stayWhen(v("2025-08-30", "2025-09-02"))).toBe("30 Aug – 2 Sep 2025");
    expect(stayWhen(v("2025-12-30", "2026-01-02"))).toBe("30 Dec 2025 – 2 Jan 2026");
    expect(stayWhen(v("2025-09-01", "2026-06-15"))).toBe("Sep 2025 – Jun 2026");
    expect(stayWhen(v("2025-02-01", "2025-06-15"))).toBe("Feb – Jun 2025");
  });
  it("gives the rail's month only when known", () => {
    expect(stayMonth(v("2025-08-08", "2025-08-10"))).toBe("Aug");
    expect(stayMonth(v(null, null, "year"))).toBeNull();
  });
  it("sums up a country", () => {
    const trip = { year: 2024, visited_from: null, visited_to: null, kind: "trip" as const };
    const lived = { year: 2025, visited_from: "2025-09-01", visited_to: "2026-06-15", kind: "lived" as const };
    expect(countrySummary([trip, trip, lived], 3, 40)).toBe("2 trips · 3 places · Lived here 2025 – 2026");
    expect(countrySummary([trip], 0, 0)).toBe("1 trip · no photos yet");
    expect(countrySummary([trip], 0, 5)).toBe("1 trip · 5 memories");
    expect(countrySummary([lived], 1, 0)).toBe("1 place · Lived here 2025 – 2026");
  });
});

describe("suggestTripName", () => {
  it("names a trip after its places", () => {
    expect(suggestTripName("trip", [], "Slovenia")).toBe("");
    expect(suggestTripName("trip", ["Bled"], "Slovenia")).toBe("Bled");
    expect(suggestTripName("trip", ["Ljubljana", "Bled", "Piran"], "Slovenia")).toBe("Ljubljana, Bled & Piran");
    expect(suggestTripName("trip", ["Oslo", "Flåm", "Bergen", "Ålesund"], "Norway")).toBe("Around Norway");
    expect(suggestTripName("lived", ["Ljubljana", "Bled"], "Slovenia")).toBe("Lived in Ljubljana");
  });
});

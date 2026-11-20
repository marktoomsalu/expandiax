import { describe, expect, it } from "vitest";
import { findWorld, tripDates, tripLength, type ScanPlace } from "./tripFinder";

// A fake map: each country is a box of latitudes.
const BOXES: [string, number, number][] = [
  ["EE", 57, 60],
  ["IT", 40, 46],
  ["PT", 37, 42],
  ["FR", 46, 50],
  ["DE", 50, 54],
];
const locate = (lat: number) => BOXES.find(([, lo, hi]) => lat >= lo && lat < hi)?.[0] ?? null;
const LAT: Record<string, number> = { EE: 59, IT: 43, PT: 38, FR: 47, DE: 52, SEA: 10 };

let seq = 0;
const at = (code: string, d: string, n = 5, f = 0): ScanPlace => ({ d, la: LAT[code], ln: 10, n, f, a: `asset-${code}-${d}-${seq++}` });
const days = (code: string, from: string, count: number, step = 1, n = 5) =>
  Array.from({ length: count }, (_, i) => at(code, new Date(Date.parse(`${from}T00:00:00Z`) + i * step * 86_400_000).toISOString().slice(0, 10), n));

// Life at home: photos every few days for a couple of years.
const homeLife = days("EE", "2023-01-01", 240, 3, 2);

describe("findWorld", () => {
  it("guesses home from where most days were photographed", () => {
    const world = findWorld([...homeLife, ...days("IT", "2024-05-03", 6)], locate);
    expect(world.homeCode).toBe("EE");
    expect(world.trips.map((t) => t.code)).toEqual(["IT"]);
  });

  it("makes one trip of a few days, even with a day without photos", () => {
    const world = findWorld([...homeLife, at("PT", "2024-05-03"), at("PT", "2024-05-04"), at("PT", "2024-05-07")], locate);
    expect(world.trips).toHaveLength(1);
    expect(world.trips[0]).toMatchObject({ code: "PT", from: "2024-05-03", to: "2024-05-07", photoDays: 3, photos: 15, kind: "trip" });
  });

  it("splits two visits to the same country with home in between", () => {
    const world = findWorld([...homeLife, ...days("IT", "2024-05-03", 3), at("EE", "2024-05-08"), ...days("IT", "2024-05-11", 2)], locate);
    expect(world.trips.filter((t) => t.code === "IT")).toHaveLength(2);
  });

  it("keeps a long stay together over quiet weeks, and calls it lived", () => {
    // Erasmus: photos every 10 days for five months, no photos at home.
    const erasmus = days("IT", "2023-09-01", 15, 10);
    const world = findWorld([...homeLife.filter((p) => p.d < "2023-08-20" || p.d > "2024-02-15"), ...erasmus], locate, "EE");
    const stays = world.trips.filter((t) => t.code === "IT");
    expect(stays).toHaveLength(1);
    expect(stays[0].kind).toBe("lived");
  });

  it("starts a long stay as separate trips when the first visit is short", () => {
    // Two weekends three weeks apart are two trips, not one.
    const world = findWorld([...homeLife, ...days("FR", "2024-03-01", 2), ...days("FR", "2024-03-20", 2)], locate, "EE");
    expect(world.trips.filter((t) => t.code === "FR")).toHaveLength(2);
  });

  it("drops a layover: one day, few photos, during a bigger trip", () => {
    const world = findWorld([...homeLife, at("DE", "2024-05-03", 1), ...days("PT", "2024-05-03", 5)], locate, "EE");
    expect(world.trips.map((t) => t.code)).toEqual(["PT"]);
  });

  it("drops a single stray photo, but keeps a favourite", () => {
    const stray = findWorld([...homeLife, at("FR", "2022-06-01", 1)], locate, "EE");
    expect(stray.trips).toHaveLength(0);
    const fav = findWorld([...homeLife, at("FR", "2022-06-01", 1, 1)], locate, "EE");
    expect(fav.trips).toHaveLength(1);
  });

  it("ignores photos at sea and lists countries in the order first visited", () => {
    const world = findWorld([...homeLife, at("SEA", "2024-01-01"), ...days("PT", "2024-06-01", 3), ...days("IT", "2023-06-01", 3)], locate, "EE");
    expect(world.countries.map((c) => c.code)).toEqual(["IT", "PT"]);
    expect(world.trips[0].code).toBe("PT"); // newest first
  });

  it("uses the given home instead of guessing", () => {
    const world = findWorld([...homeLife, ...days("IT", "2024-05-03", 6)], locate, "IT");
    expect(world.homeCode).toBe("IT");
    expect(world.trips.some((t) => t.code === "IT")).toBe(false);
    expect(world.trips.some((t) => t.code === "EE")).toBe(true);
  });

  it("puts favourites first among a trip's covers", () => {
    const fav = at("PT", "2024-05-05", 2, 1);
    const world = findWorld([...homeLife, ...days("PT", "2024-05-03", 4), fav], locate, "EE");
    expect(world.trips[0].covers[0]).toBe(fav.a);
  });

  it("copes with no places at all", () => {
    expect(findWorld([], locate)).toMatchObject({ homeCode: null, trips: [], countries: [] });
  });
});

describe("tripDates and tripLength", () => {
  it("reads like a person would write it", () => {
    expect(tripDates("2024-05-03", "2024-05-08")).toBe("3–8 May 2024");
    expect(tripDates("2024-04-28", "2024-05-02")).toBe("28 Apr – 2 May 2024");
    expect(tripDates("2024-05-12", "2024-05-12")).toBe("12 May 2024");
    expect(tripDates("2023-12-30", "2024-01-02")).toBe("30 Dec 2023 – 2 Jan 2024");
    expect(tripDates("2023-09-01", "2024-02-10")).toBe("Sep 2023 – Feb 2024");
    expect(tripLength("2024-05-03", "2024-05-08")).toBe("6 days");
    expect(tripLength("2023-09-01", "2024-02-10")).toBe("5 months");
  });
});

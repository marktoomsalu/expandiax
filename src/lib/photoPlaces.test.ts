import { describe, expect, it } from "vitest";
import { groupByTown, placeKey, townFor, type Town } from "./photoPlaces";

const SI: Town[] = [
  { name: "Ljubljana", lat: 46.0511, lng: 14.5051, pop: 284355 },
  { name: "Črnuče", lat: 46.1033, lng: 14.5306, pop: 1500 },
  { name: "Bled", lat: 46.3686, lng: 14.1165, pop: 5181 },
  { name: "Radovljica", lat: 46.3444, lng: 14.1744, pop: 6000 },
  { name: "Piran", lat: 45.5278, lng: 13.5706, pop: 4192 },
];

describe("townFor", () => {
  it("names the town the photo was taken in", () => {
    expect(townFor({ lat: 46.3637, lng: 14.0938 }, SI)?.name).toBe("Bled"); // the lake
    expect(townFor({ lat: 45.5285, lng: 13.5683 }, SI)?.name).toBe("Piran");
  });
  it("prefers the city over a village in its suburbs", () => {
    expect(townFor({ lat: 46.098, lng: 14.527 }, SI)?.name).toBe("Ljubljana");
  });
  it("gives up when nothing is near", () => {
    expect(townFor({ lat: 48.8566, lng: 2.3522 }, SI)).toBeNull();
  });
});

describe("groupByTown", () => {
  const [lj, , bled, , piran] = SI;
  it("groups photos into places in the order they were visited, with their days", () => {
    const out = groupByTown([
      { day: "2025-08-12", town: piran },
      { day: "2025-08-08", town: lj },
      { day: "2025-08-10", town: bled },
      { day: "2025-08-09", town: lj },
      { day: null, town: null },
      { day: "2025-08-13", town: piran },
    ]);
    expect(out.map((p) => [p.name, p.arrived, p.departed, p.photos])).toEqual([
      ["Ljubljana", "2025-08-08", "2025-08-09", [1, 3]],
      ["Bled", "2025-08-10", "2025-08-10", [2]],
      ["Piran", "2025-08-12", "2025-08-13", [0, 5]],
    ]);
  });
  it("folds a stray photo or two into the place you stayed nearby", () => {
    const radovljica = SI[3]; // 5 km from Bled
    const out = groupByTown([
      { day: "2025-08-10", town: bled },
      { day: "2025-08-10", town: bled },
      { day: "2025-08-11", town: bled },
      { day: "2025-08-11", town: radovljica },
    ]);
    expect(out.map((p) => [p.name, p.photos, p.departed])).toEqual([["Bled", [0, 1, 2, 3], "2025-08-11"]]);
  });
  it("matches names however they're written", () => {
    expect(placeKey(" Črnuče ")).toBe(placeKey("crnuce"));
  });
});
